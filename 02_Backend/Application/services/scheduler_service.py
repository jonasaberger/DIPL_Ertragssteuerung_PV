import threading
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from stores.system_mode_store import SystemMode
from stores.automatic_config_store import AutomaticConfigStore

from services.pv_surplus_service import PVSurplusService
from services.pv_forecast_service import PVForecastService
from services.epex_service import EPEXService
from services.wallbox_dynamic_controller import WallboxDynamicController

# Minimaler PV-Überschuss um Boiler zu starten (kW)
# 1.5 kW = deutlich über Grundverbrauch (~0.8kW), verhindert Nacht-Trigger
# Nachts ist echter Surplus immer negativ -> kein False-Positive möglich
BOILER_PV_MIN_KW = 1.5
# Minimaler SOC um Boiler per PV zu starten (Hysterese: 2%)
BOILER_SOC_START = 12.0
BOILER_SOC_STOP  = 10.0
# Hysterese für Boiler-Temperaturentscheidung (°C)
# Zustand beibehalten wenn Temperatur zwischen (target - HYSTERESIS) und target liegt
HYSTERESIS = 2

class SchedulerService(threading.Thread):
    def __init__(self, mode_store, schedule_manager, boiler, wallbox, db_bridge, logger, interval=60):
        super().__init__(daemon=True)

        # The SchedulerService is responsible for controlling the boiler and wallbox based on the current system mode (manual, time-controlled, automatic),
        # schedules, PV forecast, PV surplus, and EPEX electricity price analysis. 
        # It runs in a separate thread and periodically checks conditions to make control decisions. 
        # The service also logs all decisions and relevant events for transparency and debugging purposes.
        self.mode_store = mode_store
        self.schedule_manager = schedule_manager
        self.boiler = boiler
        self.wallbox = wallbox
        self.interval = interval
        self.logger = logger
        self.db_bridge = db_bridge

        # State variables for time-controlled mode error logging, to avoid spamming logs with repeated errors
        self.last_time_controlled_error_date = None
        self.wallbox_online_last_state = None
        self.boiler_last_reason = None

        # Initialize services and configuration store for automatic mode
        self.automatic_config = AutomaticConfigStore()
        self.pv_service = PVSurplusService(db_bridge)
        self.pv_forecast = PVForecastService()
        self.epex_service = EPEXService(db_bridge)

        # Dynamic charging controller
        self.wallbox_dynamic = WallboxDynamicController(
            hysteresis_kw=0.3,           # Hinders Flapping when surplus fluctuates around the threshold (1.4kW ± 0.3kW)
            min_surplus_kw=1.4,          # Min for 6A
            battery_protection_soc=20,   # Protection of battery (don't discharge below SoC)
            max_battery_discharge_kw=0.5 # Max allowable discharge from battery to wallbox
        )

        # Wallbox runtime state
        self.wallbox_eto_start = None
        self.wallbox_finished = False
        self.wallbox_last_set_allow = None
        self.wallbox_failsafe_until = None  # Wenn gesetzt: Wallbox lädt fix bis Zielzeit
        self.wallbox_deadline_missed = False  # Nach Deadline ohne Ziel: nur noch EPEX-Notfall erlaubt

        # Logging throttle state
        self.boiler_session_logged_date = None
        self.wallbox_session_logged = False
        self.last_epex_log_hour_boiler = None
        self.last_epex_log_hour_wallbox = None
        self.last_forecast_override_log_boiler = None
        self.last_forecast_override_log_wallbox = None
        self._last_charging_stable_log = None
        self.boiler_last_turned_on = None
        self.boiler_target_logged_date = None
        self.boiler_failsafe_until = None  # Wenn gesetzt: Boiler läuft fix bis zu diesem Zeitpunkt
        self.boiler_failsafe_logged_today = False  # FIX #9: Erstes ⚠-Log pro Tag, Folge-Verlängerungen separat
        self.boiler_failsafe_done_today = False    # Einmalig 2h – danach kein weiterer Failsafe bis 00:00

    # Main loop of the scheduler thread, which calls tick() every interval seconds
    def run(self):
        while True:
            self.tick()
            time.sleep(self.interval)

    # Log time-controlled mode errors (throttled to once per day)
    def log_time_controlled_error(self, error):
        today = datetime.now(ZoneInfo("Europe/Vienna")).date()
        if self.last_time_controlled_error_date != today:
            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="error",
                source="zeitsteuerung",
                message=f"Zeitsteuerung Fehler: {error}"
            )
            self.last_time_controlled_error_date = today

    # Main scheduler tick function, called every interval (60s)
    def tick(self):
        try:
            if not self.mode_store:
                return
    
            mode = self.mode_store.get()

            if mode == SystemMode.MANUAL:
                return
            if mode == SystemMode.TIME_CONTROLLED:
                self.run_time_controlled()
                return
            if mode == SystemMode.AUTOMATIC:
                self.run_automatic()
                return

        except Exception as e:
            # SYSTEM EVENT LOG 
             self.logger.system_event(
                 level="error",
                 source="scheduler",
                 message=f"Scheduler Fehler im Tick: {e}"
            )

    # TIME CONTROLLED
    def run_time_controlled(self):
        try:
            # Boiler
            state = self.boiler.get_state()
            should_on = self.schedule_manager.is_active("boiler")

            if should_on and not state:
                self.boiler.control("on")
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    "boiler", False, True,
                    reason="Zeitsteuerung: Einschaltzeit erreicht"
                )
            elif not should_on and state:
                self.boiler.control("off")
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    "boiler", True, False,
                    reason="Zeitsteuerung: Ausschaltzeit erreicht"
                )

            # Wallbox
            current = self.wallbox.get_allow_state()
            should_allow = self.schedule_manager.is_active("wallbox")

            if not self.wallbox.is_online() or current is None:
                return

            if should_allow and not current:
                self.wallbox.set_allow_charging(True)
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    "wallbox", False, True,
                    reason="Zeitsteuerung: Ladefreigabe"
                )
            elif not should_allow and current:
                self.wallbox.set_allow_charging(False)
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    "wallbox", True, False,
                    reason="Zeitsteuerung: Ladestopp"
                )

        except Exception as e:
            self.log_time_controlled_error(e)

    # AUTOMATIC
    def run_automatic(self):
        forecast = self.pv_forecast.get_forecast()

        # Einmal abrufen – beide Geräte nutzen denselben Snapshot
        try:
            pv_state = self.pv_service.get_pv_state()
        except Exception:
            pv_state = None

        self.automatic_boiler(forecast, pv_state)

        # Wallbox bekommt angepassten Surplus: Boiler-Last abziehen wenn er läuft
        # Boiler zieht ~2 kW → würde sonst Wallbox fälschlicherweise auch starten
        BOILER_LOAD_KW = 2.0
        if pv_state is not None and self.boiler.get_state():
            adjusted_pv_state = {
                **pv_state,
                "surplus_kw": pv_state["surplus_kw"] - BOILER_LOAD_KW
            }
        else:
            adjusted_pv_state = pv_state

        self.automatic_wallbox(forecast, adjusted_pv_state)

    # AUTOMATIC – Boiler
    def automatic_boiler(self, forecast, pv_state=None):
        config = self.automatic_config.get()
        season = self.schedule_manager.determine_season()
        boiler_cfg = config.get("boiler", {}).get(season, {})

        target_time = boiler_cfg.get("target_time")
        target_temp = boiler_cfg.get("target_temp_c")
        min_runtime = int(boiler_cfg.get("min_runtime_min", 90))

        if not target_time or target_temp is None:
            return

        try:
            boiler_on = self.boiler.get_state()
            boiler_data = self.db_bridge.get_latest_boiler_data()
            current_temp = boiler_data.get("boiler_temp") if boiler_data else None
        except Exception:
            return

        if current_temp is None:
            return

        now = datetime.now(ZoneInfo("Europe/Vienna"))
        deadline_today = datetime.combine(
            now.date(),
            datetime.strptime(target_time, "%H:%M").time(),
            tzinfo=ZoneInfo("Europe/Vienna")
        )
        # deadline_today = heutiges Ziel (z.B. 16:00), auch wenn bereits überschritten
        # deadline = für remaining_min Berechnung: springt auf morgen wenn überschritten
        deadline = deadline_today
        if deadline < now:
            deadline += timedelta(days=1)
        remaining_min = (deadline - now).total_seconds() / 60

        # Einmal täglich Sitzungsstart loggen
        if self.boiler_session_logged_date != now.date():
            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="info",
                source="boiler_automatik",
                message=f"[Boiler] Automatik-Tag: {current_temp}°C aktuell / Ziel {target_temp}°C bis {target_time} Uhr | "
                        f"Saison: {season} | Mindestlaufzeit: {min_runtime}min"
            )
            self.boiler_session_logged_date = now.date()
            self.boiler_failsafe_logged_today = False  # FIX #9: täglich zurücksetzen
            self.boiler_failsafe_done_today = False     # Einmalig-Failsafe täglich freigeben

        decision_on = False
        reason = "idle"
        pv_surplus = 0.0
        soc = None  # FIX #6: None statt 0.0 – bei DB-Fehler nicht als "SOC: 0%" loggen
        epex_stats = {}

        # Failsafe-2h: Wenn aktiv → Boiler fix AN bis Zeitfenster abläuft
        if self.boiler_failsafe_until is not None:
            if now < self.boiler_failsafe_until:
                if not boiler_on:
                    self.boiler.control("on")
                    self.boiler_last_turned_on = now
                    self.logger.device_state_change(
                        "boiler", False, True,
                        reason=f"[Boiler] Deadline-Failsafe: Fix-Laden bis {self.boiler_failsafe_until.strftime('%H:%M')} Uhr"
                    )
                self.boiler_last_reason = "deadline_failsafe"
                return
            else:
                # Zeitfenster abgelaufen → einmalig fertig, kein erneutes Starten heute
                self.boiler_failsafe_until = None
                self.boiler_failsafe_done_today = True

        # Fall 1: Zieltemperatur erreicht
        if current_temp >= target_temp:
            decision_on = False
            reason = "target_temp_reached"

        # Fall 2: Temperatur unter Ziel -> Heizung nötig
        elif current_temp <= target_temp - HYSTERESIS:

            # pv_state wurde von run_automatic() übergeben → kein zweiter DB-Call
            if pv_state is not None:
                try:
                    pv_surplus = pv_state["surplus_kw"]
                    soc = pv_state["soc"]
                    pv_valid = True
                except Exception:
                    pv_surplus = 0.0
                    soc = None
                    pv_valid = False
            else:
                pv_surplus = 0.0
                soc = None
                pv_valid = False

            pv_today = forecast.get("pv_today", False)
            pv_tomorrow = forecast.get("pv_tomorrow", False)

            # Priorität 1: PV-Überschuss
            # Nur starten wenn: Überschuss > 1.5 kW UND Batterie SOC >= 12%
            # (Hysterese: erst stoppen wenn SOC < 10%, also kein Flapping)
            # FIX #6: soc is not None guard verhindert 0.0-Fehlinterpretation
            soc_ok = (soc is not None) and (soc >= BOILER_SOC_START or (boiler_on and soc >= BOILER_SOC_STOP))
            if pv_valid and pv_surplus > BOILER_PV_MIN_KW and soc_ok:
                decision_on = True
                reason = "pv_surplus"

            else:
                # EPEX-Analyse nur wenn kein PV-Überschuss
                epex_stats = self.epex_service.get_price_statistics()
                is_emergency_cheap = epex_stats.get("is_emergency_cheap", False)
                emergency_threshold = epex_stats.get("emergency_threshold")

                # Priorität 2: EPEX Notfall-Billigstrom (überstimmt Prognose)
                if is_emergency_cheap:
                    if (self.last_epex_log_hour_boiler is None or
                            abs(now.hour - self.last_epex_log_hour_boiler) >= 2):
                        # SYSTEM EVENT LOG
                        self.logger.system_event(
                            level="info",
                            source="boiler_automatik",
                            message=f"[Boiler] EPEX Notfall-Billigstrom: {epex_stats.get('current')} ct/kWh "
                                    f"(Notfall-Schwelle: {round(emergency_threshold, 2) if emergency_threshold else '?'} ct/kWh) | "
                                    f"14-Tage: {epex_stats.get('min')}–{epex_stats.get('max')} ct/kWh, Ø {epex_stats.get('avg')} | "
                                    f"PV-Prognose überstimmt (heute: {pv_today}, morgen: {pv_tomorrow}) | "
                                    f"→ Boiler lädt jetzt"
                        )
                        self.last_epex_log_hour_boiler = now.hour
                    decision_on = True
                    reason = "epex_emergency_cheap"

                # Priorität 3: EPEX günstig, kein PV erwartet
                elif not (pv_today or pv_tomorrow):
                    if (self.last_epex_log_hour_boiler is None or
                            abs(now.hour - self.last_epex_log_hour_boiler) >= 2):
                        # SYSTEM EVENT LOG
                        self.logger.system_event(
                            level="info",
                            source="boiler_automatik",
                            message=f"[Boiler] EPEX Strompreis: {epex_stats.get('current')} ct/kWh | "
                                    f"Schwelle: {epex_stats.get('threshold')} ct/kWh | "
                                    f"günstig: {epex_stats.get('is_cheap')} | "
                                    f"14-Tage Ø: {epex_stats.get('avg')} ct/kWh"
                        )
                        self.last_epex_log_hour_boiler = now.hour

                    if epex_stats.get("is_cheap", False):
                        decision_on = True
                        reason = "epex_cheap"
                    elif remaining_min <= min_runtime:
                        decision_on = True
                        reason = "deadline_failsafe"
                    else:
                        decision_on = False
                        reason = "wait"

                # Priorität 4: PV erwartet -> warten
                else:
                    decision_on = False
                    reason = "forecast_wait"
                    if epex_stats.get("is_cheap", False):
                        if (self.last_forecast_override_log_boiler is None or
                                (now - self.last_forecast_override_log_boiler).total_seconds() > 7200):
                            # SYSTEM EVENT LOG
                            self.logger.system_event(
                                level="info",
                                source="boiler_automatik",
                                message=f"[Boiler] Strom günstig ({epex_stats.get('current')} ct/kWh), aber PV erwartet "
                                        f"(heute: {pv_today}, morgen: {pv_tomorrow}) – warte auf PV. "
                                        f"Kein Notfall-Billigstrom (Grenze: {round(emergency_threshold, 2) if emergency_threshold else 'N/A'} ct/kWh)"
                            )
                            self.last_forecast_override_log_boiler = now

            # Failsafe: Deadline nähert sich → normal einschalten (kein Fix-Laden)
            if not decision_on and not boiler_on and remaining_min <= min_runtime:
                decision_on = True
                reason = "deadline_failsafe"

        # Fall 3: Hysterese → Zustand halten
        else:
            decision_on = boiler_on
            reason = "hysteresis_hold"

        # Lesbarer Grund für Logs
        # FIX #6: soc_display zeigt "N/A" wenn SOC bei DB-Fehler unbekannt
        def reason_text():
            soc_display = f"{soc:.0f}%" if soc is not None else "N/A"
            if reason == "pv_surplus":
                return f"PV-Überschuss {pv_surplus:.1f} kW | Batterie: {soc_display}"
            elif reason == "epex_emergency_cheap":
                return f"EPEX Notfall-Billigstrom {epex_stats.get('current')} ct/kWh (PV-Prognose überstimmt)"
            elif reason == "epex_cheap":
                return f"EPEX günstig {epex_stats.get('current')} ct/kWh (kein PV erwartet)"
            elif reason == "deadline_failsafe":
                return f"Deadline-Failsafe: Zielzeit {target_time} in {round(remaining_min)}min"
            elif reason == "target_temp_reached":
                return f"Zieltemperatur {target_temp}°C erreicht (aktuell {current_temp}°C)"
            elif reason == "forecast_wait":
                return "Warte auf PV laut Prognose"
            elif reason == "hysteresis_hold":
                return "Hysterese: Zustand beibehalten"
            elif reason == "wait":
                return f"Warte (kein PV, kein günstiger Strom, {round(remaining_min)}min bis {target_time})"
            else:
                # FIX #8: Fallback gibt reason-Code aus statt irreführendem "Kein Einschaltgrund"
                return f"Grund: {reason}"

        # Entscheidung ausführen
        if decision_on and not boiler_on:
            self.boiler.control("on")
            self.boiler_last_turned_on = now
            self.logger.device_state_change(
                "boiler", False, True,
                reason=f"[Boiler] Automatik: {reason_text()} | {current_temp}°C → Ziel {target_temp}°C | noch {round(remaining_min)}min bis {target_time}"
            )

        elif not decision_on and boiler_on:
            # FIX #3: Mindestlaufzeit-Guard – früher return, aber boiler_last_reason wird
            # danach trotzdem gesetzt (return ist hier ok da kein AUS-Log entgeht)
            if self.boiler_last_turned_on is not None:
                on_since_min = (now - self.boiler_last_turned_on).total_seconds() / 60
                if on_since_min < 10:
                    return  # Mindestlaufzeit 10min noch nicht erreicht
            self.boiler.control("off")
            self.logger.device_state_change(
                "boiler", True, False,
                reason=f"[Boiler] Automatik: {reason_text()} | aktuell {current_temp}°C / Ziel {target_temp}°C"
            )

        if reason == "target_temp_reached" and self.boiler_target_logged_date != now.date():
            self.logger.system_event(
                level="info",
                source="boiler_automatik",
                message=f"[Boiler] ✓ Tagesziel erreicht: {current_temp}°C / Ziel {target_temp}°C bis {target_time} Uhr"
            )
            self.boiler_target_logged_date = now.date()

        # Post-Deadline Failsafe: Zielzeit überschritten und Temperatur noch nicht erreicht
        # → einmalig 2h Fix-Laden, danach kein weiterer Failsafe bis 00:00
        # Nach dem 2h-Fenster bleibt der Boiler aus – außer EPEX-Notfall greift (Prio 2)
        if (now >= deadline_today and current_temp < target_temp
                and self.boiler_failsafe_until is None
                and not self.boiler_failsafe_done_today
                and self.boiler_target_logged_date != now.date()):
            self.boiler_failsafe_until = now + timedelta(hours=2)
            self.boiler_failsafe_logged_today = True
            self.logger.system_event(
                level="info",
                source="boiler_automatik",
                message=f"[Boiler] ⚠ Zielzeit {target_time} überschritten, {current_temp:.1f}°C < {target_temp}°C "
                        f"→ Netz-Failsafe gestartet (bis {self.boiler_failsafe_until.strftime('%H:%M')} Uhr, einmalig)"
            )

        self.boiler_last_reason = reason

    # AUTOMATIC – Wallbox
    def automatic_wallbox(self, forecast, pv_state=None):
        config = self.automatic_config.get()
        season = self.schedule_manager.determine_season()
        wb_cfg = config.get("wallbox", {}).get(season, {})

        if not self.wallbox:
            return

        try:
            # Online-Check – wenn fehlerhaft, lieber nicht steuern als ständig Fehler zu loggen
            if hasattr(self.wallbox, "is_online") and not self.wallbox.is_online():
                return
        except Exception as e:
            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="error",
                source="wallbox_automatik",
                message=f"[Wallbox] Online-Check fehlgeschlagen: {e}"
            )
            return

        try:
            data = self.wallbox.fetch_data()
        except Exception as e:
            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="error",
                source="wallbox_automatik",
                message=f"[Wallbox] Datenabruf fehlgeschlagen: {e}"
            )
            return

        car_connected = data.get("car_connected") == 1
        eto_now = data.get("eto")

        if eto_now is None:
            return

        target_kwh = float(wb_cfg.get("energy_kwh", 0))
        target_time = wb_cfg.get("target_time", "?")

        # Auto getrennt -> Sitzung beenden
        if not car_connected:
            if self.wallbox_eto_start is not None:
                charged_kwh = max((eto_now - self.wallbox_eto_start) / 1000, 0)
                target_reached = charged_kwh >= target_kwh
                # SYSTEM EVENT LOG
                self.logger.system_event(
                    level="info",
                    source="wallbox_automatik",
                    message=f"[Wallbox] Ladevorgang beendet: Auto getrennt | "
                            f"Geladen: {round(charged_kwh, 2)} kWh / Ziel: {target_kwh} kWh | "
                            f"{'✓ Ziel erreicht' if target_reached else '✗ Ziel nicht erreicht'}"
                )
                self.wallbox_eto_start = None
                self.wallbox_finished = False
                self.wallbox_last_set_allow = None
                self.wallbox_session_logged = False
            return

        # Neue Sitzung starten
        if self.wallbox_eto_start is None:
            self.wallbox_eto_start = eto_now
            self.wallbox_finished = False
            if not self.wallbox_session_logged:
                # SYSTEM EVENT LOG
                self.logger.system_event(
                    level="info",
                    source="wallbox_automatik",
                    message=f"[Wallbox] Neue Ladesitzung gestartet: Ziel {target_kwh} kWh bis {target_time} Uhr | "
                            f"Saison: {season} | Zählerstand: {round(eto_now / 1000, 2)} kWh"
                )
                self.wallbox_session_logged = True

        charged_kwh = max((eto_now - self.wallbox_eto_start) / 1000, 0)
        progress_info = f"{round(charged_kwh, 2)}/{target_kwh} kWh | Ziel: {target_time} Uhr"

        # Ladeziel erreicht
        if charged_kwh >= target_kwh:
            if not self.wallbox_finished:
                self.wallbox.set_allow_charging(False)
                self.logger.device_state_change(
                    "wallbox", True, False,
                    reason=f"[Wallbox] Automatik: Ladeziel erreicht – {round(charged_kwh, 2)} / {target_kwh} kWh geladen"
                )
                self.logger.system_event(
                    level="info",
                    source="wallbox_automatik",
                    message=f"[Wallbox] ✓ Ladeziel erreicht: {round(charged_kwh, 2)} / {target_kwh} kWh | Ziel: {target_time} Uhr"
                )
                self.wallbox_finished = True
                self.wallbox_last_set_allow = False
                self.wallbox_failsafe_until = None  # FIX #10: Failsafe-State bereinigen
            return

        allow = self.wallbox.get_allow_state()

        # PV-Zustand: wurde von run_automatic() übergeben (bereits Boiler-Last abgezogen)
        if pv_state is not None:
            try:
                pv_surplus = pv_state["surplus_kw"]
                battery_soc = pv_state["soc"] if pv_state["soc"] is not None else 50.0
                battery_power_kw = pv_state["battery_power_kw"]
            except Exception:
                pv_surplus = 0.0
                battery_soc = 50.0
                battery_power_kw = 0.0
        else:
            pv_surplus = 0.0
            battery_soc = 50.0
            battery_power_kw = 0.0

        pv_today = forecast.get("pv_today", False)
        pv_tomorrow = forecast.get("pv_tomorrow", False)
        allow_night = wb_cfg.get("allow_night_grid", False)

        now = datetime.now(ZoneInfo("Europe/Vienna"))
        deadline = datetime.combine(
            now.date(),
            datetime.strptime(target_time, "%H:%M").time(),
            tzinfo=ZoneInfo("Europe/Vienna")
        )
        if deadline < now:
            deadline += timedelta(days=1)
        remaining_hours = (deadline - now).total_seconds() / 3600

        # Wenn Deadline heute bereits überschritten wurde ohne Ziel → Flag setzen
        # (deadline wurde oben auf morgen verschoben, also: jetzt > heutige Deadline)
        deadline_today_wb = deadline - timedelta(days=1) if deadline.date() > now.date() else deadline
        if now > deadline_today_wb and not self.wallbox_finished:
            if not self.wallbox_deadline_missed:
                self.wallbox_deadline_missed = True
                self.logger.system_event(
                    level="info",
                    source="wallbox_automatik",
                    message=f"[Wallbox] ⚠ Deadline {target_time} verpasst ohne Ladeziel – "
                            f"ab jetzt nur noch EPEX-Notfall erlaubt"
                )
        elif self.wallbox_finished:
            self.wallbox_deadline_missed = False  # Ziel erreicht → kein Missed-State

        PV_MIN_KW = 1.4

        # Priorität 1: PV-Überschuss -> dynamisches Laden
        if pv_surplus > 0:
            try:
                current_ampere = self.wallbox.get_current_ampere()
            except Exception:
                current_ampere = 0

            charging_decision = self.wallbox_dynamic.get_charging_decision(
                pv_surplus_kw=pv_surplus,
                battery_power_kw=battery_power_kw,
                battery_soc=battery_soc,
                current_ampere=current_ampere
            )

            optimal_ampere = charging_decision["ampere"]
            should_charge = charging_decision["allow_charging"]

            if should_charge and optimal_ampere > 0:

                # Ampere anpassen wenn geändert
                if optimal_ampere != current_ampere:
                    try:
                        self.wallbox.set_charging_ampere(optimal_ampere)
                        # DEVICE STATE CHANGE LOG
                        self.logger.device_state_change(
                            "wallbox_ampere", current_ampere, optimal_ampere,
                            reason=f"[Wallbox] Automatik PV-Dynamik: {pv_surplus:.1f} kW Überschuss | "
                                   f"Batterie: {battery_soc:.0f}% ({battery_power_kw:+.1f} kW)"
                        )
                    except Exception as e:
                        # SYSTEM EVENT LOG
                        self.logger.system_event(
                            level="error",
                            source="wallbox_automatik",
                            message=f"[Wallbox] Ladestrom setzen fehlgeschlagen ({optimal_ampere}A): {e}"
                        )

                # Laden freigeben wenn noch nicht aktiv
                if not allow:
                    self.wallbox.set_allow_charging(True)
                    # DEVICE STATE CHANGE LOG
                    self.logger.device_state_change(
                        "wallbox", False, True,
                        reason=f"[Wallbox] Automatik: PV-Überschuss {pv_surplus:.1f} kW → {optimal_ampere}A | "
                               f"Batterie: {battery_soc:.0f}% ({battery_power_kw:+.1f} kW) | {progress_info}"
                    )

                # Stabiles Laden loggen (gedrosselt auf 10min)
                elif allow and optimal_ampere == current_ampere:
                    if (self._last_charging_stable_log is None or
                            (now - self._last_charging_stable_log).total_seconds() > 600):
                        # SYSTEM EVENT LOG
                        self.logger.system_event(
                            level="info",
                            source="wallbox_automatik",
                            message=f"[Wallbox] Laden stabil: {optimal_ampere}A | "
                                    f"PV-Überschuss: {pv_surplus:.1f} kW | "
                                    f"Batterie: {battery_soc:.0f}% ({battery_power_kw:+.1f} kW) | {progress_info}"
                        )
                        self._last_charging_stable_log = now

                self.wallbox_last_set_allow = True
                return

            # PV vorhanden aber zu wenig für Laden
            elif not should_charge:
                if allow:
                    self.wallbox.set_allow_charging(False)
                    # DEVICE STATE CHANGE LOG
                    self.logger.device_state_change(
                        "wallbox", True, False,
                        reason=f"[Wallbox] Automatik: PV unzureichend – {charging_decision.get('reason', '?')} | {progress_info}"
                    )
                    self.wallbox_last_set_allow = False
                # FIX #5: Ampere-State zurücksetzen wenn Laden gestoppt
                try:
                    self.wallbox_dynamic.reset()
                except Exception:
                    pass
                return

        # Priorität 2+: EPEX Preisanalyse
        # FIX #4: EPEX-Abruf nur wenn PV-Pfad nicht gegriffen hat (pv_surplus <= 0)
        epex_stats = self.epex_service.get_price_statistics()
        is_emergency_cheap = epex_stats.get("is_emergency_cheap", False)
        emergency_threshold = epex_stats.get("emergency_threshold")

        # Priorität 2: EPEX Notfall-Billigstrom (überstimmt Prognose)
        if is_emergency_cheap:
            if (self.last_epex_log_hour_wallbox is None or
                    abs(now.hour - self.last_epex_log_hour_wallbox) >= 2):
                # SYSTEM EVENT LOG
                self.logger.system_event(
                    level="info",
                    source="wallbox_automatik",
                    message=f"[Wallbox] EPEX Notfall-Billigstrom: {epex_stats.get('current')} ct/kWh "
                            f"(Notfall-Schwelle: {round(emergency_threshold, 2) if emergency_threshold else '?'} ct/kWh) | "
                            f"PV-Prognose überstimmt | {progress_info} | "
                            f"→ Wallbox lädt jetzt"
                )
                self.last_epex_log_hour_wallbox = now.hour

            if not allow:
                self.wallbox.set_allow_charging(True)
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    "wallbox", False, True,
                    reason=f"[Wallbox] Automatik: EPEX Notfall-Billigstrom {epex_stats.get('current')} ct/kWh "
                           f"(PV-Prognose überstimmt) | {progress_info}"
                )
                self.wallbox_last_set_allow = True
            return

        # Priorität 3: EPEX günstig, kein PV erwartet
        if not (pv_today or pv_tomorrow):
            if (self.last_epex_log_hour_wallbox is None or
                    abs(now.hour - self.last_epex_log_hour_wallbox) >= 2):
                # SYSTEM EVENT LOG
                self.logger.system_event(
                    level="info",
                    source="wallbox_automatik",
                    message=f"[Wallbox] EPEX Strompreis: {epex_stats.get('current')} ct/kWh | "
                            f"Schwelle: {epex_stats.get('threshold')} ct/kWh | "
                            f"günstig: {epex_stats.get('is_cheap')} | "
                            f"14-Tage Ø: {epex_stats.get('avg')} ct/kWh | {progress_info}"
                )
                self.last_epex_log_hour_wallbox = now.hour

            if epex_stats.get("is_cheap", False):
                if not allow:
                    self.wallbox.set_allow_charging(True)
                    self.logger.device_state_change(
                        "wallbox", False, True,
                        reason=f"[Wallbox] Automatik: EPEX günstig {epex_stats.get('current')} ct/kWh (kein PV erwartet) | {progress_info}"
                    )
                    self.wallbox_last_set_allow = True
                return

        # Priorität 4: PV erwartet → warten
        # FIX #1: Kein 'return' am Ende – Priorität 5 (Deadline-Failsafe) muss erreichbar bleiben
        # Szenario: pv_today=True aber es ist 17:45 Uhr und kein PV mehr da → Failsafe muss greifen
        if pv_surplus < PV_MIN_KW and (pv_today or pv_tomorrow):
            if epex_stats.get("is_cheap", False):
                if (self.last_forecast_override_log_wallbox is None or
                        (now - self.last_forecast_override_log_wallbox).total_seconds() > 7200):
                    # SYSTEM EVENT LOG
                    self.logger.system_event(
                        level="info",
                        source="wallbox_automatik",
                        message=f"[Wallbox] Strom günstig ({epex_stats.get('current')} ct/kWh), aber PV erwartet "
                                f"(heute: {pv_today}, morgen: {pv_tomorrow}) – warte auf PV | {progress_info}"
                    )
                    self.last_forecast_override_log_wallbox = now

            # FIX #7: Prio-4 darf Wallbox nicht AUS schalten wenn Failsafe bereits aktiv ist.
            # Ohne Guard: Prio-4 setzt allow=False, Failsafe re-enabled sofort → AUS-Log jede Minute (Spam).
            # allow lokal auf False setzen damit Failsafe-Check (not allow) korrekt re-enabled.
            failsafe_active = (self.wallbox_failsafe_until is not None and now < self.wallbox_failsafe_until)
            if allow and not failsafe_active:
                self.wallbox.set_allow_charging(False)
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    "wallbox", True, False,
                    reason=f"[Wallbox] Automatik: Warte auf PV (heute: {pv_today}, morgen: {pv_tomorrow}) | {progress_info}"
                )
                self.wallbox_last_set_allow = False
                allow = False  # lokale Variable aktualisieren für Prio-5-Check
            # FIX #1: KEIN return – Priorität 5 darf greifen

        # Priorität 5: Nacht-Failsafe (Deadline nähert sich)
        # Einmal getriggert → wallbox_failsafe_until setzen → bleibt stabil AN bis Deadline
        # Verhindert AN/AUS-Flapping durch Prio-4-AUS im nächsten Tick
        if self.wallbox_failsafe_until is not None:
            if now < self.wallbox_failsafe_until:
                # Failsafe aktiv → AN halten, nicht mehr prüfen
                if not allow:
                    self.wallbox.set_allow_charging(True)
                    self.wallbox_last_set_allow = True
                return
            else:
                self.wallbox_failsafe_until = None  # Abgelaufen

        if allow_night and remaining_hours <= 2.0 and remaining_hours > 0 and not allow:
            self.wallbox_failsafe_until = deadline  # Bis Zielzeit laden
            self.wallbox.set_allow_charging(True)
            self.logger.device_state_change(
                "wallbox", False, True,
                reason=f"[Wallbox] Automatik: Deadline-Failsafe Netzstrom – "
                       f"noch {round(remaining_hours, 1)}h bis {target_time} | {progress_info}"
            )
            self.wallbox_last_set_allow = True
            return

        # FIX #2: Default-AUS ohne wallbox_last_set_allow-Guard
        # Alter Guard "is not True" konnte nach reset_automatic_state() (→ None) ein nötiges AUS blockieren
        if allow:
            self.wallbox.set_allow_charging(False)
            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change(
                "wallbox", True, False,
                reason=f"[Wallbox] Automatik: Kein PV, kein günstiger Strom, keine Prognose | {progress_info}"
            )
            self.wallbox_last_set_allow = False

    def reset_automatic_state(self):
        self.wallbox_eto_start = None
        self.wallbox_finished = False
        self.wallbox_last_set_allow = None
        self.wallbox_session_logged = False
        self.boiler_last_turned_on = None
        self.last_epex_log_hour_boiler = None
        self.last_epex_log_hour_wallbox = None
        self.last_forecast_override_log_boiler = None
        self.last_forecast_override_log_wallbox = None
        self.boiler_target_logged_date = None
        self.boiler_session_logged_date = None  # Reset so session log fires again after mode switch
        self.boiler_failsafe_until = None
        self.boiler_failsafe_logged_today = False  # FIX #9
        self.boiler_failsafe_done_today = False
        self.wallbox_failsafe_until = None
        self.wallbox_deadline_missed = False