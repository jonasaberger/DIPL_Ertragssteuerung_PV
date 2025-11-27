from pv_bridge import PV_Bridge
from boiler_bridge import Boiler_Bridge
from db_bridge import DB_Bridge
import sys

def main():
    # Connect to DB
    db = DB_Bridge()
    try:
        db.check_connection()
    except Exception as e:
        print(f"No connection to InfluxDB: {e}")
        sys.exit(1)

    # PV data
    pv = PV_Bridge()
    pv_raw = pv.fetch_data()
    pv_data = pv.parse_data(pv_raw)
    if pv_data:
        db.write_data("pv_measurements", pv_data)
        print("PV data written")
    else:
        print("No PV data to write")

    # Boiler temperature data
    try:
        boiler = Boiler_Bridge()
        boiler_temp = boiler.read_temp()
        if boiler_temp is not None:
            db.write_data("boiler_measurements", {"boiler_temp": boiler_temp})
            print(f"Boiler temperature written: {boiler_temp}°C")
        else:
            print("No boiler temperature to write")
    except Exception as e:
        print(f"Error reading/writing boiler temperature: {e}")

if __name__ == "__main__":
    main()
