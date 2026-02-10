import threading
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from stores.system_mode_store import SystemMode
from services.pv_surplus_service import PVSurplusService
from stores.automatic_config_store import AutomaticConfigStore
from services.pv_forecast_service import PVForecastService

class SchedulerService(threading.Thread):
    def __init__(self, mode_store, schedule_manager, boiler, wallbox, db_bridge, logger, interval=20):
        super().__init__(daemon=True)

        self.mode_store = mode_store
        self.schedule_manager = schedule_manager
        self.boiler = boiler
        self.wallbox = wallbox
        self.interval = interval
        self.logger = logger

        self._last_time_controlled_error_ts = None
        self._time_controlled_error_cooldown = 3600

        self.automatic_config = AutomaticConfigStore()
        self.pv_service = PVSurplusService(db_bridge)
        self.pv_forecast = PVForecastService()

        # Wallbox runtime state
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
            # BOILER 
            state = self.boiler.get_state()
            should_on = self.schedule_manager.is_active("boiler")

            if should_on and not state:
                self.boiler.control("on")

                self.logger.control_decision(
                    device="boiler",
                    action="on",
                    reason="time_controlled_schedule",
                    success=True
                )

                self.logger.device_state_change(
                    device="boiler",
                    old_state=False,
                    new_state=True
                )

            elif not should_on and state:
                self.boiler.control("off")

                self.logger.control_decision(
                    device="boiler",
                    action="off",
                    reason="time_controlled_schedule",
                    success=True
                )

                self.logger.device_state_change(
                    device="boiler",
                    old_state=True,
                    new_state=False
                )

            # WALLBOX 
            allow = self.schedule_manager.is_active("wallbox")
            current = self.wallbox.get_allow_state()

            if current is None:
                self.wallbox.set_allow_charging(allow)
                return

            if allow != current:
                self.wallbox.set_allow_charging(allow)

                self.logger.control_decision(
                    device="wallbox",
                    action="set_allow",
                    reason="time_controlled_schedule",
                    success=True,
                    extra={"allow": allow}
                )

                self.logger.device_state_change(
                    device="wallbox",
                    old_state=current,
                    new_state=allow
                )

        except Exception as e:
            self._log_time_controlled_error_throttled(e)

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

        # PV Ist-State
        try:
            pv_surplus = self.pv_service.get_surplus_kw()
            pv_valid = True
        except Exception:
            pv_surplus = 0.0
            pv_valid = False

        # Forecast 
        forecast = self.pv_forecast.get_forecast()
        pv_today = forecast.get("pv_today", False)
        pv_tomorrow = forecast.get("pv_tomorrow", False)

        decision_on = False
        reason = "idle"

        # 1) PV is available 
        if pv_valid and pv_surplus > 0.5:
            decision_on = True
            reason = "pv_surplus"

        # 2) No PV now, but forecast says there will be
        elif pv_today or pv_tomorrow:
            decision_on = False
            reason = "forecast_wait"

        # 3) Deadline-Failsafe
        elif remaining_min <= min_runtime:
            decision_on = True
            reason = "deadline_failsafe"

        #  APPLY + LOG 
        if decision_on and not boiler_on:
            self.boiler.control("on")

            # CONTROL DECISION LOG
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

            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change("boiler", False, True)

        elif not decision_on and boiler_on:
            self.boiler.control("off")

            # CONTROL DECISION LOG
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
            
            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change("boiler", True, False)

        # Optimal Wait-Logging when decided to wait due to forecast but boiler is already off
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

        # RESET on car disconnect
        if not car_connected:
            self.wallbox_eto_start = None
            self.wallbox_finished = False
            return

        # Initial value save 
        if self.wallbox_eto_start is None:
            self.wallbox_eto_start = eto_now
            self.wallbox_finished = False

        # Goal energy in kWh
        target_kwh = float(wb_cfg.get("energy_kwh", 0))
        charged_kwh = max((eto_now - self.wallbox_eto_start) / 1000, 0)

        # Goal reached
        if charged_kwh >= target_kwh:
            if not self.wallbox_finished:
                self.wallbox.set_allow_charging(False)

                # CONTROL DECISION LOG
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

        # Current allow state
        allow = self.wallbox.get_allow_state()

        # PV Ist-State
        try:
            pv_surplus = self.pv_service.get_surplus_kw()
        except Exception:
            pv_surplus = 0.0

        PV_MIN_KW = 1.4

        # Forecast
        forecast = self.pv_forecast.get_forecast()
        pv_today = forecast.get("pv_today", False)
        pv_tomorrow = forecast.get("pv_tomorrow", False)

        # Deadline 
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

        # Desicion logic:

        # 1) PV-surplus -> allow charging
        if pv_surplus >= PV_MIN_KW and not allow:
            self.wallbox.set_allow_charging(True)

            # CONTROL DECISION LOG
            self.logger.control_decision(
                device="wallbox",
                action="set_allow",
                reason="automatic_pv_surplus",
                success=True,
                extra={"pv_surplus_kw": pv_surplus}
            )
            self.logger.device_state_change("wallbox", False, True)
            return

        # 2) No PV, but forecast says there will be -> wait (don't allow charging)
        if pv_surplus < PV_MIN_KW and (pv_today or pv_tomorrow):
            if allow:
                self.wallbox.set_allow_charging(False)

                # CONTROL DECISION LOG
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

        # 3) Deadline-Failsafe: No PV, no good forecast and deadline is close -> allow charging if not already allowed (optionally only if allow_night_grid is set)
        if allow_night and remaining_hours <= 2.0 and not allow:
            self.wallbox.set_allow_charging(True)
            
            # CONTROL DECISION LOG
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

        # 4) Else: loading off 
        if allow:
            self.wallbox.set_allow_charging(False)
            self.logger.device_state_change("wallbox", True, False)

    def _log_time_controlled_error_throttled(self, error: Exception):
        now = time.time()

        if (  self._last_time_controlled_error_ts is None  or now - self._last_time_controlled_error_ts > self._time_controlled_error_cooldown ):

            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="error",
                source="TIME_CONTROLLED",
                message=f"TIME_CONTROLLED error: {error}"
            )
            self._last_time_controlled_error_ts = now
