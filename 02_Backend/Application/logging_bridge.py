import os
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import find_dotenv, load_dotenv
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


class LoggingBridge:
    def __init__(self):
        # Load environment variables
        env_path = find_dotenv()
        if not env_path:
            raise FileNotFoundError("No .env file found - please create one")
        load_dotenv()

        self.url = os.getenv("INFLUX_URL")
        self.token = os.getenv("INFLUX_TOKEN")
        self.org = os.getenv("INFLUX_ORG")
        self.bucket = os.getenv("INFLUX_BUCKET_LOGGING")

        if not all([self.url, self.token, self.org, self.bucket]):
            raise ValueError("Missing InfluxDB logging configuration")

        self.client = InfluxDBClient(
            url=self.url,
            token=self.token,
            org=self.org
        )

        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.query_api = self.client.query_api()

    # Internal write helper
    def _write(self, point: Point):
        self.write_api.write(
            bucket=self.bucket,
            org=self.org,
            record=point
        )

    # Control decision logging
    def control_decision(self, device, action, reason, success=True, extra=None):
        point = (
            Point("control_decision")
            .tag("device", device)               # wallbox / boiler
            .field("action", action)             # on / off / toggle / set_allow
            .field("success", str(success))
            .field("reason", reason)             # manual / pv_surplus / scheduler
            .field("extra", str(extra) if extra else "")
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)

    # System-level events
    def system_event(self, level, source, message):
        with InfluxDBClient(
            url=self.url,
            token=self.token,
            org=self.org
        ) as client:
            write_api = client.write_api(write_options=SYNCHRONOUS)

            point = (
                Point("system_event")
                .tag("level", level)
                .tag("source", source)
                .field("message", message)
                .time(datetime.now(timezone.utc), WritePrecision.NS)
            )

            write_api.write(
                bucket=self.bucket,
                org=self.org,
                record=point
            )

    # External API errors (WITH DEVICE INFORMATION)
    def api_error(self, device, endpoint, error):
        description = f"{device} API error at {endpoint}: {error}"

        point = (
            Point("api_error")
            .tag("device", device)
            .tag("endpoint", endpoint)
            .field("message", description)
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)

    # Device state changes
    def device_state_change(self, device, old_state, new_state):
      
        # Skip invalid / unknown states (timeouts, device unreachable)
        if old_state is None or new_state is None:
            return

        # Skip redundant transitions (ON -> ON, OFF -> OFF)
        if old_state == new_state:
            return

        if device == "boiler":
            old_label = "ON" if old_state else "OFF"
            new_label = "ON" if new_state else "OFF"
            description = f"boiler heating: {old_label} → {new_label}"

        elif device == "wallbox":
            old_label = "ENABLED" if old_state else "DISABLED"
            new_label = "ENABLED" if new_state else "DISABLED"
            description = f"wallbox charging: {old_label} → {new_label}"

        else:
            description = f"{device}: {old_state} → {new_state}"

        point = (
            Point("device_state_change")
            .tag("device", device)
            .field("description", description)
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)

    # Query logs from InfluxDB
    def query_logs(self, log_type, limit=50, days=30):
        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: -{days}d)
        |> filter(fn: (r) => r["_measurement"] == "{log_type}")
        |> pivot(
            rowKey: ["_time"],
            columnKey: ["_field"],
            valueColumn: "_value"
        )
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: {limit})
        '''

        tables = self.query_api.query(query, org=self.org)
        results = []

        # Process query results into a list of dicts with time and message
        for table in tables:
            for r in table.records:
                values = r.values
                ts = values["_time"].astimezone(
                    ZoneInfo("Europe/Vienna")
                ).isoformat(timespec="seconds")

                # Format message based on log type
                if log_type == "control_decision":
                    msg = (
                        f"device={values.get('device')} | "
                        f"action={values.get('action')} | "
                        f"reason={values.get('reason')} | "
                        f"success={values.get('success')} | "
                        f"extra={values.get('extra')}"
                    )

                elif log_type == "device_state_change":
                    msg = values.get("description") or "device state changed"

                elif log_type == "api_error":
                    device = values.get("device", "unknown")
                    endpoint = values.get("endpoint", "unknown")

                    error_text = (
                        values.get("message")
                        or values.get("error")
                        or "unknown error"
                    )

                    msg = f"{device} | {endpoint} | {error_text}"

                else:
                    msg = values.get("message")

                results.append({
                    "time": ts,
                    "message": msg
                })

        return results