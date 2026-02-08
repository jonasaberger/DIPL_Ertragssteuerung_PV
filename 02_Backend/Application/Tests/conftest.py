import sys
import pytest
from pathlib import Path
from unittest.mock import Mock

BASE_DIR = Path(__file__).resolve().parents[1]

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


@pytest.fixture(scope="session", autouse=True)
def set_working_directory():
    import os
    os.chdir(BASE_DIR)


@pytest.fixture(autouse=True)
def disable_external_calls(monkeypatch, request):
    if request.node.get_closest_marker("hardware"):
        return

    monkeypatch.setattr(
        "requests.get",
        lambda *a, **k: Mock(status_code=200, json=lambda: {}, raise_for_status=lambda: None)
    )
    monkeypatch.setattr(
        "requests.post",
        lambda *a, **k: Mock(status_code=200, json=lambda: {}, raise_for_status=lambda: None)
    )


@pytest.fixture
def client(mocker):
    from service_manager import ServiceManager

    fake_boiler = mocker.Mock()
    fake_boiler.get_state.return_value = False
    fake_boiler.control.return_value = None

    mocker.patch("service_manager.BoilerController", return_value=fake_boiler)
    mocker.patch("service_manager.DB_Bridge")
    mocker.patch("service_manager.WallboxController")
    mocker.patch("service_manager.LoggingBridge")

    sm = ServiceManager()
    app = sm.get_app()
    app.config["TESTING"] = True

    with app.test_client() as client:
        yield client
