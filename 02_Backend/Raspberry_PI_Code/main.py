from pv_bridge import PV_Bridge
from wallbox_bridge import Wallbox_Bridge
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

    # Wallbox data
    wallbox = Wallbox_Bridge()
    wallbox.write_to_db()

if __name__ == "__main__":
    main()
