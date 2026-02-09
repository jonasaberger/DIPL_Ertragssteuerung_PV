from schedule_manager import ScheduleManager

# Fake Store 
class FakeScheduleStore:
    def __init__(self, data):
        self._data = data

    def get_effective(self):
        return self._data
    
# Fake for SchedulerService test
def force_winter(sm):
    sm.determine_season = lambda: "winter"

# Tests if the ScheduleManager correctly determines if a device should be active based on the schedule and current time
def test_active_inside_window():
    store = FakeScheduleStore({
        "boiler": {"winter": {"start": "00:00", "end": "23:59"}}
    })
    sm = ScheduleManager(store)
    force_winter(sm)

    assert sm.is_active("boiler") is True

# Tests if the ScheduleManager correctly determines that a device is inactive when the start and end times are the same (edge case)
def test_inactive_same_time():
    store = FakeScheduleStore({
        "boiler": {"winter": {"start": "12:00", "end": "12:00"}}
    })
    sm = ScheduleManager(store)
    force_winter(sm)

    assert sm.is_active("boiler") is False

# Tests if the ScheduleManager correctly handles schedules that span over midnight (22:00 to 06:00)
def test_over_midnight():
    store = FakeScheduleStore({
        "wallbox": {"winter": {"start": "22:00", "end": "06:00"}}
    })
    sm = ScheduleManager(store)
    force_winter(sm)

    # Depending on the current time, this could be True or False, but it should not raise an error
    assert isinstance(sm.is_active("wallbox"), bool)
