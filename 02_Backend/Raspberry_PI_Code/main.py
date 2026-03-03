import os
import sys
from datetime import datetime
from dotenv import load_dotenv

from device_manager import DeviceManager
from pv_bridge import PV_Bridge
from boiler_bridge import Boiler_Bridge
from db_bridge import DB_Bridge


def main():
    # Load backend URL from environment
    load_dotenv()
    backend_url = os.getenv("BACKEND_URL")
    if not backend_url:
        print("Error: BACKEND_URL is not set in the .env file")
        sys.exit(1)

    # Connect to DB
    db = DB_Bridge()
    device_manager = DeviceManager(f"{backend_url}/api/devices")

    try:
        db.check_connection()
    except Exception as e:
        print(f"No connection to InfluxDB: {e}")
        sys.exit(1)

    # Fetch and write PV data
    pv = PV_Bridge(device_manager)
    pv_raw = pv.fetch_data()
    pv_data = pv.parse_data(pv_raw)
    if pv_data:
        db.write_data("pv_measurements", pv_data)
        print(f"{datetime.now().isoformat()} : PV data written to InfluxDB")
    else:
        print("No PV data to write")

    # Boiler temperature data
    try:
        boiler = Boiler_Bridge()
        boiler_temp = boiler.read_temp()
        if boiler_temp is not None:
            db.write_data("boiler_measurements", {"boiler_temp": boiler_temp})
            print(f"{datetime.now().isoformat()} : Boiler temp: {boiler_temp}°C")
        else:
            print("No boiler temperature to write")
    except Exception as e:
        print(f"Error reading/writing boiler temperature: {e}")

if __name__ == "__main__":
    main()
