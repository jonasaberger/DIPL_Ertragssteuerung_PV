import os
from dotenv import load_dotenv
from influxdb_client import InfluxDBClient
from datetime import datetime, timedelta, time
import pytz

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
        self.query_api = self.client.query_api()

    # Check connection to the InfluxDB
    def check_connection(self):
        try:
            health = self.client.health()
            print(f"InfluxDB Status: {health.status}")
        except Exception as e:
            print(f"Connection error: {e}")

# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
# Query PV data from InfluxDB                                         #
# This Part contains methods to retrive photovoltaic (PV) system data #
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #

    def get_latest_pv_data(self):
    # Flux query to retrieve the most recent PV data (corrected for timezone)

        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: -1h)  // Query the last hour of data
        |> filter(fn: (r) => r["_measurement"] == "pv_measurements")
        |> filter(fn: (r) =>
            r["_field"] == "battery_power" or        // Battery charge/discharge power
            r["_field"] == "e_day" or                // Energy produced today
            r["_field"] == "e_total" or              // Total energy produced
            r["_field"] == "e_year" or               // Energy produced this year
            r["_field"] == "grid_power" or           // Grid import/export power
            r["_field"] == "load_power" or           // House consumption power
            r["_field"] == "pv_power" or             // Solar generation power
            r["_field"] == "rel_autonomy" or         // Percentage of self-sufficiency
            r["_field"] == "rel_selfconsumption" or  // Percentage of self-consumption
            r["_field"] == "soc"                     // Battery state of charge
        )
        |> aggregateWindow(every: 1m, fn: last, createEmpty: false)              // Use last value in each 1-minute window
        |> last()                                                                // Get the most recent entry from the aggregated data
        |> timeShift(duration: 2h)                                               // Adjust UTC to local time 
        |> pivot(rowKey:["_time"], columnKey:["_field"], valueColumn:"_value")   // Transform to wide format with fields as columns
        ''' 

        try:
            tables = self.query_api.query(query, org=self.org)
            # Ensure we actually received data
            if tables and len(tables[0].records) > 0:
                latest_record = tables[0].records[0]
                return latest_record.values
            else:
                print("No data found in InfluxDB for the last hour.")
                return None

        except Exception as e:
            print(f"Error while querying latest PV data: {e}")
            return None


    # Get PV data for a single day 
    def get_daily_pv_data(self):

        # Set timezone to Europe/Berlin for proper day boundary handling
        timezone = pytz.timezone('Europe/Berlin')
        now = datetime.now(timezone)

        # Calculate dynamic start and end: 12:00 previous day to 12:00 today
        # If current time is before 12:00, use day before yesterday to yesterday
        # If current time is after 12:00, use yesterday to today
        start_time = timezone.localize(
            datetime.combine(now.date(), time(12, 0)) - timedelta(days=1 if now.hour < 12 else 0)
        )
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
            # Flatten all records from all tables into a single list
            results = [record.values for table in tables for record in table.records]
            return results
        except Exception as e:
            print(f"Error querying daily PV data: {e}")
            return None

    # Get PV data for the last week
    def get_weekly_pv_data(self):
        timezone = pytz.timezone('Europe/Berlin')
        now = datetime.now(timezone)

        start_time = timezone.localize(
            datetime.combine(now.date(), time(12, 0)) - timedelta(days=7 if now.hour >= 12 else 8)
        )
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
            results = [record.values for table in tables for record in table.records]
            return results
        except Exception as e:
            print(f"Error querying weekly PV data: {e}")
            return None
