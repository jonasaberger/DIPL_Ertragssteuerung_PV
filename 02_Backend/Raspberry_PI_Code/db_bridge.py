import os
import pytz
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import load_dotenv

class DB_Bridge:
    def __init__(self):
        load_dotenv()
        self.url = os.getenv("INFLUX_URL")
        self.token = os.getenv("INFLUX_TOKEN")
        self.org = os.getenv("INFLUX_ORG")
        self.bucket = os.getenv("INFLUX_BUCKET")

        self.client = InfluxDBClient(
            url=self.url,
            token=self.token,
            org=self.org
        )
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.query_api = self.client.query_api()
    
    # Checks the connection to InfluxDB by calling the health endpoint and printing the status; 
    # returns True if successful, False if an exception occurs
    def check_connection(self):
        try:
            health = self.client.health()
            print(f"InfluxDB Status: {health.status}")
            return True
        except Exception as e:
            print(f"Connection error: {e}")
            return False
    
    # Writes a data point to InfluxDB with the specified measurement name, fields, and optional timestamp;
    def write_data(self, measurement: str, fields: dict, timestamp=None):
        try:
            point = Point(measurement)
            for key, value in fields.items():
                point.field(key, value)

            if timestamp:
                point.time(timestamp)

            self.write_api.write(bucket=self.bucket, org=self.org, record=point)
            return True
        except Exception as e:
            print(f"Failed to write {measurement} data: {e}")
            return False

    # Fetches the latest PV data from InfluxDB by querying for the most recent record in the "pv_data" measurement,
    # and returns a dictionary with the pv_power value converted to pv_power_kw and the timestamp in ISO format;
    # if any error occurs during the query, it returns None
    def fetch_data(self, measurement: str, limit: int = 5):
        try:
            query = f'''
                from(bucket: "{self.bucket}")
                    |> range(start: 0)
                    |> filter(fn: (r) => r._measurement == "{measurement}")
                    |> sort(columns: ["_time"], desc: true)
                    |> limit(n: {limit})
            '''

            tables = self.query_api.query(query)

            local_tz = pytz.timezone("Europe/Berlin")
            results = []

            for table in tables:
                for row in table.records:
                    ts_utc = row.get_time()
                    ts_local = ts_utc.astimezone(local_tz)

                    results.append({
                        "time": ts_local.isoformat(),
                        "field": row.get_field(),
                        "value": row.get_value()
                    })

            return results

        except Exception as e:
            print(f"Failed to fetch data from InfluxDB: {e}")
            return None