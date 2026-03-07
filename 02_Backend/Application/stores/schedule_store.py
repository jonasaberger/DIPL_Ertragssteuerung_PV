import json
import copy
from pathlib import Path

class ScheduleStore:
    def __init__(self, path="data/schedule.json", default_path="data/schedule_default.json"):
        self.path = Path(path)
        self.default_path = Path(default_path)

        self._default = self._load(self.default_path)
        self._override = self._load(self.path)

    # Loads configuration from file, or returns empty dict if file does not exist
    def _load(self, path: Path):
        if not path.exists():
            return {}
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    # Returns the override schedule, which contains any user-defined overrides to the default schedule.
    # This is used for displaying the current schedule in the UI and for editing, 
    # while the effective schedule is used for actual scheduling decisions and calculations.
    def get_override(self) -> dict:
        return self._override

    # Returns the effective schedule, which is the result of merging the default schedule with any user-defined overrides.
    def get_effective(self) -> dict:
        result = copy.deepcopy(self._default)

        for device, seasons in self._override.items():
            result.setdefault(device, {})
            for season, values in seasons.items():
                result[device].setdefault(season, {})
                for field, value in values.items():  # fieldwise merge
                    result[device][season][field] = value

        return result

    # Updates the schedule with a new configuration, which is a dict structured similarly to the default schedule,
    # but can contain only the sections that need to be updated.
    def update(self, new_config: dict):
        for device, seasons in new_config.items():
            self._override.setdefault(device, {})
            for season, values in seasons.items():
                self._override[device].setdefault(season, {})
                for field, value in values.items():  # start/end merge single
                    self._override[device][season][field] = value
        self.save()

    # Saves the current override schedule to the JSON file, creating parent directories if necessary
    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(self._override, f, indent=2)

    # Resets the override schedule to the default values defined in the default JSON file, saves it, and returns the new override schedule
    def reset_to_default(self):
        self._override = copy.deepcopy(self._default)
        self.save()
