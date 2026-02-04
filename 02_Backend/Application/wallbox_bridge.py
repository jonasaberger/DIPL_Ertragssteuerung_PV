import os
import json
import requests
from decimal import Decimal
from datetime import datetime
from zoneinfo import ZoneInfo


class Wallbox_Bridge:
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
                "_time": datetime.now(ZoneInfo("Europe/Vienna")).isoformat(),  # Current timestamp in ISO 8601 format
                "amp": int(status_data.get("amp", 0)),  # Current (A)
                "car": 1 if int(status_data.get("car", 0)) > 0 else 0,  # Car connected (1/0)
                "alw": int(api_data.get("alw", 0)),  # Charging allowed (1/0)
                "wst": int(status_data.get("wst", 0)),  # Wallbox status code
                "eto": float(status_data.get("eto", 0)),  # Total energy charged (Wh)
                "pha_L1": pha[0],  # Phase L1 active (1/0)
                "pha_L2": pha[1],  # Phase L2 active (1/0)
                "pha_L3": pha[2],  # Phase L3 active (1/0)
                "pha_count": sum(pha)  # Number of active phases
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
        # allow = True  -> alw=1 (Auto darf laden)
        # allow = False -> alw=0 (Laden stoppen)

        alw_value = 1 if allow else 0

        requests.get(
            self.mqtt_url,
            params={"payload": f"alw={alw_value}"},
            timeout=5
        ).raise_for_status()

        return {
            "alw": alw_value,
            "charging_allowed": allow
        }
    
    def get_allow_state(self) -> bool | None:
        try:
            data = self.fetch_data()
            return bool(data.get("alw"))
        except Exception:
            return None
