import requests
from dotenv import load_dotenv

from device_manager import DeviceManager
from db_bridge import DB_Bridge
from datetime import datetime
import os

class EpexBridge: 
    def __init__(self):
        self.device_manager = DeviceManager("http://100.120.107.71:5050/api/devices")
        self.api_url = self.device_manager.get_device_url(
            "epex",
            "price"
        )   

        # Connect to the InfluxDB
        self.db = DB_Bridge()
        try: 
            self.db.check_connection()
        except Exception as e:
            print(f"No connection to InfluxDB: {e}") 

    # Fetches the raw EPEX data from the external API
    def fetch_data(self):
        try: 
            response = requests.get(self.api_url, timeout=5)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching EPEX data: {e}")
            return None

    # Parse the raw EPEX data to extract relevant information
    def parse_data(self, data):
        if not data:
            return None
        try:
            entries = data.get('data', [])
            hourly_entries = entries[::4]
            parsed_data = []

            for entry in hourly_entries:
                parsed_data.append({
                    "timestamp": entry.get('date'),
                    "value": entry.get('value')
                })
            return parsed_data
        except Exception as e:
            print(f"Error parsing EPEX data: {e}")
            return None


def main():
    bridge = EpexBridge()
    raw_data = bridge.fetch_data()
    parsed_data = bridge.parse_data(raw_data)
    if parsed_data:

        # Loop over each entry and write it as a single point
        for entry in parsed_data:
           bridge.db.write_data(
                "epex_prices",
                {"price": entry["value"]},
                timestamp=entry["timestamp"]
           )
        print(f"{datetime.now().isoformat()} : EPEX data written to InfluxDB")
    else:
        print("No EPEX data to write")

if __name__ == "__main__":
    main()
