import json
from flask import request, jsonify
import os

class DeviceManager:
    def __init__(self, config_path: str = "config/devices.json", default_path: str = "config/devices-default.json"):
        self.config_path = config_path
        self.default_path = default_path
        self.admin_pw = os.getenv("ADMIN_PW")

        if not self.admin_pw:
            raise RuntimeError("ADMIN_PW not set in environment")

        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config file not found: {self.config_path}")

        self._config = None
        self.load()

    # BASE FILE MANIP. OPERATIONS
    def load(self):
        with open(self.config_path, "r") as f:
            self._config = json.load(f)

    def save(self):
        with open(self.config_path, "w") as f:
            json.dump(self._config, f, indent=2)

    def reset_devices(self):
        with open(self.default_path, "r") as orig:
            self._config = json.load(orig)
        with open(self.config_path, "w") as f:
            json.dump(self._config, f, indent=2)

    # Reset-Devices Endpoint
    def reset_devices_endpoint(self):
        try:
            self.reset_devices()
            return jsonify({
                "success": True,
                "devices": self.get_devices()
            }), 200
        except Exception as e:
            return jsonify({
                "success": False,
                "error": str(e)
            }), 500

    # -------- READ METHODS --------
    def get_devices(self) -> dict:
        return self._config["devices"]

    def get_device(self):
        device_id = request.args.get("deviceId")
        device = self._config["devices"].get(device_id)
        if not device:
            raise KeyError(f"Device '{device_id}' not found")
        return device
    

    # -------- READ CONSTANTS METHODS --------
    def get_epex_price_offset(self) -> float:
        """Get the configured EPEX price offset to add to raw prices"""
        try:
            epex_device = self._config["devices"].get("epex", {})
            return float(epex_device.get("priceOffset", 0.0))
        except (KeyError, ValueError, TypeError):
            return 0.0

    def set_epex_price_offset(self, offset: float):
        """Set the EPEX price offset (no admin password required)"""
        if "epex" not in self._config["devices"]:
            raise KeyError("EPEX device not found in configuration")
        
        self._config["devices"]["epex"]["priceOffset"] = float(offset)
        self.save()
        
    def epex_price_offset_endpoint(self):
        """GET/PUT endpoint for EPEX price offset"""
        # GET: Return current offset
        if request.method == "GET":
            return jsonify({
                "priceOffset": self.get_epex_price_offset()
            }), 200
        
        # PUT: Update offset
        if request.method == "PUT":
            payload = request.get_json(silent=True)
            if not payload or "priceOffset" not in payload:
                return jsonify({"error": "Missing 'priceOffset' in request"}), 400
            
            try:
                offset = float(payload["priceOffset"])
                self.set_epex_price_offset(offset)
                
                return jsonify({
                    "success": True,
                    "priceOffset": offset
                }), 200
                
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid priceOffset value, must be a number"}), 400
            except KeyError as e:
                return jsonify({"error": str(e)}), 404

    # -------- ADMIN METHODS --------

    def check_password(self, password: str) -> bool:
        return password == self.admin_pw

    def verify_admin_pw(self):
        payload = request.get_json(silent=True)
        if not payload or "password" not in payload:
            return jsonify({"error": "Missing 'password' in request"}), 400

        if self.check_password(payload["password"]):
            return jsonify({"success": True}), 200

        return jsonify({"success": False}), 401

    ## DEVICE-EDITS
    def edit_device_logic(self, device_id: str, payload: dict, password: str):
        if not self.check_password(password):
            return None

        device = self._config["devices"].get(device_id)
        if not device:
            raise KeyError(f"Device '{device_id}' not found")

        device.update(payload)
        self.save()

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