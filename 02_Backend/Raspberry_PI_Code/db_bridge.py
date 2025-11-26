import os
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import load_dotenv
from datetime import datetime, timezone

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
    
    def check_connection(self):
        try:
            health = self.client.health()
            print(f"InfluxDB Status: {health.status}")
            return True
        except Exception as e:
            print(f"Connection error: {e}")
            return False
    
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