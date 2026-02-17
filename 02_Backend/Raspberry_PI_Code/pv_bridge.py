import requests
from decimal import Decimal


class PV_Bridge:
    def __init__(self, device_manager):
        self.device_manager = device_manager
        self.url = self.device_manager.get_device_url(
            "pv",
            "powerflow"
        ) # http://192.168.0.101/solar_api/v1/GetPowerFlowRealtimeData.fcgi

    # Safely convert a value to Decimal (avoids None or invalid numbers) 
    def safe_decimal(self, value):
        try:
            return Decimal(value)
        except (TypeError, ValueError, ArithmeticError):
            return Decimal(0)

    # Fetch raw PV data from the API
    def fetch_data(self):
        try:
            response = requests.get(self.url, timeout=5)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching PV data: {e}")
            return None

    # Extract relevant PV measurement values from the JSON response
    def parse_data(self, data):
        """Extract relevant PV measurement values from the JSON response."""
        if not data:
            return None
        try:
            site = data['Body']['Data']['Site']
            inverter = data['Body']['Data']['Inverters'].get('1', {})

            return {
                "pv_power": self.safe_decimal(site.get('P_PV')),                           # PV power generation (W)
                "grid_power": self.safe_decimal(site.get('P_Grid')),                       # Power to/from grid (W)
                "load_power": self.safe_decimal(site.get('P_Load')),                       # Household consumption (W)
                "battery_power": self.safe_decimal(site.get('P_Akku')),                    # Battery charge/discharge (W)
                "soc": self.safe_decimal(inverter.get('SOC')),                             # Battery state of charge (%)
                "e_total": self.safe_decimal(site.get('E_Total')),                         # Total energy produced (Wh)
                "rel_autonomy": self.safe_decimal(site.get('rel_Autonomy')),               # Self-sufficiency ratio (%)
                "rel_selfconsumption": self.safe_decimal(site.get('rel_SelfConsumption')), # Self-consumption ratio (%)
            }
        except Exception as e:
            print(f"Error parsing PV data: {e}")
            return None
