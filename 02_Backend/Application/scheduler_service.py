import threading
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from system_mode import SystemMode
from pv_surplus_service import PVSurplusService
from automatic_config_store import AutomaticConfigStore
from pv_forecast_service import PVForecastService

class SchedulerService(threading.Thread):
    def __init__(
        self,
        mode_store,
        schedule_manager,
        boiler,
        wallbox,
        db_bridge,
        logger,
        interval=20
    ):
        super().__init__(daemon=True)

        self.mode_store = mode_store
        self.schedule_manager = schedule_manager
        self.boiler = boiler
        self.wallbox = wallbox
        self.interval = interval
        self.logger = logger

        self.pv_service = PVSurplusService(db_bridge)
        self.pv_forecast = PVForecastService()

        # --- Wallbox runtime state ---
        self.wallbox_eto_start = None
        self.wallbox_finished = False

    def run(self):
        while True:
            self.tick()
            time.sleep(self.interval)

    def tick(self):
        try:
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
            self.logger.system_event(
                level="error",
                source="scheduler",
                message=f"AUTOMATIC scheduler error: {e}"
            )

    # TIME CONTROLLED
    def run_time_controlled(self):
        try:
            state = self.boiler.get_state()
            should_on = self.schedule_manager.is_active("boiler")

            if should_on and not state:
                self.boiler.control("on")
            elif not should_on and state:
                self.boiler.control("off")

            allow = self.schedule_manager.is_active("wallbox")
            self.wallbox.set_allow_charging(allow)

        except Exception:
            return

    # AUTOMATIC
    def run_automatic(self):
        self._automatic_boiler()
        self._automatic_wallbox()

    # AUTOMATIC – Boiler
    def _automatic_boiler(self):
        config = self.automatic_config.get()
        boiler_cfg = config.get("boiler", {})

        if not boiler_cfg.get("enabled", False):
            return

        target_time = boiler_cfg.get("target_time")
        if not target_time:
            return

        try:
            boiler_on = self.boiler.get_state()
        except Exception:
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
        min_runtime = int(boiler_cfg.get("min_runtime_min", 90))

        # ---- PV Ist-Zustand ----
        try:
            pv_surplus = self.pv_service.get_surplus_kw()
            pv_valid = True
        except Exception:
            pv_surplus = 0.0
            pv_valid = False

        # ---- Forecast ----
        forecast = self.pv_forecast.get_forecast()
        pv_today = forecast.get("pv_today", False)
        pv_tomorrow = forecast.get("pv_tomorrow", False)

        decision_on = False
        reason = "idle"

        # 1) PV jetzt verfügbar
        if pv_valid and pv_surplus > 0.5:
            decision_on = True
            reason = "pv_surplus"

        # 2) Keine PV jetzt, aber erwartet -> warten
        elif pv_today or pv_tomorrow:
            decision_on = False
            reason = "forecast_wait"

        # 3) Deadline-Failsafe
        elif remaining_min <= min_runtime:
            decision_on = True
            reason = "deadline_failsafe"

        # ---- APPLY + LOG ----
        if decision_on and not boiler_on:
            self.boiler.control("on")

            self.logger.control_decision(
                device="boiler",
                action="on",
                reason=f"automatic_{reason}",
                success=True,
                extra={
                    "pv_surplus_kw": pv_surplus,
                    "remaining_min": round(remaining_min, 1),
                    "pv_today": pv_today,
                    "pv_tomorrow": pv_tomorrow
                }
            )

            self.logger.device_state_change("boiler", False, True)

        elif not decision_on and boiler_on:
            self.boiler.control("off")

            self.logger.control_decision(
                device="boiler",
                action="off",
                reason="automatic_wait",
                success=True,
                extra={
                    "pv_surplus_kw": pv_surplus,
                    "remaining_min": round(remaining_min, 1),
                    "pv_today": pv_today,
                    "pv_tomorrow": pv_tomorrow
                }
            )

            self.logger.device_state_change("boiler", True, False)

        # Optionales WAIT-Logging (nur wenn wirklich gewartet wird)
        elif not decision_on and not boiler_on and reason == "forecast_wait":
            self.logger.control_decision(
                device="boiler",
                action="wait",
                reason="automatic_forecast_wait",
                success=True,
                extra={
                    "remaining_min": round(remaining_min, 1),
                    "pv_today": pv_today,
                    "pv_tomorrow": pv_tomorrow
                }
            )


    # AUTOMATIC – Wallbox 
    def _automatic_wallbox(self):
        config = self.automatic_config.get()
        wb_cfg = config.get("wallbox", {})

        if not wb_cfg.get("enabled", False):
            return

        try:
            data = self.wallbox.fetch_data()
        except Exception:
            return

        car_connected = data.get("car") == 1
        eto_now = data.get("eto")  # Wh

        # --- Reset bei Abstecken ---
        if not car_connected:
            self.wallbox_eto_start = None
            self.wallbox_finished = False
            return

        # --- Initialwert merken ---
        if self.wallbox_eto_start is None:
            self.wallbox_eto_start = eto_now
            self.wallbox_finished = False

        # --- Zielenergie ---
        target_kwh = float(wb_cfg.get("energy_kwh", 0))
        charged_kwh = max((eto_now - self.wallbox_eto_start) / 1000, 0)

        # --- Ziel erreicht ---
        if charged_kwh >= target_kwh:
            if not self.wallbox_finished:
                self.wallbox.set_allow_charging(False)

                self.logger.control_decision(
                    device="wallbox",
                    action="set_allow",
                    reason="automatic_target_reached",
                    success=True,
                    extra={"charged_kwh": round(charged_kwh, 2)}
                )

                self.logger.device_state_change("wallbox", True, False)
                self.wallbox_finished = True
            return

        # --- Aktueller Zustand ---
        allow = self.wallbox.get_allow_state()

        # --- PV Ist-Zustand ---
        try:
            pv_surplus = self.pv_service.get_surplus_kw()
        except Exception:
            pv_surplus = 0.0

        PV_MIN_KW = 1.4

        # --- Forecast ---
        forecast = self.pv_forecast.get_forecast()
        pv_today = forecast.get("pv_today", False)
        pv_tomorrow = forecast.get("pv_tomorrow", False)

        # --- Deadline ---
        target_time = wb_cfg.get("target_time")
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

        # ---------- ENTSCHEIDUNGEN ----------

        # 1) PV-Überschuss → laden
        if pv_surplus >= PV_MIN_KW and not allow:
            self.wallbox.set_allow_charging(True)

            self.logger.control_decision(
                device="wallbox",
                action="set_allow",
                reason="automatic_pv_surplus",
                success=True,
                extra={"pv_surplus_kw": pv_surplus}
            )
            self.logger.device_state_change("wallbox", False, True)
            return

        # 2) Keine PV, aber Forecast → warten
        if pv_surplus < PV_MIN_KW and (pv_today or pv_tomorrow):
            if allow:
                self.wallbox.set_allow_charging(False)

                self.logger.control_decision(
                    device="wallbox",
                    action="set_allow",
                    reason="automatic_forecast_wait",
                    success=True,
                    extra={
                        "pv_today": pv_today,
                        "pv_tomorrow": pv_tomorrow
                    }
                )
                self.logger.device_state_change("wallbox", True, False)
            return

        # 3) Deadline-Failsafe mit Netzladung
        if allow_night and remaining_hours <= 2.0 and not allow:
            self.wallbox.set_allow_charging(True)

            self.logger.control_decision(
                device="wallbox",
                action="set_allow",
                reason="automatic_night_grid_failsafe",
                success=True,
                extra={
                    "remaining_hours": round(remaining_hours, 2),
                    "charged_kwh": round(charged_kwh, 2)
                }
            )
            self.logger.device_state_change("wallbox", False, True)
            return

        # 4) Sonst: Laden aus
        if allow:
            self.wallbox.set_allow_charging(False)
            self.logger.device_state_change("wallbox", True, False)
