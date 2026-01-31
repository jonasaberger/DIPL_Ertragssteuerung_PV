import boiler_controller
from boiler_controller import BoilerController
import pytest

boiler_controller.LED = None

def test_boiler_controller_can_be_created():
    # Initialisierung des BoilerControllers testen
    controller = BoilerController()
    assert controller is not None

def test_boiler_simulation_turn_on():
    bc = BoilerController()
    # Boiler einschalten (logischer Zustand)
    result = bc.turn_on()

    # Erwartung:
    # - Rückgabewert True (Heizen aktiv)
    # - interner Simulationszustand ebenfalls True
    assert result is True
    assert bc.get_state() is True


def test_boiler_simulation_turn_off():
    bc = BoilerController()

    # Boiler zuerst einschalten
    bc.turn_on()

    # Danach ausschalten
    bc.turn_off()

    # Erwartung:
    # - Boiler ist logisch aus
    assert bc.get_state() is False


def test_boiler_toggle():
    bc = BoilerController()

    # Startzustand: aus
    bc.turn_on()

    # Toggle kehrt den aktuellen Zustand um
    new_state = bc.toggle()

    # Erwartung:
    # - Boiler wird ausgeschaltet
    assert new_state is False
    assert bc.get_state() is False


# Prüft, dass ungültige Steueraktionen korrekt mit einer Exception abgefangen werden
def test_control_invalid_action_raises_value_error():

    bc = BoilerController()

    # Ungültige Aktion → ValueError erwartet
    with pytest.raises(ValueError):
        bc.control("invalid")

# Prüft, dass die control()-Methode immer, eine konsistente Rückgabestruktur liefert
def test_control_returns_valid_result_structure():

    bc = BoilerController()

    result = bc.control("on")

    assert isinstance(result, dict)
    assert "action" in result
    assert "result" in result