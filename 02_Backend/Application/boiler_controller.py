import platform
from dotenv import load_dotenv, find_dotenv

# ! Install / Import gpiozero for relay control (only works on Pi)
try:
    if platform.system() == "Linux":
        from gpiozero import LED
    else:
        LED = None
except Exception:
    LED = None

class BoilerController:
    def __init__(self, gpio_pin=26, inverted_logic=True):
        # Load environment variables from .env file (if any)
        env_path = find_dotenv()
        if env_path:
            load_dotenv(env_path)

        # Relay control: use gpiozero on Pi, simulate on others
        self.gpio_pin = gpio_pin
        self.inverted_logic = inverted_logic

        self.relay = None
        if LED and platform.system() == "Linux":
            try:
                self.relay = LED(self.gpio_pin)
            except Exception:
                self.relay = None

        # simulation state for non-Pi environments (Windows, CI, dev)
        self._sim_state = False

    ########### Relay Logic ############
    def _apply_logic(self, logical_on: bool):
        """
        Handles relay logic with optional inverted behavior.
        logical_on = True  -> boiler should heat
        """
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

    def turn_on(self):
        """ Turn boiler heating ON (logical on) """
        return self._apply_logic(True)

    def turn_off(self):
        """ Turn boiler heating OFF (logical off) """
        return self._apply_logic(False)

    def toggle(self):
        """ Toggle boiler heating state """
        state = self.get_state()
        if state is None:
            return None
        return self._apply_logic(not state)

    def get_state(self):
        """
        Returns logical boiler state (True/False)  
        or simulated state when running without GPIO.
        """
        if self.relay:
            phys = self.relay.is_lit
            logical = not phys if self.inverted_logic else phys
            return logical

        return self._sim_state

    ########### API-style control helper ############

    def control(self, action: str):
        """
        Executes boiler control action: on/off/toggle  
        Returns: {"action": action, "result": True|False|None}
        """
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
