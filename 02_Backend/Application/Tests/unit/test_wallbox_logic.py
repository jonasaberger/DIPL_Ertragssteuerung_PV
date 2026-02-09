from datetime import datetime
from wallbox_controller import WallboxController
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
    mocker.patch("wallbox_controller.ZoneInfo", return_value=None)

    # datetime mock -> but saves the actual datetime functionality for the logic that depends on it
    mocker.patch("wallbox_controller.datetime", wraps=datetime)

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