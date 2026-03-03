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

    # Main loop of the scheduler thread, which calls tick() every interval seconds
    def run(self):
        while True:
            self.tick()
            time.sleep(self.interval)

    # Log time-controlled mode errors (throttled to once per day)
    def log_time_controlled_error(self, error):
        now = datetime.now(ZoneInfo("Europe/Vienna"))
        today = now.date()
        
        # Only log once per day
        if self.last_time_controlled_error_date != today:
            self.logger.system_event(
                level="error",
                source="scheduler_time_controlled",
                message=f"TIME_CONTROLLED mode error: {error}"
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

                # CONTROL DECISION LOG
                self.logger.control_decision(
                    device="boiler",
                    action="on",
                    reason="time_controlled_schedule",
                    success=True
                )

                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    device="boiler",
                    old_state=False,
                    new_state=True
                )

            elif not should_on and state:
                self.boiler.control("off")

                # CONTROL DECISION LOG
                self.logger.control_decision(
                    device="boiler",
                    action="off",
                    reason="time_controlled_schedule",
                    success=True
                )

                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    device="boiler",
                    old_state=True,
                    new_state=False
                )

            # WALLBOX 
            current = self.wallbox.get_allow_state()
            should_allow = self.schedule_manager.is_active("wallbox")
            online = self.wallbox.is_online()

            if not online:
                return

            if current is None:
                return

            if should_allow and not current:
                self.wallbox.set_allow_charging(True)

                # CONTROL DECISION LOG
                self.logger.control_decision(
                    device="wallbox",
                    action="set_allow",
                    reason="time_controlled_schedule",
                    success=True,
                    extra={"allow": True}
                )

                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    device="wallbox",
                    old_state=False,
                    new_state=True
                )

            elif not should_allow and current:
                self.wallbox.set_allow_charging(False)

                # CONTROL DECISION LOG
                self.logger.control_decision(
                    device="wallbox",
                    action="set_allow",
                    reason="time_controlled_schedule",
                    success=True,
                    extra={"allow": False}
                )

                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change(
                    device="wallbox",
                    old_state=True,
                    new_state=False
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
        # Load configuration
        config = self.automatic_config.get()
        season = self.schedule_manager.determine_season()
        boiler_cfg = config.get("boiler", {}).get(season, {})
        
        target_time = boiler_cfg.get("target_time")
        target_temp = boiler_cfg.get("target_temp_c")
        min_runtime = int(boiler_cfg.get("min_runtime_min", 90)) if boiler_cfg.get("min_runtime_min") else 90
        
        if not target_time or target_temp is None:
            return
        
        # Read current state
        try:
            boiler_on = self.boiler.get_state()
            boiler_data = self.db_bridge.get_latest_boiler_data()
            current_temp = boiler_data.get("boiler_temp") if boiler_data else None
        except Exception:
            return
        
        if current_temp is None:
            return
        
        # Calculate time to deadline
        now = datetime.now(ZoneInfo("Europe/Vienna"))
        deadline = datetime.combine(now.date(), datetime.strptime(target_time, "%H:%M").time(), tzinfo=ZoneInfo("Europe/Vienna"))
        if deadline < now:
            deadline += timedelta(days=1)
        remaining_min = (deadline - now).total_seconds() / 60
        
        # Session start log (once per day)
        if self.boiler_session_logged_date != now.date():
            self.logger.system_event(
                level="info",
                source="boiler_session",
                message=f"Boiler AUTOMATIC session start: temp={current_temp}°C target={target_temp}°C "
                       f"deadline={target_time} min_runtime={min_runtime}min season={season}"
            )
            self.boiler_session_logged_date = now.date()
        
        # Prepare logging data
        extra = {
            "current_temp": current_temp,
            "target_temp": target_temp,
            "remaining_min": round(remaining_min, 1)
        }
        
        # Decision logic
        HYSTERESIS = 2  # °C
        decision_on = False
        reason = "idle"
        
        # Case 1: Target temperature reached
        if current_temp >= target_temp:
            decision_on = False
            reason = "target_temp_reached"
        
        # Case 2: Temperature below target - heating needed
        elif current_temp <= target_temp - HYSTERESIS:
            
            # Get current PV state
            try:
                pv_surplus = self.pv_service.get_surplus_kw()
                pv_valid = True
            except Exception:
                pv_surplus = 0.0
                pv_valid = False
            
            # Get forecast
            pv_today = forecast.get("pv_today", False)
            pv_tomorrow = forecast.get("pv_tomorrow", False)
            
            # Priority 1: PV-Surplus available
            if pv_valid and pv_surplus > 0.5:
                decision_on = True
                reason = "pv_surplus"
            
            # Priority 2+: EPEX price check
            else:
                epex_stats = self.epex_service.get_price_statistics()
                is_emergency_cheap = epex_stats.get("is_emergency_cheap", False)
                emergency_threshold = epex_stats.get("emergency_threshold")
                
                # Priority 2: EPEX emergency cheap (overrides forecast)
                if is_emergency_cheap:
                    
                    # EPEX decision log
                    if (self.last_epex_log_hour_boiler is None or 
                        (now.hour - self.last_epex_log_hour_boiler) >= 2 or 
                        (now.hour < self.last_epex_log_hour_boiler)):
                        # SYSTEM EVENT LOG
                        self.logger.system_event(
                            level="info",
                            source="epex_decision_boiler",
                            message=f"EPEX Analysis: current={epex_stats.get('current')} "
                                   f"threshold={epex_stats.get('threshold')} "
                                   f"emergency_threshold={round(emergency_threshold, 2) if emergency_threshold else None} "
                                   f"is_cheap={epex_stats.get('is_cheap')} "
                                   f"is_emergency={is_emergency_cheap} "
                                   f"14d_range=[{epex_stats.get('min')}-{epex_stats.get('max')}] "
                                   f"avg={epex_stats.get('avg')}"
                        )
                        self.last_epex_log_hour_boiler = now.hour
                    
                    decision_on = True
                    reason = "epex_emergency_cheap"
                    extra.update({
                        "epex_current": epex_stats.get("current"),
                        "epex_threshold": epex_stats.get("threshold"),
                        "epex_emergency_threshold": round(emergency_threshold, 2) if emergency_threshold else None,
                        "epex_avg": epex_stats.get("avg"),
                        "epex_14d_min": epex_stats.get("min"),
                        "epex_14d_max": epex_stats.get("max"),
                        "forecast_overridden": pv_today or pv_tomorrow
                    })
                
                # Priority 3: EPEX regular cheap (no forecast blocking)
                elif not (pv_today or pv_tomorrow):
                    
                    # EPEX decision log
                    if (self.last_epex_log_hour_boiler is None or 
                        (now.hour - self.last_epex_log_hour_boiler) >= 2 or 
                        (now.hour < self.last_epex_log_hour_boiler)):
                        
                        self.logger.system_event(
                            level="info",
                            source="epex_decision_boiler",
                            message=f"EPEX Analysis: current={epex_stats.get('current')} "
                                   f"threshold={epex_stats.get('threshold')} "
                                   f"emergency_threshold={round(emergency_threshold, 2) if emergency_threshold else None} "
                                   f"is_cheap={epex_stats.get('is_cheap')} "
                                   f"is_emergency={is_emergency_cheap} "
                                   f"14d_range=[{epex_stats.get('min')}-{epex_stats.get('max')}] "
                                   f"avg={epex_stats.get('avg')}"
                        )
                        self.last_epex_log_hour_boiler = now.hour
                    
                    if epex_stats.get("is_cheap", False):
                        decision_on = True
                        reason = "epex_cheap"
                        extra.update({
                            "epex_current": epex_stats.get("current"),
                            "epex_threshold": epex_stats.get("threshold"),
                            "epex_avg": epex_stats.get("avg"),
                            "epex_14d_min": epex_stats.get("min"),
                            "epex_14d_max": epex_stats.get("max")
                        })
                    elif remaining_min <= min_runtime:
                        decision_on = True
                        reason = "deadline_failsafe"
                    else:
                        decision_on = False
                        reason = "wait"
                
                # Priority 4: Forecast predicts PV - wait
                else:
                    decision_on = False
                    reason = "forecast_wait"
                    
                    # Forecast override log
                    if epex_stats.get("is_cheap", False):
                        if (self.last_forecast_override_log_boiler is None or 
                            (now - self.last_forecast_override_log_boiler).total_seconds() > 7200):
                            
                            self.logger.system_event(
                                level="info",
                                source="forecast_override_boiler",
                                message=f"EPEX cheap (current={epex_stats.get('current')} "
                                       f"threshold={epex_stats.get('threshold')}) but waiting for PV forecast "
                                       f"(pv_today={pv_today}, pv_tomorrow={pv_tomorrow}). "
                                       f"Not emergency cheap (> {round(emergency_threshold, 2) if emergency_threshold else 'N/A'})."
                            )
                            self.last_forecast_override_log_boiler = now
            
            # Failsafe: Deadline approaching
            if not decision_on and remaining_min <= min_runtime:
                decision_on = True
                reason = "deadline_failsafe"
        
        # Case 3: Hysteresis window - maintain current state
        else:
            decision_on = boiler_on
            reason = "hysteresis_hold"
        
        # Execute decision
        if decision_on and not boiler_on:
            self.boiler.control("on")
            self.logger.control_decision(
                device="boiler",
                action="on",
                reason=f"automatic_{reason}",
                success=True,
                extra=extra
            )
            self.logger.device_state_change("boiler", False, True)
        
        elif not decision_on and boiler_on:
            self.boiler.control("off")
            log_action = "target_reached" if reason == "target_temp_reached" else "off"
            self.logger.control_decision(
                device="boiler",
                action=log_action,
                reason=f"automatic_{reason}",
                success=True,
                extra=extra
            )
            self.logger.device_state_change("boiler", True, False)
        
        elif not decision_on and not boiler_on and reason == "forecast_wait":
            if self.boiler_last_reason != "forecast_wait":
                self.logger.control_decision(
                    device="boiler",
                    action="wait",
                    reason="automatic_forecast_wait",
                    success=True,
                    extra=extra
                )
        
        self.boiler_last_reason = reason

    # AUTOMATIC – Wallbox 
    def automatic_wallbox(self, forecast): 
        # Load configuration
        config = self.automatic_config.get()
        season = self.schedule_manager.determine_season()
        wb_cfg = config.get("wallbox", {}).get(season, {})
        
        if not self.wallbox:
            return
        
        # Check wallbox online status
        try:
            if hasattr(self.wallbox, "is_online") and not self.wallbox.is_online():
                return
        except Exception as e:
            self.logger.system_event(
                level="error",
                source="scheduler",
                message=f"automatic_wallbox: Wallbox online-check failed: {e}"
            )
            return
        
        # Fetch wallbox data
        try:
            data = self.wallbox.fetch_data()
        except Exception as e:
            self.logger.system_event(
                level="error",
                source="scheduler",
                message=f"automatic_wallbox: Failed to fetch wallbox data: {e}"
            )
            return
        
        car_connected = data.get("car_connected") == 1
        eto_now = data.get("eto")  # Energy counter in Wh
        
        if eto_now is None:
            return
        
        # Handle car disconnect - reset session
        if not car_connected:
            if self.wallbox_eto_start is not None:
                target_kwh = float(wb_cfg.get("energy_kwh", 0))
                charged_kwh = max((eto_now - self.wallbox_eto_start) / 1000, 0)
                target_reached = charged_kwh >= target_kwh
                
                self.logger.control_decision(
                    device="wallbox",
                    action="session_ended",
                    reason="car_disconnected",
                    success=target_reached,
                    extra={
                        "charged_kwh": round(charged_kwh, 2),
                        "target_kwh": target_kwh,
                        "target_reached": target_reached
                    }
                )
                # DEVICE STATE CHANGE LOG (if had set allow to True during session, log the change to False on disconnect)
                self.wallbox_eto_start = None
                self.wallbox_finished = False
                self.wallbox_last_set_allow = None
                self.wallbox_session_logged = False
            return
        
        # Initialize session on car connect
        if self.wallbox_eto_start is None:
            self.wallbox_eto_start = eto_now
            self.wallbox_finished = False
            
            # Session start log (once per session)
            if not self.wallbox_session_logged:
                target_kwh = float(wb_cfg.get("energy_kwh", 0))
                target_time = wb_cfg.get("target_time")
                
                # SYSTEM EVENT LOG
                self.logger.system_event(
                    level="info",
                    source="wallbox_session",
                    message=f"Wallbox session start: target={target_kwh}kWh deadline={target_time} season={season}"
                )
                
                # Also use control_decision for better tracking
                self.logger.control_decision(
                    device="wallbox",
                    action="session_start",
                    reason="car_connected",
                    success=True,
                    extra={
                        "target_kwh": target_kwh,
                        "eto_start": eto_now / 1000,  # In kWh
                        "deadline": target_time,
                        "season": season
                    }
                )
                
                self.wallbox_session_logged = True
        
        # Calculate charging progress
        target_kwh = float(wb_cfg.get("energy_kwh", 0))
        charged_kwh = max((eto_now - self.wallbox_eto_start) / 1000, 0)
        
        # Check if charging goal reached
        if charged_kwh >= target_kwh:
            if not self.wallbox_finished:
                self.wallbox.set_allow_charging(False)
                self.logger.control_decision(
                    device="wallbox",
                    action="session_complete",
                    reason="automatic_target_reached",
                    success=True,
                    extra={
                        "charged_kwh": round(charged_kwh, 2),
                        "target_kwh": target_kwh
                    }
                )
                self.logger.device_state_change("wallbox", True, False)
                self.wallbox_finished = True
                self.wallbox_last_set_allow = False
            return
        
        # Get current state and inputs
        allow = self.wallbox.get_allow_state()
        
        try:
            pv_surplus = self.pv_service.get_surplus_kw()
        except Exception:
            pv_surplus = 0.0
        
        pv_today = forecast.get("pv_today", False)
        pv_tomorrow = forecast.get("pv_tomorrow", False)
        
        # Get deadline configuration
        target_time = wb_cfg.get("target_time")
        if not target_time:
            return
        
        allow_night = wb_cfg.get("allow_night_grid", False)
        
        # Calculate time to deadline
        now = datetime.now(ZoneInfo("Europe/Vienna"))
        deadline = datetime.combine(now.date(), datetime.strptime(target_time, "%H:%M").time(), tzinfo=ZoneInfo("Europe/Vienna"))
        if deadline < now:
            deadline += timedelta(days=1)
        remaining_hours = (deadline - now).total_seconds() / 3600
        
        # Decision logic
        PV_MIN_KW = 1.4
        
          # Priority 1: PV-Surplus mit dynamischem Laden
        if pv_surplus > 0: # Any surplus is a good sign --> indicates generation and can be used for dynamic charging decisions
            
            # Battery-Data for dynamic charging decision
            try:
                pv_data = self.db_bridge.get_latest_pv_data()
                battery_soc = float(pv_data.get("soc", 50))
                battery_power_kw = float(pv_data.get("battery_power_kw", 0))
            except Exception:
                battery_soc = 50
                battery_power_kw = 0
            
            # Get current ampere
            try:
                current_ampere = self.wallbox.get_current_ampere()
            except Exception:
                current_ampere = 0
            
            # Dynamic Charging calculation
            charging_decision = self.wallbox_dynamic.get_charging_decision(
                pv_surplus_kw=pv_surplus,
                battery_power_kw=battery_power_kw,
                battery_soc=battery_soc,
                current_ampere=current_ampere
            )
            
            # Apply dynamic charging decision
            optimal_ampere = charging_decision['ampere']
            should_charge = charging_decision['allow_charging']
            
            # When loading recommended
            if should_charge and optimal_ampere > 0:
                
                # Set amperage (if changed)
                if optimal_ampere != current_ampere:
                    try:
                        self.wallbox.set_charging_ampere(optimal_ampere)
                        # CONTROL DECISION LOG
                        self.logger.control_decision(
                            device="wallbox",
                            action="set_ampere",
                            reason="automatic_pv_dynamic",
                            success=True,
                            extra={
                                "ampere": optimal_ampere,
                                "pv_surplus_kw": pv_surplus,
                                "battery_soc": battery_soc,
                                "battery_power_kw": battery_power_kw
                            }
                        )
                        # DEVICE STATE CHANGE LOG
                        self.logger.device_state_change("wallbox_ampere", current_ampere, optimal_ampere)
                    except Exception as e:
                        # SYSTEM EVENT LOG
                        self.logger.system_event(
                            level="error",
                            source="scheduler",
                            message=f"Failed to set wallbox ampere: {e}"
                        )
                
                # Enable charging (if off)
                if not allow:
                    self.wallbox.set_allow_charging(True)
                    # CONTROL DECISION LOG
                    self.logger.control_decision(
                        device="wallbox",
                        action="set_allow",
                        reason="automatic_pv_surplus_dynamic",
                        success=True,
                        extra=charging_decision
                    )
                    # DEVICE STATE CHANGE LOG
                    self.logger.device_state_change("wallbox", False, True)
                
                # Log even when charging is already underway and amperage is stable (throttled to 10 min)
                elif allow and optimal_ampere == current_ampere:
                    now_stable = datetime.now(ZoneInfo("Europe/Vienna"))
                    
                    # Initialize throttle variable if not exists
                    if not hasattr(self, '_last_charging_stable_log'):
                        self._last_charging_stable_log = None
                    
                    # Log only every 10 minutes to avoid spam
                    if (self._last_charging_stable_log is None or 
                        (now_stable - self._last_charging_stable_log).total_seconds() > 600):
                        
                        # CONTROL DECISION LOG
                        self.logger.control_decision(
                            device="wallbox",
                            action="charging_stable",
                            reason="automatic_pv_dynamic_continuing",
                            success=True,
                            extra={
                                "ampere": optimal_ampere,
                                "pv_surplus_kw": pv_surplus,
                                "battery_soc": battery_soc,
                                "battery_power_kw": battery_power_kw
                            }
                        )
                        self._last_charging_stable_log = now_stable
                
                self.wallbox_last_set_allow = True
                return
            
            # If not enough PV despite surplus
            elif not should_charge:
                if allow:
                    self.wallbox.set_allow_charging(False)
                    # CONTROL DECISION LOG
                    self.logger.control_decision(
                        device="wallbox",
                        action="set_allow",
                        reason="automatic_insufficient_pv_dynamic",
                        success=True,
                        extra=charging_decision
                    )
                    # DEVICE STATE CHANGE LOG
                    self.logger.device_state_change("wallbox", True, False)
                    self.wallbox_last_set_allow = False
                return
        
        # Priority 2+: EPEX price check
        epex_stats = self.epex_service.get_price_statistics()
        is_emergency_cheap = epex_stats.get("is_emergency_cheap", False)
        emergency_threshold = epex_stats.get("emergency_threshold")
        
        # Priority 2: EPEX emergency cheap (overrides forecast)
        if is_emergency_cheap:
            
            # EPEX decision log
            if (self.last_epex_log_hour_wallbox is None or 
                (now.hour - self.last_epex_log_hour_wallbox) >= 2 or 
                (now.hour < self.last_epex_log_hour_wallbox)):
                
                # SYSTEM EVENT LOG
                self.logger.system_event(
                    level="info",
                    source="epex_decision_wallbox",
                    message=f"EPEX Analysis: current={epex_stats.get('current')} "
                           f"threshold={epex_stats.get('threshold')} "
                           f"emergency_threshold={round(emergency_threshold, 2) if emergency_threshold else None} "
                           f"is_cheap={epex_stats.get('is_cheap')} "
                           f"is_emergency={is_emergency_cheap} "
                           f"14d_range=[{epex_stats.get('min')}-{epex_stats.get('max')}] "
                           f"avg={epex_stats.get('avg')}"
                )
                self.last_epex_log_hour_wallbox = now.hour
            
            if not allow:
                self.wallbox.set_allow_charging(True)
                # CONTROL DECISION LOG
                self.logger.control_decision(
                    device="wallbox",
                    action="set_allow",
                    reason="automatic_epex_emergency_cheap",
                    success=True,
                    extra={
                        "epex_current": epex_stats.get("current"),
                        "epex_threshold": epex_stats.get("threshold"),
                        "epex_emergency_threshold": round(emergency_threshold, 2) if emergency_threshold else None,
                        "epex_avg": epex_stats.get("avg"),
                        "epex_14d_min": epex_stats.get("min"),
                        "epex_14d_max": epex_stats.get("max"),
                        "forecast_overridden": pv_today or pv_tomorrow
                    }
                )
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change("wallbox", False, True)
                self.wallbox_last_set_allow = True
            return
        
        # Priority 3: EPEX regular cheap (no forecast blocking)
        if not (pv_today or pv_tomorrow):
            
            # EPEX decision log
            if (self.last_epex_log_hour_wallbox is None or 
                (now.hour - self.last_epex_log_hour_wallbox) >= 2 or 
                (now.hour < self.last_epex_log_hour_wallbox)):
                
                # SYSTEM EVENT LOG
                self.logger.system_event(
                    level="info",
                    source="epex_decision_wallbox",
                    message=f"EPEX Analysis: current={epex_stats.get('current')} "
                           f"threshold={epex_stats.get('threshold')} "
                           f"emergency_threshold={round(emergency_threshold, 2) if emergency_threshold else None} "
                           f"is_cheap={epex_stats.get('is_cheap')} "
                           f"is_emergency={is_emergency_cheap} "
                           f"14d_range=[{epex_stats.get('min')}-{epex_stats.get('max')}] "
                           f"avg={epex_stats.get('avg')}"
                )
                self.last_epex_log_hour_wallbox = now.hour
            
            if epex_stats.get("is_cheap", False):
                if not allow:
                    self.wallbox.set_allow_charging(True)
                    # CONTROL DECISION LOG
                    self.logger.control_decision(
                        device="wallbox",
                        action="set_allow",
                        reason="automatic_epex_cheap",
                        success=True,
                        extra={
                            "epex_current": epex_stats.get("current"),
                            "epex_threshold": epex_stats.get("threshold"),
                            "epex_avg": epex_stats.get("avg"),
                            "epex_14d_min": epex_stats.get("min"),
                            "epex_14d_max": epex_stats.get("max")
                        }
                    )
                    # DEVICE STATE CHANGE LOG
                    self.logger.device_state_change("wallbox", False, True)
                    self.wallbox_last_set_allow = True
                return
        
        # Priority 4: Forecast predicts PV - wait
        if pv_surplus < PV_MIN_KW and (pv_today or pv_tomorrow):
            
            # Forecast override log
            if epex_stats.get("is_cheap", False):
                if (self.last_forecast_override_log_wallbox is None or 
                    (now - self.last_forecast_override_log_wallbox).total_seconds() > 7200):
                    
                    # SYSTEM EVENT LOG
                    self.logger.system_event(
                        level="info",
                        source="forecast_override_wallbox",
                        message=f"EPEX cheap (current={epex_stats.get('current')} "
                               f"threshold={epex_stats.get('threshold')}) but waiting for PV forecast "
                               f"(pv_today={pv_today}, pv_tomorrow={pv_tomorrow}). "
                               f"Charged: {round(charged_kwh, 2)}/{target_kwh}kWh, "
                               f"remaining: {round(remaining_hours, 1)}h. "
                               f"Not emergency cheap (> {round(emergency_threshold, 2) if emergency_threshold else 'N/A'})."
                    )
                    self.last_forecast_override_log_wallbox = now
            
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
                # DEVICE STATE CHANGE LOG
                self.logger.device_state_change("wallbox", allow, False)
                self.wallbox_last_set_allow = False
            return
        
        # Priority 5: Night grid failsafe (deadline approaching)
        if allow_night and remaining_hours <= 2.0 and pv_surplus < PV_MIN_KW and not (pv_today or pv_tomorrow) and not allow:
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
            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change("wallbox", False, True)
            self.wallbox_last_set_allow = True
            return
        
        # Default: Turn off if no conditions met
        if allow and self.wallbox_last_set_allow is not True:
            self.wallbox.set_allow_charging(False)
            # CONTROL DECISION LOG
            self.logger.control_decision(
                device="wallbox",
                action="set_allow",
                reason="automatic_no_pv_no_forecast",
                success=True,
                extra={
                    "pv_surplus_kw": pv_surplus,
                    "pv_today": pv_today,
                    "pv_tomorrow": pv_tomorrow
                }
            )
            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change("wallbox", True, False)
            self.wallbox_last_set_allow = False