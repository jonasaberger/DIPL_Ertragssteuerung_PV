import os
import json
import requests
from decimal import Decimal
from datetime import datetime
from zoneinfo import ZoneInfo


class WallboxController:
    def __init__(self, config_path: str = "config/devices.json"):
        # Load device configuration from JSON configuration file
        self.config_path = os.path.abspath(config_path)

        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Config file not found: {self.config_path}")

        with open(self.config_path, "r") as f:
            config = json.load(f)

        # Get wallbox configuration
        wallbox_config = config.get("devices", {}).get("wallbox")
        if not wallbox_config:
            raise ValueError("Wallbox configuration not found in devices.json")

        # Build URLs from config
        base_url = wallbox_config.get("baseUrl")
        endpoints = wallbox_config.get("endpoints", {})

        self.status_url = f"{base_url}{endpoints.get('status', '/status')}"
        self.api_status_url = f"{base_url}{endpoints.get('api', '/api/status')}"
        self.mqtt_url = f"{base_url}/mqtt"

        # Prevents log spam when the wallbox resets alw=1 on its own
        self._intended_allow = None

    # Safely convert a value to Decimal (avoids None or invalid numbers)
    def safe_decimal(self, value):
        try:
            return Decimal(value)
        except (TypeError, ValueError, ArithmeticError):
            return Decimal(0)

    # Fetch and combine data from both Wallbox endpoints
    def fetch_data(self):
        try:
            status_resp = requests.get(self.status_url, timeout=5)
            status_resp.raise_for_status()
            status_data = status_resp.json()

            api_resp = requests.get(self.api_status_url, timeout=5)
            api_resp.raise_for_status()
            api_data = api_resp.json()

            # Extract phase info (normalize to 3 phases)
            pha = api_data.get("pha", [])
            pha = [1 if v else 0 for v in (pha + [0, 0, 0])[:3]]

            data = {
                "_time": datetime.now(ZoneInfo("Europe/Vienna")).isoformat(),
                "amp": int(status_data.get("amp", 0)),
                "car": 1 if int(status_data.get("car", 0)) > 0 else 0,
                "alw": int(api_data.get("alw", 0)),
                "wst": int(status_data.get("wst", 0)),
                "eto": float(status_data.get("eto", 0)),
                "pha_L1": pha[0],
                "pha_L2": pha[1],
                "pha_L3": pha[2],
                "pha_count": sum(pha)
            }

            # Determine if charging is currently active
            data["charging"] = (
                1 if data["car"] == 1 and data["alw"] == 1 and data["amp"] > 0 else 0
            )

            return data

        except Exception as e:
            print(f"Error fetching Wallbox data: {e}")
            raise

    # Enable / disable charging via MQTT (alw flag)
    def set_allow_charging(self, allow: bool):
        alw_value = 1 if allow else 0

        requests.get(
            self.mqtt_url,
            params={"payload": f"alw={alw_value}"},
            timeout=5
        ).raise_for_status()

        # Update intended state immediately after successful command
        self._intended_allow = allow

        return {
            "alw": alw_value,
            "charging_allowed": allow
        }

    def get_allow_state(self) -> bool | None:
        try:
            data = self.fetch_data()
            hw_allow = bool(data.get("alw"))

            # If hardware reports a different value than last set, return intended state to prevent the scheduler from acting
            if self._intended_allow is not None and hw_allow != self._intended_allow:
                return self._intended_allow

            # Hardware matches intended (or no intended set yet) -> trust hardware
            self._intended_allow = hw_allow
            return hw_allow

        except Exception:
            # On error: return last known intended state
            return self._intended_allow

    def is_online(self) -> bool:
        try:
            self.fetch_data()
            return True
        except Exception:
            return False

    # Set charging current (Ampere)
    def set_charging_ampere(self, amp: int):
        allowed_values = [6, 10, 12, 14, 16]

        if amp not in allowed_values:
            raise ValueError(
                f"Invalid amp value. Allowed values: {allowed_values}"
            )

        response = requests.get(
            self.mqtt_url,
            params={"payload": f"amx={amp}"},
            timeout=5
        )
        response.raise_for_status()

        return {
            "amp": amp,
            "message": "Charging ampere updated"
        }