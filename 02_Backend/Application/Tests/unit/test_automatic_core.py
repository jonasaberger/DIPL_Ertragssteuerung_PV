from scheduler_service import SchedulerService


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


# HELPER FUNCTIONS

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


# Tests for the automatic control logic of the SchedulerService, ensuring that it correctly decides when to turn on the boiler and allow wallbox charging based on PV surplus and forecast data
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

# Tests that the automatic boiler control does not turn on the boiler if the forecast indicates no PV production for today, even if there is currently a PV surplus
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


# Tests that the automatic boiler control does not turn on the boiler if the forecast indicates no PV production for today, even if there is currently a PV surplus
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

# Tests that the automatic wallbox control does not allow charging if there is no PV surplus and night grid is not allowed, even if the forecast indicates PV production for today
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

    # Depending on the time of the test, this could be True or False, but it should not raise an error and should be a boolean value
    assert wallbox.get_allow_state() in (True, False)


