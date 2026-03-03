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

        # Logging throttle state
        self.boiler_session_logged_date = None
        self.wallbox_session_logged = False
        self.last_epex_log_hour_boiler = None
        self.last_epex_log_hour_wallbox = None
        self.last_forecast_override_log_boiler = None
        self.last_forecast_override_log_wallbox = None
        self._last_charging_stable_log = None

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
        self.automatic_boiler(forecast)
        self.automatic_wallbox(forecast)

    # AUTOMATIC – Boiler
    def automatic_boiler(self, forecast):
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
        deadline = datetime.combine(
            now.date(),
            datetime.strptime(target_time, "%H:%M").time(),
            tzinfo=ZoneInfo("Europe/Vienna")
        )
        if deadline < now:
            deadline += timedelta(days=1)
        remaining_min = (deadline - now).total_seconds() / 60

        # Einmal täglich Sitzungsstart loggen
        if self.boiler_session_logged_date != now.date():
            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="info",
                source="boiler_automatik",
                message=f"Boiler Automatik-Tag: {current_temp}°C aktuell / Ziel {target_temp}°C bis {target_time} Uhr | "
                        f"Saison: {season} | Mindestlaufzeit: {min_runtime}min"
            )
            self.boiler_session_logged_date = now.date()

        HYSTERESIS = 2
        decision_on = False
        reason = "idle"
        pv_surplus = 0.0
        epex_stats = {}

        # Fall 1: Zieltemperatur erreicht
        if current_temp >= target_temp:
            decision_on = False
            reason = "target_temp_reached"

        # Fall 2: Temperatur unter Ziel -> Heizung nötig
        elif current_temp <= target_temp - HYSTERESIS:

            try:
                pv_surplus = self.pv_service.get_surplus_kw()
                pv_valid = True
            except Exception:
                pv_surplus = 0.0
                pv_valid = False

            pv_today = forecast.get("pv_today", False)
            pv_tomorrow = forecast.get("pv_tomorrow", False)

            # Priorität 1: PV-Überschuss
            if pv_valid and pv_surplus > 0.5:
                decision_on = True
                reason = "pv_surplus"

            else:
                # EPEX-Analyse nur wenn kein PV-Überschuss, da EPEX-Entscheidungen PV-Prognosen überstimmen können (z.B. Notfall-Billigstrom)
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
                            message=f"EPEX Notfall-Billigstrom: {epex_stats.get('current')} ct/kWh "
                                    f"(Notfall-Schwelle: {round(emergency_threshold, 2) if emergency_threshold else '?'} ct/kWh) | "
                                    f"14-Tage: {epex_stats.get('min')}–{epex_stats.get('max')} ct/kWh, Ø {epex_stats.get('avg')} | "
                                    f"PV-Prognose überstimmt (heute: {pv_today}, morgen: {pv_tomorrow})"
                        )
                        self.last_epex_log_hour_boiler = now.hour
                    decision_on = True
                    reason = "epex_emergency_cheap"

                # Priorität 3: EPEX günstig, kein PV erwartet
                elif not (pv_today or pv_tomorrow):
                    # EPEX-Preise nur alle 2h loggen, um Logspam zu vermeiden, wenn Preis günstig aber Zielzeit noch weit weg ist
                    if (self.last_epex_log_hour_boiler is None or
                            abs(now.hour - self.last_epex_log_hour_boiler) >= 2):
                        # SYSTEM EVENT LOG
                        self.logger.system_event(
                            level="info",
                            source="boiler_automatik",
                            message=f"EPEX Strompreis: {epex_stats.get('current')} ct/kWh | "
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
                    # EPEX-Preise nur alle 2h loggen, um Logspam zu vermeiden, wenn Preis günstig aber PV erwartet wird
                    if epex_stats.get("is_cheap", False):
                        if (self.last_forecast_override_log_boiler is None or
                                (now - self.last_forecast_override_log_boiler).total_seconds() > 7200):
                            # SYSTEM EVENT LOG
                            self.logger.system_event(
                                level="info",
                                source="boiler_automatik",
                                message=f"Strom günstig ({epex_stats.get('current')} ct/kWh), aber PV erwartet "
                                        f"(heute: {pv_today}, morgen: {pv_tomorrow}) – warte auf PV. "
                                        f"Kein Notfall-Billigstrom (Grenze: {round(emergency_threshold, 2) if emergency_threshold else 'N/A'} ct/kWh)"
                            )
                            self.last_forecast_override_log_boiler = now

            # Failsafe: Deadline nähert sich
            if not decision_on and remaining_min <= min_runtime:
                decision_on = True
                reason = "deadline_failsafe"

        # Fall 3: Hysterese → Zustand halten
        else:
            decision_on = boiler_on
            reason = "hysteresis_hold"

        # Lesbarer Grund für Logs
        def reason_text():
            if reason == "pv_surplus":
                return f"PV-Überschuss {pv_surplus:.1f} kW"
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
            else:
                return "Kein Einschaltgrund"

        # Entscheidung ausführen
        if decision_on and not boiler_on:
            self.boiler.control("on")
            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change(
                "boiler", False, True,
                reason=f"Automatik: {reason_text()} | {current_temp}°C → Ziel {target_temp}°C | noch {round(remaining_min)}min bis {target_time}"
            )

        elif not decision_on and boiler_on:
            self.boiler.control("off")
            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change(
                "boiler", True, False,
                reason=f"Automatik: {reason_text()} | aktuell {current_temp}°C / Ziel {target_temp}°C"
            )

        self.boiler_last_reason = reason

    # AUTOMATIC – Wallbox 
    def automatic_wallbox(self, forecast):
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
                message=f"Wallbox Online-Check fehlgeschlagen: {e}"
            )
            return

        try:
            data = self.wallbox.fetch_data()
        except Exception as e:
            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="error",
                source="wallbox_automatik",
                message=f"Wallbox Datenabruf fehlgeschlagen: {e}"
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
                    message=f"Ladevorgang beendet: Auto getrennt | "
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
                    message=f"Neue Ladesitzung gestartet: Ziel {target_kwh} kWh bis {target_time} Uhr | "
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
                    reason=f"Automatik: Ladeziel erreicht – {round(charged_kwh, 2)} / {target_kwh} kWh geladen"
                )
                self.wallbox_finished = True
                self.wallbox_last_set_allow = False
            return

        allow = self.wallbox.get_allow_state()

        try:
            pv_surplus = self.pv_service.get_surplus_kw()
        except Exception:
            pv_surplus = 0.0

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

        PV_MIN_KW = 1.4

        # Priorität 1: PV-Überschuss -> dynamisches Laden
        if pv_surplus > 0:
            try:
                pv_data = self.db_bridge.get_latest_pv_data()
                battery_soc = float(pv_data.get("soc", 50))
                battery_power_kw = float(pv_data.get("battery_power_kw", 0))
            except Exception:
                battery_soc = 50
                battery_power_kw = 0

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
                            reason=f"Automatik PV-Dynamik: {pv_surplus:.1f} kW Überschuss | "
                                   f"Batterie: {battery_soc}% ({battery_power_kw:+.1f} kW)"
                        )
                    except Exception as e:
                        # SYSTEM EVENT LOG
                        self.logger.system_event(
                            level="error",
                            source="wallbox_automatik",
                            message=f"Ladestrom setzen fehlgeschlagen ({optimal_ampere}A): {e}"
                        )

                # Laden freigeben wenn noch nicht aktiv
                if not allow:
                    self.wallbox.set_allow_charging(True)
                    # DEVICE STATE CHANGE LOG
                    self.logger.device_state_change(
                        "wallbox", False, True,
                        reason=f"Automatik: PV-Überschuss {pv_surplus:.1f} kW → {optimal_ampere}A | "
                               f"Batterie: {battery_soc}% ({battery_power_kw:+.1f} kW) | {progress_info}"
                    )

                # Stabiles Laden loggen (gedrosselt auf 10min)
                elif allow and optimal_ampere == current_ampere:
                    if (self._last_charging_stable_log is None or
                            (now - self._last_charging_stable_log).total_seconds() > 600):
                        # SYSTEM EVENT LOG
                        self.logger.system_event(
                            level="info",
                            source="wallbox_automatik",
                            message=f"Laden stabil: {optimal_ampere}A | "
                                    f"PV-Überschuss: {pv_surplus:.1f} kW | "
                                    f"Batterie: {battery_soc}% ({battery_power_kw:+.1f} kW) | {progress_info}"
                        )
                        self._last_charging_stable_log = now

                self.wallbox_last_set_allow = True
                return

            # PV vorhanden aber zu wenig
            elif not should_charge:
                if allow:
                    self.wallbox.set_allow_charging(False)
                    # DEVICE STATE CHANGE LOG
                    self.logger.device_state_change(
                        "wallbox", True, False,
                        reason=f"Automatik: PV unzureichend – {charging_decision.get('reason', '?')} | {progress_info}"
                    )
                    self.wallbox_last_set_allow = False
                return

        # Priorität 2+: EPEX Preisanalyse
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
                    message=f"EPEX Notfall-Billigstrom: {epex_stats.get('current')} ct/kWh "
                            f"(Notfall-Schwelle: {round(emergency_threshold, 2) if emergency_threshold else '?'} ct/kWh) | "
                            f"PV-Prognose überstimmt | {progress_info}"
                )
                self.last_epex_log_hour_wallbox = now.hour

            if not allow:
                self.wallbox.set_allow_charging(True)
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    "wallbox", False, True,
                    reason=f"Automatik: EPEX Notfall-Billigstrom {epex_stats.get('current')} ct/kWh "
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
                    message=f"EPEX Strompreis: {epex_stats.get('current')} ct/kWh | "
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
                        reason=f"Automatik: EPEX günstig {epex_stats.get('current')} ct/kWh (kein PV erwartet) | {progress_info}"
                    )
                    self.wallbox_last_set_allow = True
                return

        # Priorität 4: PV erwartet → warten
        if pv_surplus < PV_MIN_KW and (pv_today or pv_tomorrow):
            if epex_stats.get("is_cheap", False):
                if (self.last_forecast_override_log_wallbox is None or
                        (now - self.last_forecast_override_log_wallbox).total_seconds() > 7200):
                    # SYSTEM EVENT LOG
                    self.logger.system_event(
                        level="info",
                        source="wallbox_automatik",
                        message=f"Strom günstig ({epex_stats.get('current')} ct/kWh), aber PV erwartet "
                                f"(heute: {pv_today}, morgen: {pv_tomorrow}) – warte auf PV | {progress_info}"
                    )
                    self.last_forecast_override_log_wallbox = now

            if allow:
                self.wallbox.set_allow_charging(False)
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    "wallbox", True, False,
                    reason=f"Automatik: Warte auf PV (heute: {pv_today}, morgen: {pv_tomorrow}) | {progress_info}"
                )
                self.wallbox_last_set_allow = False
            return

        # Priorität 5: Nacht-Failsafe (Deadline nähert sich)
        if allow_night and remaining_hours <= 2.0 and pv_surplus < PV_MIN_KW and not (pv_today or pv_tomorrow) and not allow:
            self.wallbox.set_allow_charging(True)
            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change(
                "wallbox", False, True,
                reason=f"Automatik: Deadline-Failsafe Netzstrom – "
                       f"noch {round(remaining_hours, 1)}h bis {target_time} | {progress_info}"
            )
            self.wallbox_last_set_allow = True
            return

        # Default: Kein Einschaltgrund → ausschalten
        if allow and self.wallbox_last_set_allow is not True:
            self.wallbox.set_allow_charging(False)
            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change(
                "wallbox", True, False,
                reason=f"Automatik: Kein PV, kein günstiger Strom, keine Prognose | {progress_info}"
            )
            self.wallbox_last_set_allow = False