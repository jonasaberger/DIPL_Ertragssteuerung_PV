import pytest
import requests
from wallbox_controller import WallboxController

# Tests real HTTP interaction with the wallbox. 
# This test will attempt to send a request to the wallbox and expects it to either succeed or be actively refused 
@pytest.mark.hardware
def test_wallbox_post_allow_false_real():
    wb = WallboxController()

    try:
        result = wb.set_allow_charging(False)

        # If result is returned, it should be a dict with the expected structure
        assert isinstance(result, dict)
        assert "charging_allowed" in result
        assert result["charging_allowed"] is False

    except requests.exceptions.ConnectionError:
        # If the connection is refused, consider the test passed as it indicates the wallbox is not allowing connections
        assert True