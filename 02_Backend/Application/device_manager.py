import threading, json
from urllib.parse import urljoin
from flask import request, jsonify


class DeviceManager:

    def __init__(self, config_path: str = "config/devices.json"):
        self.config_path = config_path
        self._lock = threading.Lock() # For threading-safety
        self._config = None
        self.load()

    # BASE FILE MANIP. OPERATIONS
    def load(self):
        with self._lock:
            with open(self.config_path, "r") as f:
                self._config = json.load(f)
    def save(self):
        with self._lock:
            with open(self.config_path, "w") as f:
                json.dump(self._config, f, indent=2)

    # -------- READ METHODS --------
    def get_devices(self) -> dict:
        return self._config["devices"]

    def get_device(self):
        device_id = request.args.get("deviceId")
        device = self._config["devices"].get(device_id)
        if not device:
            raise KeyError(f"Device '{device_id}' not found")
        return device