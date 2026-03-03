import os
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from dotenv import find_dotenv, load_dotenv
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

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

        self.client = InfluxDBClient(url=self.url, token=self.token, org=self.org)
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.query_api = self.client.query_api()

    def _write(self, point: Point):
        self.write_api.write(bucket=self.bucket, org=self.org, record=point)

    # 1) SYSTEM EVENT
    #    Für: Start/Stop, Modus-Wechsel, Zeitplan-Updates,
    #         EPEX-Analysen, Sitzungs-Start, Prognose-Overrides, Scheduler-Fehler
    def system_event(self, level: str, source: str, message: str):
        point = (
            Point("system_event")
            .tag("level", level)     # info / warning / error
            .tag("source", source)   # backend / modus / zeitplan / boiler_automatik / wallbox_automatik / ...
            .field("message", message)
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)

    # 2) API ERROR
    #    Für: Verbindungsfehler zu Wallbox, InfluxDB, Forecast-Service
    def api_error(self, device: str, endpoint: str, error):
        point = (
            Point("api_error")
            .tag("device", device)
            .tag("endpoint", endpoint)
            .field("message", f"{device} Fehler bei {endpoint}: {error}")
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)

    # 3) DEVICE STATE CHANGE
    #    Für: Alle Zustandsänderungen von Boiler und Wallbox,
    def device_state_change(self, device: str, old_state, new_state, reason: str = "unbekannt"):
        if old_state is None or new_state is None:
            return
        if old_state == new_state:
            return

        if device == "boiler":
            old_label = "AN" if old_state else "AUS"
            new_label = "AN" if new_state else "AUS"
            description = f"Boiler: {old_label} → {new_label} | {reason}"

        elif device == "wallbox":
            old_label = "lädt" if old_state else "pausiert"
            new_label = "lädt" if new_state else "pausiert"
            description = f"Wallbox: {old_label} → {new_label} | {reason}"

        elif device == "wallbox_ampere":
            description = f"Wallbox Ladestrom: {old_state}A → {new_state}A | {reason}"

        else:
            description = f"{device}: {old_state} → {new_state} | {reason}"

        point = (
            Point("device_state_change")
            .tag("device", device)
            .field("description", description)
            .time(datetime.now(timezone.utc), WritePrecision.NS)
        )
        self._write(point)

    # QUERY
    def query_logs(self, log_type: str, limit: int = 50, days: int = 30):
        allowed = {"system_event", "api_error", "device_state_change"}
        if log_type not in allowed:
            raise ValueError(f"Ungültiger Log-Typ '{log_type}'. Erlaubt: {allowed}")

        query = f'''
        from(bucket: "{self.bucket}")
        |> range(start: -{days}d)
        |> filter(fn: (r) => r["_measurement"] == "{log_type}")
        |> pivot(
            rowKey: ["_time"],
            columnKey: ["_field"],
            valueColumn: "_value"
        )
        |> group()
        |> sort(columns: ["_time"], desc: true)
        |> limit(n: {limit})
        '''

        tables = self.query_api.query(query, org=self.org)
        results = []

        for table in tables:
            for r in table.records:
                values = r.values
                ts = values["_time"].astimezone(ZoneInfo("Europe/Vienna")).isoformat(timespec="seconds")

                if log_type == "device_state_change":
                    msg = values.get("description") or "Zustandsänderung"
                elif log_type == "api_error":
                    msg = values.get("message") or "Unbekannter API-Fehler"
                else:
                    msg = values.get("message") or ""

                results.append({"time": ts, "message": msg})

        return results