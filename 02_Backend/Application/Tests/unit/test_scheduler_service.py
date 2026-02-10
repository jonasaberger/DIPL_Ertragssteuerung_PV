from services.scheduler_service import SchedulerService
from stores.system_mode_store import SystemMode, SystemModeStore
from managers.schedule_manager import ScheduleManager


# FAKES

class FakeLogger:
    def system_event(self, *a, **k): pass
    def control_decision(self, *a, **k): pass
    def device_state_change(self, *a, **k): pass


class FakeDB:
    def get_latest_pv_data(self):
        return None


class FakeBoiler:
    def __init__(self):
        self.state = False

    def get_state(self):
        return self.state

    def control(self, action):
        self.state = (action == "on")


class FakeWallbox:
    def __init__(self):
        self.allow = None

    def set_allow_charging(self, allow):
        self.allow = allow

    def get_allow_state(self):
        return self.allow


class FakeScheduleStore:
    def get_effective(self):
        return {
            "boiler": {"winter": {"start": "00:00", "end": "23:59"}},
            "wallbox": {"winter": {"start": "00:00", "end": "23:59"}},
        }



# Tests if the SchedulerService correctly controls the boiler and wallbox based on the schedule and current system mode
def test_scheduler_controls_devices():
    mode = SystemModeStore()
    mode.set(SystemMode.TIME_CONTROLLED)

    boiler = FakeBoiler()
    wallbox = FakeWallbox()

    sm = ScheduleManager(FakeScheduleStore())
    sm.determine_season = lambda: "winter"

    scheduler = SchedulerService(
        mode_store=mode,
        schedule_manager=sm,
        boiler=boiler,
        wallbox=wallbox,
        db_bridge=FakeDB(),     
        logger=FakeLogger(),     
        interval=1
    )

    scheduler.tick()

    assert boiler.state is True
    assert wallbox.allow is True
