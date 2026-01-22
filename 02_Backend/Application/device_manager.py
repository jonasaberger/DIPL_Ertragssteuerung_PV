import threading, json
from urllib.parse import urljoin
from flask import request, jsonify, logging
import bcrypt
import os


class DeviceManager:
    def __init__(self, config_path: str = "config/devices.json", admin_pw_path: str = "config/admin-pw.txt"):
        self.config_path = config_path
        self.admin_pw_path = admin_pw_path

        self.convert_plain_text_pw()

        # Verify files exist
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        if not os.path.exists(self.admin_pw_path):
            raise FileNotFoundError(f"Admin password file not found: {self.admin_pw_path}")

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

    # -------- ADMIN METHODS --------
    def convert_plain_text_pw(self):
        with open(self.admin_pw_path, "r") as f:
            plain_pw = f.read().strip()

        pw_hash = bcrypt.hashpw(plain_pw.encode(), bcrypt.gensalt()).decode()
        print("[HASH CREATED]: " + pw_hash)

    def verify_admin_pw(self):
        # Read password from POST JSON
        payload = request.get_json(silent=True)
        if not payload or "password" not in payload:
            return jsonify({"error": "Missing 'password' in request"}), 400

        inc_password = payload["password"]

        # Read stored hash
        with open(self.admin_pw_path, "r") as f:
            stored_pw_hash = f.read().strip().encode()

        # Verify
        is_valid = bcrypt.checkpw(inc_password.encode(), stored_pw_hash)

        # Return JSON and status code
        if is_valid:
            return jsonify({"success": True}), 200
        else:
            return jsonify({"success": False}), 401