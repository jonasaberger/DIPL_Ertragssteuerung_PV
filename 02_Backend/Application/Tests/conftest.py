import sys
import pytest
from pathlib import Path
from unittest.mock import Mock

# Application-Root in sys.path einbinden -> damit relative Pfade wie "config/..." funktionieren
BASE_DIR = Path(__file__).resolve().parents[1]

# Das ist 02_Backend/Application
if str(BASE_DIR) not in sys.path:  
    sys.path.insert(0, str(BASE_DIR))

# Sicherstellen, dass das Arbeitsverzeichnis passt
# (wichtig für open("config/xyz.json"))
@pytest.fixture(scope="session", autouse=True)
def set_working_directory():
    """
    Erzwingt das Arbeitsverzeichnis auf Application/,
    damit relative Pfade im Produktivcode stabil sind.
    """
    import os
    os.chdir(BASE_DIR)

# Externe HTTP-Aufrufe blockieren (außer Hardware)
@pytest.fixture(autouse=True)
def disable_external_calls(monkeypatch, request):
    if request.node.get_closest_marker("hardware"):
        return

    monkeypatch.setattr(
        "requests.get",
        lambda *args, **kwargs: Mock(
            status_code=200,
            json=lambda: {},
            raise_for_status=lambda: None
        )
    )

    monkeypatch.setattr(
        "requests.post",
        lambda *args, **kwargs: Mock(
            status_code=200,
            json=lambda: {},
            raise_for_status=lambda: None
        )
    )

# Flask-Test-Client für Integrationstests
@pytest.fixture
def client(mocker):
    from service_manager import ServiceManager

    fake_boiler = mocker.Mock()
    fake_boiler.get_state.side_effect = [False, True]
    fake_boiler.control.return_value = {
        "action": "on",
        "result": True
    }

    mocker.patch("service_manager.BoilerController", return_value=fake_boiler)
    mocker.patch("service_manager.DB_Bridge")
    mocker.patch("service_manager.Wallbox_Bridge")
    mocker.patch("service_manager.LoggingBridge")

    sm = ServiceManager()
    app = sm.get_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        yield client
