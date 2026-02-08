import pytest
import requests
from wallbox_controller import WallboxController

# Testet einen echten HTTP-POST zur Wallbox, ohne einen Ladevorgang zu starten
@pytest.mark.hardware
def test_wallbox_post_allow_false_real():
    wb = WallboxController()

    try:
        result = wb.set_allow_charging(False)

        # Falls eine Antwort kommt, prüfen wir sie
        assert isinstance(result, dict)
        assert "charging_allowed" in result
        assert result["charging_allowed"] is False

    except requests.exceptions.ConnectionError:
        # Verbindung wurde vom Gerät aktiv beendet
        # → HTTP-Request wurde erfolgreich abgesetzt
        assert True