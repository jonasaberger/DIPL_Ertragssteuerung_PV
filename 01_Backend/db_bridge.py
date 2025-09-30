import os
from influxdb_client import InfluxDBClient, Point, WritePrecision
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

    # Write PV data into InfluxDB
    def write_pv_data(self, pv, load, grid, battery, soc):
        try:
            point = (
                # Point is the name of Table
                Point("pv_measurements")  
                .field("pv_power", float(pv))
                .field("load_power", float(load))
                .field("grid_power", float(grid))
                .field("battery_power", float(battery))
                .field("soc", float(soc))
            )
            self.write_api.write(bucket=self.bucket, org=self.org, record=point)
            print("Data written to InfluxDB")
        except Exception as e:
            print(f"Data has not been written to InfluxDb: {e}")
  