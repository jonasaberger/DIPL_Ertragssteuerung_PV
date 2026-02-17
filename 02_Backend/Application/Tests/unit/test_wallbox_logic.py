from datetime import datetime
import pytest
from controllers.wallbox_controller import WallboxController
from decimal import Decimal

# Simulates fetching data from the wallbox and processing it correctly
def test_wallbox_fetch_data(mocker):
    fake_response = mocker.Mock()
    fake_response.json.return_value = {
        "amp": 16,
        "car": 1,
        "wst": 3,
        "eto": 100
    }
    fake_response.raise_for_status.return_value = None

    # requests.get mock
    mocker.patch("requests.get", return_value=fake_response)

    # ZoneInfo mock -> to ensure that the wallbox controller does not fail when trying to get timezone information
    mocker.patch("controllers.wallbox_controller.ZoneInfo", return_value=None)

    # datetime mock -> but saves the actual datetime functionality for the logic that depends on it
    mocker.patch("controllers.wallbox_controller.datetime", wraps=datetime)

    wb = WallboxController()

    # Fetch data from the wallbox
    data = wb.fetch_data()

    # The method should return a dict with the values from the fake response
    assert data["amp"] == 16
    assert data["car"] == 1

# Checks that the safe_decimal method correctly converts valid input to Decimal and handles invalid input gracefully by returning Decimal(0)
def test_safe_decimal_handles_invalid_input():
    wb = WallboxController()

    result = wb.safe_decimal("not_a_number")

    assert result == Decimal(0)

# Tests that if the HTTP request to set the charging ampere fails, the method raises an exception and does not return a success message
def test_set_charging_ampere_success(mocker):
    fake_response = mocker.Mock()
    fake_response.raise_for_status.return_value = None

    mock_get = mocker.patch("requests.get", return_value=fake_response)

    wb = WallboxController()

    result = wb.set_charging_ampere(16)

    # Check correct payload call
    mock_get.assert_called_with(
        wb.mqtt_url,
        params={"payload": "amx=16"},
        timeout=5
    )

    assert result["amp"] == 16
    assert result["message"] == "Charging ampere updated"


# Tests that providing an invalid ampere value raises a ValueError with the expected message
def test_set_charging_ampere_invalid_value():
    wb = WallboxController()

    with pytest.raises(ValueError) as exc_info:
        wb.set_charging_ampere(9)

    assert "Invalid amp value" in str(exc_info.value)

# Tests that if the HTTP request fails (e.g., due to a connection error), the method raises an exception
def test_set_charging_ampere_http_error(mocker):
    fake_response = mocker.Mock()
    fake_response.raise_for_status.side_effect = Exception("HTTP Error")

    mocker.patch("requests.get", return_value=fake_response)

    wb = WallboxController()

    with pytest.raises(Exception):
        wb.set_charging_ampere(10)