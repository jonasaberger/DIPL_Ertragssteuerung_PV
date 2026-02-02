from scheduler_service import SchedulerService
from system_mode import SystemMode, SystemModeStore
from schedule_manager import ScheduleManager


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


class FakeScheduleStore:
    def get_effective(self):
        return {
            "boiler": {"winter": {"start": "00:00", "end": "23:59"}},
            "wallbox": {"winter": {"start": "00:00", "end": "00:00"}},
        }


def test_scheduler_controls_devices():
    mode = SystemModeStore()
    mode.set(SystemMode.TIME_CONTROLLED)

    boiler = FakeBoiler()
    wallbox = FakeWallbox()

    sm = ScheduleManager(FakeScheduleStore())
    sm.determine_season = lambda: "winter"

    scheduler = SchedulerService(mode, sm, boiler, wallbox)
    scheduler.tick()

    assert boiler.state is True
    assert wallbox.allow is False
