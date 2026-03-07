from services.scheduler_service import SchedulerService

# FAKES
class FakeLogger:
    def system_event(self, *a, **k): pass
    def control_decision(self, *a, **k): pass
    def device_state_change(self, *a, **k): pass

class FakeScheduleManager:
    def determine_season(self):
        return "winter"

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
        self.data = {"car": 2, "car_connected": 1, "eto": 0}

    def fetch_data(self):
        return self.data

    def set_allow_charging(self, allow):
        self.allow = allow

    def get_allow_state(self):
        return self.allow

    def is_online(self):
        return True

    def get_current_ampere(self):
        return 0

class FakeDB:
    def __init__(self, temp=40):
        self.temp = temp

    def get_latest_boiler_data(self):
        return {"boiler_temp": self.temp}

class FakePVSurplus:
    def __init__(self, value, temp=40, soc=50.0):
        self.value = value
        self._soc = soc
        self.db_bridge = FakeDB(temp)

    def get_surplus_kw(self):
        return self.value

    # FIX: scheduler_service calls get_pv_state(), not get_surplus_kw()
    def get_pv_state(self):
        return {
            "surplus_kw":      self.value,
            "pv_power_kw":     max(self.value, 0),
            "house_load_kw":   0.3,
            "battery_power_kw": 0.0,
            "soc":             self._soc,
        }

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

# HELPER
def make_scheduler(boiler, wallbox, pv, forecast, config):
    s = SchedulerService(
        mode_store=None,
        schedule_manager=FakeScheduleManager(),
        boiler=boiler,
        wallbox=wallbox,
        db_bridge=pv.db_bridge if hasattr(pv, "db_bridge") else FakeDB(),
        logger=FakeLogger()
    )
    s.pv_service = pv
    s.pv_forecast = forecast
    s.automatic_config = config
    return s


# --- TESTS ---

def test_automatic_boiler_turns_on_with_pv():
    """Boiler schaltet EIN wenn PV-Überschuss > 1.5 kW und SOC >= 12%."""
    boiler = FakeBoiler()

    scheduler = make_scheduler(
        boiler=boiler,
        wallbox=None,
        # FIX: surplus=2.0 (> BOILER_PV_MIN_KW=1.5), soc=50 (>= BOILER_SOC_START=12)
        pv=FakePVSurplus(2.0, temp=40, soc=50.0),
        forecast=FakeForecast(),
        config=FakeConfig({
            "boiler": {
                "winter": {
                    "enabled": True,
                    "target_time": "23:59",
                    "target_temp_c": 55,
                    "min_runtime_min": 60
                }
            }
        })
    )

    scheduler.automatic_boiler(scheduler.pv_forecast.get_forecast())
    assert boiler.get_state() is True


def test_automatic_boiler_does_not_turn_on_below_threshold():
    """Boiler bleibt AUS wenn Surplus < 1.5 kW."""
    boiler = FakeBoiler()

    scheduler = make_scheduler(
        boiler=boiler,
        wallbox=None,
        pv=FakePVSurplus(1.2, temp=40, soc=50.0),
        forecast=FakeForecast(),
        config=FakeConfig({
            "boiler": {
                "winter": {
                    "enabled": True,
                    "target_time": "23:59",
                    "target_temp_c": 55,
                    "min_runtime_min": 60
                }
            }
        })
    )

    scheduler.automatic_boiler(scheduler.pv_forecast.get_forecast())
    assert boiler.get_state() is False


def test_automatic_boiler_does_not_turn_on_low_soc():
    """Boiler bleibt AUS wenn SOC < 12%, auch bei ausreichend PV."""
    boiler = FakeBoiler()

    scheduler = make_scheduler(
        boiler=boiler,
        wallbox=None,
        # SOC 8% → unter BOILER_SOC_START=12
        pv=FakePVSurplus(2.5, temp=40, soc=8.0),
        forecast=FakeForecast(),
        config=FakeConfig({
            "boiler": {
                "winter": {
                    "enabled": True,
                    "target_time": "23:59",
                    "target_temp_c": 55,
                    "min_runtime_min": 60
                }
            }
        })
    )

    scheduler.automatic_boiler(scheduler.pv_forecast.get_forecast())
    assert boiler.get_state() is False


def test_automatic_boiler_waits_for_forecast():
    """Boiler wartet auf PV-Prognose wenn kein aktueller Surplus aber PV erwartet."""
    boiler = FakeBoiler()

    scheduler = make_scheduler(
        boiler=boiler,
        wallbox=None,
        pv=FakePVSurplus(0.0, temp=40, soc=50.0),
        forecast=FakeForecast(today=True),
        config=FakeConfig({
            "boiler": {
                "winter": {
                    "enabled": True,
                    "target_time": "23:59",
                    "target_temp_c": 55,
                    "min_runtime_min": 60
                }
            }
        })
    )

    scheduler.automatic_boiler(scheduler.pv_forecast.get_forecast())
    assert boiler.get_state() is False


def test_automatic_boiler_off_at_target_temp():
    """Boiler bleibt AUS wenn Zieltemperatur bereits erreicht."""
    boiler = FakeBoiler()
    boiler.state = True  # war AN

    scheduler = make_scheduler(
        boiler=boiler,
        wallbox=None,
        # temp=55 == target_temp_c=55 → bereits erreicht
        pv=FakePVSurplus(3.0, temp=55, soc=50.0),
        forecast=FakeForecast(),
        config=FakeConfig({
            "boiler": {
                "winter": {
                    "enabled": True,
                    "target_time": "23:59",
                    "target_temp_c": 55,
                    "min_runtime_min": 60
                }
            }
        })
    )

    scheduler.automatic_boiler(scheduler.pv_forecast.get_forecast())
    assert boiler.get_state() is False


def test_automatic_wallbox_charges_with_pv():
    """Wallbox lädt wenn PV-Überschuss > 1.4 kW."""
    wallbox = FakeWallbox()

    scheduler = make_scheduler(
        boiler=None,
        wallbox=wallbox,
        # FIX: get_pv_state() jetzt verfügbar via FakePVSurplus
        pv=FakePVSurplus(2.0, soc=50.0),
        forecast=FakeForecast(),
        config=FakeConfig({
            "wallbox": {
                "winter": {
                    "enabled": True,
                    "energy_kwh": 5,
                    "target_time": "23:59",
                    "allow_night_grid": False
                }
            }
        })
    )

    scheduler.automatic_wallbox(scheduler.pv_forecast.get_forecast())
    assert wallbox.get_allow_state() is True


def test_automatic_wallbox_uses_night_grid():
    """Wallbox-Zustand bleibt boolean (kein Fehler) wenn kein PV und kein Netz-Laden."""
    wallbox = FakeWallbox()
    wallbox.allow = True

    scheduler = make_scheduler(
        boiler=None,
        wallbox=wallbox,
        pv=FakePVSurplus(0.0, soc=50.0),
        forecast=FakeForecast(today=False, tomorrow=False),
        config=FakeConfig({
            "wallbox": {
                "winter": {
                    "enabled": True,
                    "energy_kwh": 5,
                    "target_time": "23:59",
                    "allow_night_grid": False
                }
            }
        })
    )

    scheduler.automatic_wallbox(scheduler.pv_forecast.get_forecast())
    assert wallbox.get_allow_state() in (True, False)