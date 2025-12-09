import os
from dotenv import load_dotenv, find_dotenv
from influxdb_client import InfluxDBClient
from datetime import datetime, timedelta, time
import pytz

class DB_Bridge:
    def __init__(self):
        env_path = find_dotenv()
        if not env_path:
            raise FileNotFoundError("No .env file found - please create one")
        load_dotenv(env_path)

        self.url = os.getenv("INFLUX_URL")
        self.token = os.getenv("INFLUX_TOKEN")
        self.org = os.getenv("INFLUX_ORG")
        self.bucket = os.getenv("INFLUX_BUCKET")

        if not all([self.url, self.token, self.org, self.bucket]):
            raise ValueError("Missing InfluxDB environment variables")

        self.client = InfluxDBClient(
            url=self.url,
            token=self.token,
            org=self.org,
            bucket=self.bucket
        )
        self.query_api = self.client.query_api()
        self.timezone = pytz.timezone("Europe/Vienna")

    # -----------------------------------------
    # Helper: clean record and convert _time
    # -----------------------------------------
    def clean_record(self, record, keep_fields=None):
        if not record:
            return {}
        if "_time" in record and hasattr(record["_time"], "astimezone"):
            record["_time"] = record["_time"].astimezone(self.timezone).isoformat()
        default_keep = ["_time", "pv_power", "grid_power", "load_power",
                        "battery_power", "soc", "e_day", "e_year", "e_total",
                        "rel_autonomy", "rel_selfconsumption",
                        "boiler_temp", "price"]
        keep_fields = keep_fields or default_keep
        cleaned = {k: record[k] for k in keep_fields if k in record}
        return cleaned

    # -------------------------------
    # Check connection
    # -------------------------------
    def check_connection(self):
        try:
            health = self.client.health()
            print(f"InfluxDB Status: {health.status}")
        except Exception as e:
            print(f"Connection error: {e}")

    # -------------------------------
    # PV Data
    # -------------------------------
    def get_latest_pv_data(self):
        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => r["_measurement"] == "pv_measurements")
          |> filter(fn: (r) =>
              r["_field"] == "battery_power" or
              r["_field"] == "e_total" or
              r["_field"] == "grid_power" or
              r["_field"] == "load_power" or
              r["_field"] == "pv_power" or
              r["_field"] == "rel_autonomy" or
              r["_field"] == "rel_selfconsumption" or
              r["_field"] == "soc"
          )
          |> sort(columns: ["_time"], desc: true)
          |> limit(n:1)
          |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
        '''
        try:
            tables = self.query_api.query(query, org=self.org)
            if tables and len(tables[0].records) > 0:
                record = tables[0].records[0].values
                return [self.clean_record(record)]
            return []
        except Exception as e:
            print(f"Error querying latest PV data: {e}")
            return []

    def get_daily_pv_data(self):
        now = datetime.now(self.timezone)
        start_time = datetime.combine(now.date(), time(12, 0)) - timedelta(days=1 if now.hour < 12 else 0)
        start_time = self.timezone.localize(start_time)
        end_time = start_time + timedelta(days=1)

        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: {start_time.isoformat(timespec="seconds")}, stop: {end_time.isoformat(timespec="seconds")})
          |> filter(fn: (r) => r._measurement == "pv_measurements")
          |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)
          |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
        '''
        try:
            tables = self.query_api.query(query, org=self.org)
            results = [self.clean_record(record.values) for table in tables for record in table.records]
            return results
        except Exception as e:
            print(f"Error querying daily PV data: {e}")
            return []

    def get_weekly_pv_data(self):
        now = datetime.now(self.timezone)
        start_time = datetime.combine(now.date(), time(12, 0)) - timedelta(days=7 if now.hour >= 12 else 8)
        start_time = self.timezone.localize(start_time)
        end_time = start_time + timedelta(days=7)

        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: {start_time.isoformat(timespec="seconds")}, stop: {end_time.isoformat(timespec="seconds")})
          |> filter(fn: (r) => r._measurement == "pv_measurements")
          |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
          |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
        '''
        try:
            tables = self.query_api.query(query, org=self.org)
            results = [self.clean_record(record.values) for table in tables for record in table.records]
            return results
        except Exception as e:
            print(f"Error querying weekly PV data: {e}")
            return []

    # -------------------------------
    # Boiler Data
    # -------------------------------
    def get_latest_boiler_data(self):
        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => r["_measurement"] == "boiler_measurements")
          |> filter(fn: (r) => r["_field"] == "boiler_temp")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n:1)
          |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
        '''
        try:
            tables = self.query_api.query(query, org=self.org)
            if tables and len(tables[0].records) > 0:
                record = tables[0].records[0].values
                return [self.clean_record(record, keep_fields=["_time", "boiler_temp"])]
            return []
        except Exception as e:
            print(f"Error querying latest Boiler data: {e}")
            return []

    # -------------------------------
    # EPEX Data
    # -------------------------------
    def get_latest_epex_data(self):
        query = f'''
        from(bucket: "{self.bucket}")
          |> range(start: -24h)
          |> filter(fn: (r) => r["_measurement"] == "epex_prices")
          |> filter(fn: (r) => r["_field"] == "price")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n:1)
          |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
        '''
        try:
            tables = self.query_api.query(query, org=self.org)
            if tables and len(tables[0].records) > 0:
                record = tables[0].records[0].values
                return [self.clean_record(record, keep_fields=["_time", "price"])]
            return []
        except Exception as e:
            print(f"Error querying latest EPEX data: {e}")
            return []
        


# Old Code for Wallbox data querying commented out -> maybe needed later
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
# Query Wallbox data from InfluxDB                                    #
# This Part contains methods to retrive E-Go Wallbox system data      #
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #

    # def get_latest_wallbox_data(self):
    # # Flux query to retrieve the most recent Wallbox data

    #     query = f'''
    #     from(bucket: "{self.bucket}")
    #     |> range(start: -1h)              
    #     |> filter(fn: (r) => r["_measurement"] == "wallbox_measurements")
    #     |> filter(fn: (r) =>
    #         r["_field"] == "amp" or         // charging current in amperes
    #         r["_field"] == "car" or         // car connection state (1 = connected, 0 = not connected)
    #         r["_field"] == "eto" or         // total energy charged since installation (Wh or kWh)
    #         r["_field"] == "wst" or         // wallbox status code (depends on manufacturer)
    #         r["_field"] == "alw" or         // allow charging flag (1 = charging allowed)
    #         r["_field"] == "pha_L1" or      // phase L1 active (1 = on, 0 = off)
    #         r["_field"] == "pha_L2" or      // phase L2 active (1 = on, 0 = off)
    #         r["_field"] == "pha_L3" or      // phase L3 active (1 = on, 0 = off)
    #         r["_field"] == "pha_count" or   // number of active phases (1-3)
    #         r["_field"] == "charging"       // current charging state (1 = charging, 0 = idle)
    #     )
    #     |> aggregateWindow(every: 1m, fn: last, createEmpty: false) 
    #     |> last()                                                  
    #     |> timeShift(duration: 2h)                                 
    #     |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")
    #     '''

    #     try:
    #         tables = self.query_api.query(query, org=self.org)
    #         if tables and len(tables[0].records) > 0:
    #             return tables[0].records[0].values
    #         else:
    #             print("No wallbox data found in the last hour.")
    #             return None
    #     except Exception as e:
    #         print(f"Error while querying latest wallbox data: {e}")
    #         return None
        
    # def get_wallbox_history(self):
    #     query = f'''
    #     from(bucket: "{self.bucket}")
    #       |> range(start: 0)  // all available data from the beginning of the bucket
    #       |> filter(fn: (r) => r["_measurement"] == "wallbox_measurements")
    #       |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
    #       |> sort(columns: ["_time"], desc: false)
    #     '''
    #     tables = self.query_api.query(query, org=self.org)
    #     return [r.values for t in tables for r in t.records]
