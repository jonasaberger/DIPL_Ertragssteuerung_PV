import os
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import find_dotenv, load_dotenv
from datetime import datetime, timezone


class LoggingBridge:
    def __init__(self):
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

    
    """
    Log-Types:
        - system_event	Start, schwere Fehler
        - api_error Externe APIs nicht erreichbar
        - control_decision Steueraktionen
        - device_state_change Zustandswechsel
    """

    # Internal write helper
    def _write(self, point: Point):
        self.write_api.write(
            bucket=self.bucket,
            org=self.org,
            record=point
        )

    #  Logs every control decision made by the backend
    def control_decision(self, device, action, reason, success=True, extra=None):
        point = (
            Point("control_decision")
            .tag("device", device)        # wallbox / boiler
            .tag("action", action)        # on / off / toggle / set_allow
            .tag("success", str(success))
            .field("reason", reason)      # pv_surplus / manual / scheduler -> For future purpose expansion
            .field("extra", str(extra) if extra else "")
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)

    # Logs system-level events.  Example: startup, shutdown, warnings
    def system_event(self, level, source, message):
        point = (
            Point("system_event")
            .tag("level", level)          # info / warning / error
            .tag("source", source)        # backend / scheduler
            .field("message", message)
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)

        """
        Example InfluxDB Line Protocol:
            _measurement: system_event
            _time: 2025-01-03T14:22:10Z
            level: info
            source: backend
            message: "PV Backend Service started / failed to start"
        """

    # Logs external API failures. Example: Wallbox, Fronius, EPEX
    def api_error(self, api, endpoint, error):
        point = (
            Point("api_error")
            .tag("api", api)             
            .tag("endpoint", endpoint)
            .field("error", str(error))
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)

    #   Logs any device state transition. Example: Boiler OFF -> ON
    def device_state_change(self, device, old_state, new_state):
        point = (
            Point("device_state_change")
            .tag("device", device)
            .field("old_state", str(old_state))
            .field("new_state", str(new_state))
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)
