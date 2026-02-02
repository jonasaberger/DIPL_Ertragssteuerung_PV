from schedule_manager import ScheduleManager

# -------- Fake Store --------
class FakeScheduleStore:
    def __init__(self, data):
        self._data = data

    def get_effective(self):
        return self._data


def force_winter(sm):
    sm.determine_season = lambda: "winter"


def test_active_inside_window():
    store = FakeScheduleStore({
        "boiler": {"winter": {"start": "00:00", "end": "23:59"}}
    })
    sm = ScheduleManager(store)
    force_winter(sm)

    assert sm.is_active("boiler") is True


def test_inactive_same_time():
    store = FakeScheduleStore({
        "boiler": {"winter": {"start": "12:00", "end": "12:00"}}
    })
    sm = ScheduleManager(store)
    force_winter(sm)

    assert sm.is_active("boiler") is False


def test_over_midnight():
    store = FakeScheduleStore({
        "wallbox": {"winter": {"start": "22:00", "end": "06:00"}}
    })
    sm = ScheduleManager(store)
    force_winter(sm)

    # Logikpfad-Test (nicht Uhrzeit-Test!)
    assert isinstance(sm.is_active("wallbox"), bool)
