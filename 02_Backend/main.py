# main.py
from pv_bridge import PV_Bridge
from db_bridge import DB_Bridge
import sys

if __name__ == "__main__":
    pv = PV_Bridge()
    db = DB_Bridge()

    try:
        db.check_connection()
    except Exception as e:
        print(f"No Connection to InfluxDB: {e}")
        sys.exit(1)

    raw_data = pv.fetch_data()
    values = pv.parse_data(raw_data)

    if values:
        print("Values:", values)
        db.write_pv_data(values)
        print("Values written to DB")
