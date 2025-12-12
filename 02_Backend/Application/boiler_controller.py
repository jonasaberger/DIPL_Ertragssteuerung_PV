import os
from dotenv import load_dotenv, find_dotenv
from Raspberry_PI_Code.boiler_bridge import Boiler_Bridge

class BoilerController:
    def __init__(self):
        # Load environment variables from .env file
        env_path = find_dotenv()
        if env_path:
            load_dotenv(env_path)

        self.boiler = Boiler_Bridge()

    """
        True  -> Heizen AN
        False -> Heizen AUS
        None  -> GPIO nicht verfügbar (Windows)
    """
    def get_state(self):
        try:
            return self.boiler.get_state()
        except Exception as e:
            print(f"Error getting boiler state: {e}")
            return None

    """
        Executes boiler control action: on/off/toggle
    """
    def control(self, action: str):
        action = (action or "").lower()

        try:
            if action == "on":
                result = self.boiler.turn_on()
            elif action == "off":
                result = self.boiler.turn_off()
            elif action == "toggle":
                result = self.boiler.toggle()
            else:
                raise ValueError("Invalid action. Use: on/off/toggle.")

            return {"action": action, "result": result}

        except Exception as e:
            print(f"Error during boiler control: {e}")
            raise
