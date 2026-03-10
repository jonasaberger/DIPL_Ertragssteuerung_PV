import os
import json
import time
import requests
from decimal import Decimal
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# CAR STATUS ENUM (laut go-eCharger API v2 Doku):
CAR_CONNECTED_STATES = {2, 3, 4}

# Retry-Konfiguration für go-eCharger V3
# Die Hardware bricht gelegentlich HTTP-Verbindungen bei aktivem Laden ab (Firmware-Bug).
# 2 Versuche mit 1s Pause fangen ~95% der transienten Fehler ab, ohne den Scheduler nennenswert zu verzögern.
_RETRY_ATTEMPTS = 2
_RETRY_DELAY_S  = 1.0


def _get_with_retry(url: str, timeout: int = 5, params: dict = None) -> requests.Response:
    last_exc = None
    for attempt in range(_RETRY_ATTEMPTS):
        try:
            resp = requests.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            return resp
        except (requests.exceptions.ConnectTimeout,
                requests.exceptions.ConnectionError) as e:
            last_exc = e
            if attempt < _RETRY_ATTEMPTS - 1:
                time.sleep(_RETRY_DELAY_S)
        except requests.exceptions.HTTPError:
            raise
    raise last_exc


class WallboxController:
    def __init__(self, config_path: str = "config/devices.json"):
        # Load device configuration from JSON configuration file
        self.config_path = os.path.abspath(config_path)
        self.load_config()
        
    def load_config(self):
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

        self.status_url, self.api_status_url, self.mqtt_url = (
            f"{base_url}{endpoints.get('status', '/status')}",
            f"{base_url}{endpoints.get('api', '/api/status')}",
            f"{base_url}{endpoints.get('mqtt', '/mqtt')}"
        )

        # Prevents log spam when the wallbox resets alw=1 on its own
        self._intended_allow = None
        # Tracks expected car state until hardware catches up
        self._intended_car = None
        self._intended_car_until = None

    # Safely convert a value to Decimal (avoids None or invalid numbers)
    def safe_decimal(self, value):
        try:
            return Decimal(value)
        except (TypeError, ValueError, ArithmeticError):
            return Decimal(0)

    # Fetch and combine data from both Wallbox endpoints
    def fetch_data(self):
        try:
            status_resp = _get_with_retry(self.status_url)
            status_data = status_resp.json()

            api_resp = _get_with_retry(self.api_status_url)
            api_data = api_resp.json()

            # Extract phase info (normalize to 3 phases)
            pha = api_data.get("pha", [])
            pha = [1 if v else 0 for v in (pha + [0, 0, 0])[:3]]

            # car: raw value from API (0=Unknown/Error, 1=Idle, 2=Charging, 3=WaitCar, 4=Complete, 5=Error)
            # car_connected: 1 if a car is physically connected (states 2, 3, 4), 0 otherwise
            car_raw = int(status_data.get("car", 0))

            # If hardware hasn't caught up yet, use intended state
            now_dt = datetime.now(ZoneInfo("Europe/Vienna"))
            if self._intended_car is not None:
                if self._intended_car_until and now_dt > self._intended_car_until:
                    # Timeout expired -> trust hardware
                    self._intended_car = None
                    self._intended_car_until = None
                elif car_raw == 1:
                    # Hardware reports no car -> override immediately, never fake car_connected
                    self._intended_car = None
                    self._intended_car_until = None
                elif car_raw == self._intended_car or car_raw in CAR_CONNECTED_STATES:
                    # Hardware has caught up, reset
                    self._intended_car = None
                    self._intended_car_until = None
                else:
                    car_raw = self._intended_car

            data = {
                "_time": datetime.now(ZoneInfo("Europe/Vienna")).isoformat(),
                "amp": int(status_data.get("amp", 0)),
                "car": car_raw,
                "car_connected": 1 if car_raw in CAR_CONNECTED_STATES else 0,
                "alw": int(api_data.get("alw", 0)),
                "wst": int(status_data.get("wst", 0)),
                "eto": float(status_data.get("eto", 0)),
                "pha_L1": pha[0],
                "pha_L2": pha[1],
                "pha_L3": pha[2],
                "pha_count": sum(pha)
            }

            if data["car"] == 4 and data["alw"] == 0:
                data["car"] = 3
                data["car_connected"] = 1

            # Determine if charging is currently active
            data["charging"] = (
                1 if data["car_connected"] == 1 and data["alw"] == 1 and data["amp"] > 0 else 0
            )

            return data

        except Exception as e:
            print(f"Error fetching Wallbox data: {e}")
            raise

    # Enable / disable charging via MQTT (alw flag)
    def set_allow_charging(self, allow: bool):
        alw_value = 1 if allow else 0

        _get_with_retry(
            self.mqtt_url,
            params={"payload": f"alw={alw_value}"}
        )

        # Update intended states immediately after successful command
        self._intended_allow = allow

        # Only set _intended_car if a car is actually connected (car in {2,3,4})
        # Bridges the 1-2s hardware latency after the command
        # Do NOT set if no car is connected (car=1) - would cause false car_connected=1
        try:
            current_car = int(self.fetch_data().get("car", 0))
        except Exception:
            current_car = 0
        if current_car in CAR_CONNECTED_STATES:
            self._intended_car = 2 if allow else 3  # 2=Charging, 3=WaitCar
            self._intended_car_until = datetime.now(ZoneInfo("Europe/Vienna")) + timedelta(seconds=10)
        else:
            self._intended_car = None
            self._intended_car_until = None

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

    # Get current charging ampere
    def get_current_ampere(self) -> int:
        try:
            data = self.fetch_data()
            return int(data.get("amp", 0))
        except Exception:
            return 0

    # Set charging current (Ampere)
    def set_charging_ampere(self, amp: int):
        allowed_values = [6, 10, 12, 14, 16]

        if amp not in allowed_values:
            raise ValueError(
                f"Invalid amp value. Allowed values: {allowed_values}"
            )

        _get_with_retry(
            self.mqtt_url,
            params={"payload": f"amx={amp}"}
        )

        return {
            "amp": amp,
            "message": "Charging ampere updated"
        }