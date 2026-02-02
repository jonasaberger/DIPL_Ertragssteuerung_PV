import json
import copy
from pathlib import Path


class ScheduleStore:
    def __init__(
        self,
        path="data/schedule.json",
        default_path="data/schedule_default.json"
    ):
        self.path = Path(path)
        self.default_path = Path(default_path)

        self._default = self._load(self.default_path)
        self._override = self._load(self.path)

        print("DEFAULT LOADED:", self._default)
        print("OVERRIDE LOADED:", self._override)

    def _load(self, path: Path):
        if not path.exists():
            return {}
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def get(self):
        result = copy.deepcopy(self._default)
        for device, seasons in self._override.items():
            result.setdefault(device, {})
            for season, values in seasons.items():
                result[device][season] = values
        return result

    def update(self, new_config: dict):
        print("UPDATE CALLED WITH:", new_config) 

        for device, seasons in new_config.items():
            self._override.setdefault(device, {})
            for season, values in seasons.items():
                self._override[device][season] = values

        self.save()

    def save(self):
        print("SAVING OVERRIDE:", self._override) 
        with self.path.open("w", encoding="utf-8") as f:
            json.dump(self._override, f, indent=2)
