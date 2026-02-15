import os
import pytz
from dotenv import load_dotenv, find_dotenv
from influxdb_client import InfluxDBClient
from datetime import datetime, timedelta

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

    # Helper: clean record and convert _time
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
    
    # Check connection
    def check_connection(self):
        health = self.client.health()
        if health.status != "pass":
            raise RuntimeError(f"InfluxDB unhealthy: {health.status}")

    # PV Data
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
                return self.clean_record(record)
            return None
        except Exception as e:
            print(f"Error querying latest PV data: {e}")
            return None

    # Get daily PV data for a specific date or today
    def get_daily_pv_data(self, date: str | None = None):
        # Default: today
        if date:
            try:
                day = datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError("Invalid date format. Use YYYY-MM-DD")
        else:
            day = datetime.now(self.timezone).date()

        # Start: YYYY-MM-DD 00:00
        start_time = self.timezone.localize(
            datetime(day.year, day.month, day.day, 0, 0, 0),
            is_dst=None
        )

        # End: YYYY-MM-DD 23:59:59 (NOT next day 00:00)
        end_time = self.timezone.localize(
            datetime(day.year, day.month, day.day, 23, 59, 59),
            is_dst=None
        )

        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: {start_time.isoformat()}, stop: {end_time.isoformat()})
        |> filter(fn: (r) => r._measurement == "pv_measurements")
        |> aggregateWindow( every: 15m, fn: mean, createEmpty: false)
        |> pivot(
            rowKey: ["_time"],
            columnKey: ["_field"],
            valueColumn: "_value"
        )
        '''

        tables = self.query_api.query(query, org=self.org)
        return [
            self.clean_record(r.values)
            for t in tables
            for r in t.records
        ]
        
    # Get monthly PV data for a specific month or current month
    def get_monthly_pv_data(self, month: str | None = None):
        # Default: current month
        if month:
            try:
                year, m = map(int, month.split("-"))
            except ValueError:
                raise ValueError("Invalid month format. Use YYYY-MM")
        else:
            now = datetime.now(self.timezone)
            year, m = now.year, now.month

        # Start: 01.MM.YYYY 00:00
        start_time = self.timezone.localize(
            datetime(year, m, 1, 0, 0, 0),
            is_dst=None
        )

        # End: last day of month 23:59:59 (NOT next month 00:00)
        next_month = (start_time + timedelta(days=32)).replace(day=1)
        end_time = self.timezone.localize(
            datetime(next_month.year, next_month.month, 1, 0, 0, 0),
            is_dst=None
        ) - timedelta(seconds=1)

        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: {start_time.isoformat()}, stop: {end_time.isoformat()})
        |> filter(fn: (r) => r._measurement == "pv_measurements")
        |> aggregateWindow( every: 15m, fn: mean, createEmpty: false)
        |> pivot(
            rowKey: ["_time"],
            columnKey: ["_field"],
            valueColumn: "_value"
        )
        '''

        tables = self.query_api.query(query, org=self.org)
        return [
            self.clean_record(r.values)
            for t in tables
            for r in t.records
        ]
        
    # Get yearly PV data for a specific year or current year
    def get_yearly_pv_data(self, year: int | None = None):
        # Default: current year
        if year is None:
            year = datetime.now(self.timezone).year

        # Start: 01.01.YYYY 00:00
        start_time = self.timezone.localize(  
            datetime(year, 1, 1, 0, 0, 0),
            is_dst=None
            )

        # End: 31.12.YYYY 23:59:59  (NOT 01.01.YYYY+1)
        end_time = self.timezone.localize(
            datetime(year, 12, 31, 23, 59, 59),
            is_dst=None
            )

        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: {start_time.isoformat()}, stop: {end_time.isoformat()})
        |> filter(fn: (r) => r._measurement == "pv_measurements")
        |> aggregateWindow( every: 2h,fn: mean,createEmpty: false)
        |> pivot( rowKey: ["_time"],columnKey: ["_field"],valueColumn: "_value"
        )
        '''
        try:
            tables = self.query_api.query(query, org=self.org)
            return [
                self.clean_record(r.values)
                for t in tables
                for r in t.records
            ]
        except Exception as e:
            print(f"Error querying yearly PV data (2h aggregated): {e}")
            return []

    # Boiler
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
                return self.clean_record(record, keep_fields=["_time", "boiler_temp"])
            return None
        except Exception as e:
            print(f"Error querying latest Boiler data: {e}")
            return None

    # EPEX Data
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
                return self.clean_record(record, keep_fields=["_time", "price"])
            return None
        except Exception as e:
            print(f"Error querying latest EPEX data: {e}")
            return None