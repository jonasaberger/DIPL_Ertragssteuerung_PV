import json
from flask import request, jsonify
import bcrypt
import os

class DeviceManager:
    def __init__(self, config_path: str = "config/devices.json", admin_pw_path: str = "config/admin-pw.txt"):
        self.config_path = config_path
        self.admin_pw_path = admin_pw_path

        # Verify files exist
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config file not found: {self.config_path}")
        if not os.path.exists(self.admin_pw_path):
            raise FileNotFoundError(f"Admin password file not found: {self.admin_pw_path}")

        self._config = None
        self.load()

    # BASE FILE MANIP. OPERATIONS
    def load(self):
        with open(self.config_path, "r") as f:
            self._config = json.load(f)

    def save(self):
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

    ## PASSWORD-METHODS
    def convert_plain_text_pw(self):
        with open(self.admin_pw_path, "r") as f:
            plain_pw = f.read().strip()

        pw_hash = bcrypt.hashpw(plain_pw.encode(), bcrypt.gensalt()).decode()
        print("[HASH CREATED]: " + pw_hash)

    def check_password(self, password: str) -> bool:
        with open(self.admin_pw_path, "r") as f:
            stored_pw_hash = f.read().strip().encode()
        return bcrypt.checkpw(password.encode(), stored_pw_hash)

    def verify_admin_pw(self):
        payload = request.get_json(silent=True)
        if not payload or "password" not in payload:
            return jsonify({"error": "Missing 'password' in request"}), 400

        inc_password = payload["password"]
        is_valid = self.check_password(inc_password)

        if is_valid:
            return jsonify({"success": True}), 200
        else:
            return jsonify({"success": False}), 401

    ## DEVICE-EDITS
    def edit_device_logic(self, device_id: str, payload: dict, password: str) -> dict | None:
        if not self.check_password(password):
            return None  # wrong password

        device = self._config["devices"].get(device_id)
        if not device:
            raise KeyError(f"Device '{device_id}' not found")

        # Update device info
        device.update(payload)
        self.save()

        # Return full devices dict
        return self._config["devices"]

    def edit_device_endpoint(self):
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Missing JSON body"}), 400

        device_id = data.get("deviceId")
        password = data.get("password")
        payload = data.get("payload")

        if not device_id or not password or not payload:
            return jsonify({"error": "Missing required fields: deviceId, password, payload"}), 400

        try:
            updated_devices = self.edit_device_logic(device_id, payload, password)
        except KeyError as e:
            return jsonify({"error": str(e)}), 404

        if updated_devices is None:
            return jsonify({"success": False, "message": "Invalid admin password"}), 401

        # Return all devices
        return jsonify({"success": True, "devices": self.get_devices()}), 200