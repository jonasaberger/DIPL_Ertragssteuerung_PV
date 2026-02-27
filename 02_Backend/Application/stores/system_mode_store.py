import json
from pathlib import Path
from enum import Enum

# Defines system modes and handles persistent storage of the current mode
# The system mode determines how the scheduling and control logic operates, with different modes allowing for automatic control,
# manual control, or time-based control.
class SystemMode(str, Enum):
    AUTOMATIC = "AUTOMATIC"
    MANUAL = "MANUAL"
    TIME_CONTROLLED = "TIME_CONTROLLED"

class SystemModeStore:
    def __init__(self, path="data/system_mode.json"):
        self.path = Path(path)
        self._mode = self._load()

    # Loads the current system mode from the JSON file, or defaults to AUTOMATIC if the file does not exist.
    def _load(self):
        if not self.path.exists():
            return SystemMode.AUTOMATIC
        with self.path.open("r") as f:
            return SystemMode(json.load(f)["mode"])

    # Saves the current system mode to the JSON file, creating parent directories if necessary
    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w") as f:
            json.dump({"mode": self._mode.value}, f)

    # Returns the current system mode, which determines how the scheduling and control logic operates, 
    # with different modes allowing for automatic control, manual control, or time-based control
    def get(self):
        return self._mode

    # Sets the current system mode to a new value, which will affect how the scheduling and control logic operates,
    # and saves the new mode to the JSON file for persistence across restarts
    def set(self, mode: SystemMode):
        self._mode = mode
        self._save()
