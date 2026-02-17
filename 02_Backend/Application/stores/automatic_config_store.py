import json
import copy
from pathlib import Path


#  Handles AUTOMATIC mode configuration
#  Supports default fallback and runtime updates via API
class AutomaticConfigStore:
    def __init__(self, path="data/automatic_config.json", default_path="data/automatic_config_default.json"):
        self.path = Path(path)
        self.default_path = Path(default_path)
        self._config = self._load()

    def _load(self) -> dict:
        if not self.path.exists():
            return self.reset_to_default()

        with self.path.open("r") as f:
            return json.load(f)

    def get(self) -> dict:
        return copy.deepcopy(self._config)

    def update(self, partial_update: dict):
        if not isinstance(partial_update, dict):
            raise ValueError("Invalid config format")

        self._deep_merge(self._config, partial_update)
        self._save()

    def _deep_merge(self, base: dict, updates: dict):
        for key, value in updates.items():
            if key not in base:
                base[key] = value
                continue

            if isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value

    def reset_to_default(self) -> dict:
        if not self.default_path.exists():
            raise FileNotFoundError("automatic_config_default.json missing")

        with self.default_path.open("r") as f:
            self._config = json.load(f)

        self._save()
        return self._config

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w") as f:
            json.dump(self._config, f, indent=2)