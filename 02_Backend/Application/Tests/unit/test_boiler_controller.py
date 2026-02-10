from controllers.boiler_controller import BoilerController
import pytest

def test_boiler_controller_can_be_created():
    # Initialization of the BoilerController should succeed without errors
    controller = BoilerController()
    assert controller is not None

def test_boiler_simulation_turn_on():
    bc = BoilerController()

    # Boiler on
    result = bc.turn_on()

    # Heating true / simulation active
    assert result is True
    assert bc.get_state() is True


def test_boiler_simulation_turn_off():
    bc = BoilerController()

    # Boiler on
    bc.turn_on()

    # Then boiler off
    bc.turn_off()

    # Boiler should be off
    assert bc.get_state() is False

def test_boiler_toggle():
    bc = BoilerController()

    # Start with boiler off
    bc.turn_on()

    # Toggle should turn it off
    new_state = bc.toggle()

    # Boiler should be off after toggle
    assert new_state is False
    assert bc.get_state() is False

def test_control_invalid_action_raises_value_error():
    bc = BoilerController()

    # Invalid action should raise ValueError
    with pytest.raises(ValueError):
        bc.control("invalid")

def test_control_returns_valid_result_structure():
    bc = BoilerController()

    # Valid control action should return a dict with 'action' and 'result'
    result = bc.control("on")

    assert isinstance(result, dict)
    assert "action" in result
    assert "result" in result