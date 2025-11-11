import os
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import load_dotenv

class DB_Bridge:
    def __init__(self):
        load_dotenv()
        self.url = os.getenv("INFLUX_URL")          # http://100.120.107.71:8086
        self.token = os.getenv("INFLUX_TOKEN")
        self.org = os.getenv("INFLUX_ORG")
        self.bucket = os.getenv("INFLUX_BUCKET")

        self.client = InfluxDBClient(
            url=self.url,
            token=self.token,
            org=self.org,
            bucket=self.bucket
        )
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.query_api = self.client.query_api()
    
    # Check the connection to the database
    def check_connection(self):
        try:
            health = self.client.health()
            print(f"InfluxDB Status: {health.status}" )
        except Exception as e:
            print(f"Connection error: {e}" )

    # Generic method to write any type of data to InfluxDB
    def write_data(self, measurement: str, fields: dict):
        try:
            point = Point(measurement)
            for key, value in fields.items():
                point.field(key, value)
            self.write_api.write(bucket=self.bucket, org=self.org, record=point)
            print(f"{measurement} data written to InfluxDB.")
        except Exception as e:
            print(f"Failed to write {measurement} data: {e}")