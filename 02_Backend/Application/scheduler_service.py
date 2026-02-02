import threading
import time
from system_mode import SystemMode


class SchedulerService(threading.Thread):
    def __init__(
        self,
        mode_store,
        schedule_manager,
        boiler,
        wallbox,
        interval=30
    ):
        super().__init__(daemon=True)
        self.mode_store = mode_store
        self.schedule_manager = schedule_manager
        self.boiler = boiler
        self.wallbox = wallbox
        self.interval = interval

    def run(self):
        while True:
            self.tick()
            time.sleep(self.interval)

    def tick(self):
        if self.mode_store.get() != SystemMode.TIME_CONTROLLED:
            return

        # ---- Boiler ----
        state = self.boiler.get_state()
        should_on = self.schedule_manager.is_active("boiler")

        if should_on and not state:
            self.boiler.control("on")
        elif not should_on and state:
            self.boiler.control("off")

        # ---- Wallbox ----
        allow = self.schedule_manager.is_active("wallbox")
        self.wallbox.set_allow_charging(allow)
