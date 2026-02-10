import json
from pathlib import Path
from enum import Enum

# Defines system modes and handles persistent storage of the current mode
class SystemMode(str, Enum):
    AUTOMATIC = "AUTOMATIC"
    MANUAL = "MANUAL"
    TIME_CONTROLLED = "TIME_CONTROLLED"

class SystemModeStore:
    def __init__(self, path="data/system_mode.json"):
        self.path = Path(path)
        self._mode = self._load()

    def _load(self):
        if not self.path.exists():
            return SystemMode.AUTOMATIC
        with self.path.open("r") as f:
            return SystemMode(json.load(f)["mode"])

    def _save(self):
        with self.path.open("w") as f:
            json.dump({"mode": self._mode.value}, f)

    def get(self):
        return self._mode

    def set(self, mode: SystemMode):
        self._mode = mode
        self._save()
