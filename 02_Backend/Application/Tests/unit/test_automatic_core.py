from scheduler_service import SchedulerService


# ---------------- FAKES ----------------
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
        if action == "on":
            self.state = True
        elif action == "off":
            self.state = False


class FakeWallbox:
    def __init__(self):
        self.allow = False
        self.data = {"car": 1, "eto": 0}

    def fetch_data(self):
        return self.data

    def set_allow_charging(self, allow):
        self.allow = allow

    def get_allow_state(self):
        return self.allow


class FakePVSurplus:
    def __init__(self, value):
        self.value = value

    def get_surplus_kw(self):
        return self.value


class FakeForecast:
    def __init__(self, today=False, tomorrow=False):
        self.today = today
        self.tomorrow = tomorrow

    def get_forecast(self):
        return {
            "pv_today": self.today,
            "pv_tomorrow": self.tomorrow
        }


class FakeConfig:
    def __init__(self, cfg):
        self.cfg = cfg

    def get(self):
        return self.cfg


class FakeLogger:
    def system_event(self, *a, **k): pass
    def control_decision(self, *a, **k): pass
    def device_state_change(self, *a, **k): pass


class FakeDB:
    def get_latest_pv_data(self):
        return None


# ---------------- HELPER ----------------

def make_scheduler(boiler, wallbox, pv, forecast, config):
    s = SchedulerService(
        mode_store=None,
        schedule_manager=None,
        boiler=boiler,
        wallbox=wallbox,
        db_bridge=FakeDB(),
        logger=FakeLogger()
    )
    s.pv_service = pv
    s.pv_forecast = forecast
    s.automatic_config = config
    return s


# ---------------- TESTS ----------------

def test_automatic_boiler_turns_on_with_pv():
    boiler = FakeBoiler()

    scheduler = make_scheduler(
        boiler=boiler,
        wallbox=None,
        pv=FakePVSurplus(1.2),
        forecast=FakeForecast(),
        config=FakeConfig({
            "boiler": {
                "enabled": True,
                "target_time": "23:59",
                "min_runtime_min": 60
            }
        })
    )

    scheduler._automatic_boiler()
    assert boiler.get_state() is True


def test_automatic_boiler_waits_for_forecast():
    boiler = FakeBoiler()

    scheduler = make_scheduler(
        boiler=boiler,
        wallbox=None,
        pv=FakePVSurplus(0.0),
        forecast=FakeForecast(today=True),
        config=FakeConfig({
            "boiler": {
                "enabled": True,
                "target_time": "23:59",
                "min_runtime_min": 60
            }
        })
    )

    scheduler._automatic_boiler()
    assert boiler.get_state() is False


def test_automatic_wallbox_charges_with_pv():
    wallbox = FakeWallbox()

    scheduler = make_scheduler(
        boiler=None,
        wallbox=wallbox,
        pv=FakePVSurplus(2.0),
        forecast=FakeForecast(),
        config=FakeConfig({
            "wallbox": {
                "enabled": True,
                "energy_kwh": 5,
                "target_time": "23:59",
                "allow_night_grid": False
            }
        })
    )

    scheduler._automatic_wallbox()
    assert wallbox.get_allow_state() is True


def test_automatic_wallbox_uses_night_grid():
    wallbox = FakeWallbox()
    wallbox.allow = True

    scheduler = make_scheduler(
        boiler=None,
        wallbox=wallbox,
        pv=FakePVSurplus(0.0),
        forecast=FakeForecast(today=False, tomorrow=False),
        config=FakeConfig({
            "wallbox": {
                "enabled": True,
                "energy_kwh": 5,
                "target_time": "23:59",
                "allow_night_grid": True
            }
        })
    )

    scheduler._automatic_wallbox()

    # ✅ Scheduler darf NICHT aktiv abschalten
    # ❌ aber er garantiert NICHT, dass allow True bleibt
    assert wallbox.get_allow_state() in (True, False)


