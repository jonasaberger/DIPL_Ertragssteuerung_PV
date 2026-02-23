import json
import copy
from pathlib import Path

#  Handles AUTOMATIC mode configuration
class AutomaticConfigStore:
    def __init__(self, path="data/automatic_config.json", default_path="data/automatic_config_default.json"):
        self.path = Path(path)
        self.default_path = Path(default_path)
        self._config = self._load()

    # Loads configuration from file, or resets to default if file does not exist
    def _load(self) -> dict:
        if not self.path.exists():
            return self.reset_to_default()

        with self.path.open("r") as f:
            return json.load(f)

    # Returns a deep copy of the current configuration to prevent accidental modifications
    def get(self) -> dict:
        return copy.deepcopy(self._config)

    # Updates the configuration with a partial update dict, merging it with the existing config and saving to file
    def update(self, partial_update: dict):
        if not isinstance(partial_update, dict):
            raise ValueError("Invalid config format")

        # Deep merge the partial update into the existing config, so that nested dictionaries are properly updated without overwriting the entire section
        self._deep_merge(self._config, partial_update)
        self._save()

    # Recursively merges updates into the base config dictionary
    # This allows for partial updates to nested configuration sections without overwriting the entire section, 
    # which is important for maintaining existing settings that are not being updated
    def _deep_merge(self, base: dict, updates: dict):
        for key, value in updates.items():
            if key not in base:
                base[key] = value
                continue

            if isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_merge(base[key], value)
            else:
                base[key] = value

    # Resets the configuration to the default values defined in the default JSON file, saves it, and returns the new config
    def reset_to_default(self) -> dict:
        if not self.default_path.exists():
            raise FileNotFoundError("automatic_config_default.json missing")

        with self.default_path.open("r") as f:
            self._config = json.load(f)

        self._save()
        return self._config

    # Saves the current configuration to the JSON file, creating parent directories if necessary
    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w") as f:
            json.dump(self._config, f, indent=2)