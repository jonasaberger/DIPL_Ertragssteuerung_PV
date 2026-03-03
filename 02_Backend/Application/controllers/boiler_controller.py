import platform

# ! Install / Import gpiozero for relay control (only works on Pi)
try:
    if platform.system() == "Linux":
        from gpiozero import LED
    else:
        LED = None
except Exception:
    LED = None

# TODO: Check if this is the correct pin for boiler control - (Votta frogn)
class BoilerController:
    def __init__(self, gpio_pin=25, inverted_logic=True):

        # Relay control: use gpiozero on Pi, simulate on others
        self.gpio_pin = gpio_pin
        self.inverted_logic = inverted_logic
        self.relay = None

        # Initialize hardware relay if on Linux (Pi)
        if LED and platform.system() == "Linux":
            try:
                self.relay = LED(self.gpio_pin)
            except Exception:
                self.relay = None

        # simulation state for non-Pi environments (Windows, CI, ...)
        self._sim_state = False

        # logical boiler state
        self._state = False

    # Relay Logic 
    def _apply_logic(self, logical_on: bool):
        self._state = logical_on

        # Hardware relay available (Pi)
        if self.relay:
            physical_on = not logical_on if self.inverted_logic else logical_on

            if physical_on:
                self.relay.on()      # GPIO HIGH
            else:
                self.relay.off()     # GPIO LOW

            return logical_on

        # Simulation mode (no GPIO available)
        self._sim_state = logical_on
        return logical_on

    # Turn boiler heating ON
    def turn_on(self):
        return self._apply_logic(True)

    # Turn boiler heating OFF
    def turn_off(self):
        return self._apply_logic(False)

    # Toggle boiler heating state
    def toggle(self):
        return self._apply_logic(not self.get_state())

    # Returns logical boiler state (True/False)
    # Reads actual GPIO state if hardware is available, falls back to internal state
    def get_state(self) -> bool:
        if self.relay:
            # relay.value: 1=GPIO HIGH, 0=GPIO LOW
            # inverted_logic: HIGH=OFF, LOW=ON
            physical_on = bool(self.relay.value)
            return (not physical_on) if self.inverted_logic else physical_on

        # Simulation mode: return internal state
        return self._sim_state

    # API-style control helper
    # Accepts 'on', 'off', 'toggle' and returns action result
    def control(self, action: str):
        action = (action or "").lower()

        if action not in ("on", "off", "toggle"):
            raise ValueError("Invalid action. Use 'on', 'off' or 'toggle'.")

        if action == "on":
            res = self.turn_on()
        elif action == "off":
            res = self.turn_off()
        else:
            res = self.toggle()

        return {"action": action, "result": res}