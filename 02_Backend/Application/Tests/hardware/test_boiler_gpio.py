import platform
import pytest
from boiler_controller import BoilerController

# Hardware-Test nur auf Raspberry Pi ausführen
if platform.system() != "Linux":
    pytest.skip(
        "GPIO-Test nur auf Raspberry Pi",
        allow_module_level=True
    )

# Testet den realen GPIO-Zugriff des BoilerControllers
@pytest.mark.hardware
def test_boiler_gpio_turn_on_and_off():
    bc = BoilerController()

    # Boiler einschalten
    result_on = bc.turn_on()
    assert result_on is True
    assert bc.get_state() is True

    # Boiler ausschalten
    result_off = bc.turn_off()
    assert result_off is False
    assert bc.get_state() is False
