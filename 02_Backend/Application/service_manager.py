from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_swagger_ui import get_swaggerui_blueprint

from device_manager import DeviceManager
from db_bridge import DB_Bridge
from wallbox_bridge import Wallbox_Bridge
from dotenv import load_dotenv, find_dotenv
from boiler_controller import BoilerController

import platform
from datetime import datetime
from logging_bridge import LoggingBridge
from zoneinfo import ZoneInfo
from datetime import timedelta

SWAGGER_URL = '/swagger'
API_URL = '/static/swagger.json'  

swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL, API_URL, config={'app_name': "PV_Backend_Service"}
)

class ServiceManager:
    def __init__(self, server_port=5050, host_ip='0.0.0.0'):
        # Load env so wallbox urls are available
        env_path = find_dotenv()
        if env_path:
            load_dotenv(env_path)

        self.server_port = server_port
        self.host_ip = host_ip
        self.app = Flask(__name__, static_folder='static')
        CORS(self.app, resources={r"/*": {"origins": "*"}})

        # Register Swagger UI
        self.app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

        # Initialize database connection
        self.db_bridge = DB_Bridge()

        # Initialize wallbox bridge (live GETs)
        self.wallbox_bridge = Wallbox_Bridge()

        # Initialize boiler bridge (GPIO control)
        self.boiler_bridge = BoilerController()

        # Initialize logging bridge
        self.logger = LoggingBridge()

        # Initialize the IP-/Device-Manager
        self.device_manager = DeviceManager()

        # ---- SYSTEM EVENT LOG ----
        self.logger.system_event(
            level="info",
            source="backend",
            message="PV Backend Service started"
        )

        # Simple startup logs: platform + boiler control availability
        print(f"[{datetime.now().isoformat()}] Service starting on platform: {platform.system()}")
        if self.boiler_bridge and hasattr(self.boiler_bridge, "get_state"):
            hw = "GPIO available" if getattr(self.boiler_bridge, "relay", None) else "GPIO not available (simulated)"
            print(f"[{datetime.now().isoformat()}] BoilerController initialized: {hw}")
        else:
            print(f"[{datetime.now().isoformat()}] BoilerController not initialized correctly; control unavailable")

        # Configure all routes
        self.configure_routes()

    def start_server(self):
        self.app.run(host=self.host_ip, port=self.server_port)

    def get_app(self):
        return self.app

    def configure_routes(self):
        # Health / connection check
        self.app.add_url_rule('/connection', 'connection', self.check_connection, methods=['GET'])

        # PV endpoints
        self.app.add_url_rule('/api/pv/latest', 'latest', self.get_latest, methods=['GET'])
        self.app.add_url_rule('/api/pv/daily', 'pv_daily', self.get_daily, methods=['GET'])
        self.app.add_url_rule('/api/pv/monthly', 'pv_monthly', self.get_monthly, methods=['GET'])
        self.app.add_url_rule('/api/pv/yearly', 'pv_yearly', self.get_yearly, methods=['GET'])

        # Wallbox endpoints
        self.app.add_url_rule('/api/wallbox/latest', 'wallbox_latest', self.get_wallbox_latest, methods=['GET'])
        self.app.add_url_rule('/api/wallbox/setCharging','wallbox_set_charging',self.set_wallbox_allow,methods=['POST'])

        # Boiler endpoints
        self.app.add_url_rule('/api/boiler/latest','boiler_latest',self.get_boiler_latest,methods=['GET'])
        self.app.add_url_rule('/api/boiler/state', 'boiler_state', self.get_boiler_state, methods=['GET'])
        self.app.add_url_rule('/api/boiler/control', 'boiler_control', self.control_boiler, methods=['POST'])

        # EPEX endpoints
        self.app.add_url_rule('/api/epex/latest', 'epex_latest', self.get_epex_latest, methods=['GET'])

        # Monitoring-/State Enpoint
        self.app.add_url_rule('/api/state', 'state', self.get_state, methods=['GET'])

        # Logging endpoints
        self.app.add_url_rule('/api/logging', 'logging', self.get_logging, methods=['GET'])

        # Device IP-Manager
        self.app.add_url_rule('/api/devices/get_devices', 'get_devices', self.device_manager.get_devices, methods=['GET'])
        self.app.add_url_rule('/api/devices/get_device', 'get_device', self.device_manager.get_device, methods=['GET'])
        self.app.add_url_rule(
            '/api/devices/admin/verify_admin_pw',
            'verify_admin_pw',
            self.device_manager.verify_admin_pw,
            methods=['POST']
        )
        self.app.add_url_rule('/api/devices/edit_device', 'edit_device', self.device_manager.edit_device_endpoint, methods=['POST'])

    # ----- Route Handlers -----
    def _json(self, payload, status=200):
        """Helper for consistent JSON responses."""
        return jsonify(payload), status

    def check_connection(self):
        try:
            self.db_bridge.check_connection()
            return jsonify({"status": "ok", "influx": "reachable"})
        except Exception as e:
            # ---- SYSTEM ERROR LOG ----
            self.logger.system_event(
                level="error",
                source="backend",
                message=f"InfluxDB connection failed: {e}"
            )
            return jsonify({"status": "error", "message": str(e)}), 500

    def get_latest(self):
        data = self.db_bridge.get_latest_pv_data()
        return (jsonify(data), 200) if data else (jsonify({"message": "No PV data found"}), 404)

    # GET /api/pv/daily?date=YYYY-MM-DD
    def get_daily(self):
        date = request.args.get("date")  # optional: YYYY-MM-DD
        try:
            data = self.db_bridge.get_daily_pv_data(date)
        except ValueError as e:
            # Invalid date format
            return self._json({"error": str(e)}, 400)
        if not data:
            return self._json(
                {"message": "No data collected for the selected day"},
                404
            )

        return self._json(data, 200)

     # GET /api/pv/monthly?month=YYYY-MM
    def get_monthly(self):
        month = request.args.get("month")  # optional: YYYY-MM
        try:
            data = self.db_bridge.get_monthly_pv_data(month)
        except ValueError as e:
            # Invalid month format
            return self._json({"error": str(e)}, 400)
        if not data:
            return self._json(
                {"message": "No data collected for the selected month"},
                404
            )

        return self._json(data, 200)

    # GET /api/pv/yearly?year=YYYY
    def get_yearly(self):
        year = request.args.get("year")  # optional: YYYY
        try:
            year = int(year) if year else None
            data = self.db_bridge.get_yearly_pv_data(year)
        except ValueError:
            # Invalid year format
            return self._json(
                {"error": "Invalid year format. Use YYYY"},
                400
            )
        if not data:
            return self._json(
                {"message": "No data collected for the selected year"},
                404
            )

        return self._json(data, 200)

    def get_wallbox_latest(self):
        try:
            data = self.wallbox_bridge.fetch_data()
            if not data:
                return self._json({"message": "No Wallbox data found"}, 404)
            return self._json(data, 200)
        except Exception as e:
            # ---- API ERROR LOG ----
            self.logger.api_error(
                api="wallbox",
                endpoint="/api/wallbox/latest",
                error=e
            )
            err = f"Failed to fetch wallbox data: {e}"
            print(err)
            return self._json({"error": err}, 502)
    
    def set_wallbox_allow(self):
        payload = request.get_json(silent=True)
        if not payload or "allow" not in payload:
            return self._json({"error": "Missing 'allow' field"}, 400)

        try:
            result = self.wallbox_bridge.set_allow_charging(bool(payload["allow"]))

            # ---- CONTROL DECISION LOG ----
            self.logger.control_decision(
                device="wallbox",
                action="set_allow",
                reason="manual_api_call",
                success=True,
                extra=result
            )
            return self._json(result, 200)
        
        except Exception as e:
            # ---- API ERROR LOG ----
            self.logger.api_error(
                api="wallbox",
                endpoint="/api/wallbox/setCharging",
                error=e
            )
            err = f"Failed to set wallbox charging state: {e}"
            print(err)
            return self._json({"error": err}, 502)

    def get_boiler_latest(self):
        try:
            db_data = self.db_bridge.get_latest_boiler_data()
        except Exception as e:
            # ---- API ERROR LOG ----
            self.logger.api_error(
                api="influxdb",
                endpoint="get_latest_boiler_data",
                error=e
            )
            err = f"Failed to query DB for boiler data: {e}"
            print(err)
            return self._json({"error": err}, 500)

        if not db_data:
            return self._json({"message": "No Boiler data found"}, 404)

        return self._json(db_data, 200)
    
    def get_boiler_state(self):
        try:
            if not hasattr(self.boiler_bridge, "get_state"):
                return self._json({"error": "Boiler control not available"}, 502)

            state = self.boiler_bridge.get_state()
            simulated = getattr(self.boiler_bridge, "relay", None) is None

            if state is None:
                return self._json({"heating": None, "simulated": simulated, "message": "Hardware unavailable or simulated"}, 502)

            return self._json({"heating": state, "simulated": simulated}, 200)

        except Exception as e:
            # ---- API ERROR LOG ----
            self.logger.api_error(
                api="boiler",
                endpoint="/api/boiler/state",
                error=e
            )
            err = f"Failed to read boiler state: {e}"
            print(err)
            return self._json({"error": err}, 500)
        
    # POST JSON: { "action": "on" | "off" | "toggle" }, Controls the boiler relay.
    def control_boiler(self):
        try:
            payload = request.get_json(silent=True)
            if not payload:
                return self._json({"error": "Missing JSON body"}, 400)

            action = (payload.get("action") or "").lower()
            if action not in ("on", "off", "toggle"):
                return self._json({"error": "Invalid action. Use: on/off/toggle"}, 400)

            if not hasattr(self.boiler_bridge, "control"):
                return self._json({"error": "Boiler control not available"}, 502)

            old_state = self.boiler_bridge.get_state()

            try:
                result = self.boiler_bridge.control(action)
            except ValueError as e:
                return self._json({"error": str(e)}, 400)
            except Exception as e:
                # ---- API ERROR LOG ----
                self.logger.api_error(
                    api="boiler",
                    endpoint="/api/boiler/control",
                    error=e
                )
                err = f"Failed to execute control action: {e}"
                print(err)
                return self._json({"error": err}, 500)

            new_state = self.boiler_bridge.get_state()

            # ---- DEVICE STATE CHANGE LOG ----
            self.logger.device_state_change(
                device="boiler",
                old_state=old_state,
                new_state=new_state
            )

            # ---- CONTROL DECISION LOG ----
            self.logger.control_decision(
                device="boiler",
                action=action,
                reason="manual_api_call",
                success=True
            )

            simulated = getattr(self.boiler_bridge, "relay", None) is None

            extended = {
                "action": result["action"],
                "result": result["result"],
                "simulated": simulated
            }

            return self._json(extended, 200)

        except Exception as e:
            # ---- SYSTEM ERROR LOG ----
            self.logger.system_event(
                level="error",
                source="boiler",
                message=f"Unexpected error in control_boiler: {e}"
            )
            err = f"Unexpected error in control_boiler: {e}"
            print(err)
            return self._json({"error": err}, 500)

    def get_epex_latest(self):
        try:
            data = self.db_bridge.get_latest_epex_data()
            return (jsonify(data), 200) if data else (jsonify({"message": "No EPEX data found"}), 404)
        except Exception as e:
            # ---- API ERROR LOG ----
            self.logger.api_error(
                api="epex",
                endpoint="/api/epex/latest",
                error=e
            )
            return jsonify({"error": "EPEX data unavailable"}), 502
    
    # Monitoring / Status endpoint: Returns a compact system health overview. This endpoint does NOT control anything – read-only monitoring.
    def get_state(self):
        status = {
            "backend": "ok",
            "influx": "unknown",
            "wallbox": "unknown",
            "boiler": "unknown",
            "epex": "unknown",
            "timestamp": datetime.now(ZoneInfo("Europe/Vienna")).isoformat()
        }

        # InfluxDB
        try:
            self.db_bridge.check_connection()
            status["influx"] = "ok"
        except Exception as e:
            status["influx"] = "error"
            self.logger.system_event(
                level="error",
                source="monitoring",
                message=f"InfluxDB not reachable: {e}"
            )

        # Wallbox
        try:
            data = self.wallbox_bridge.fetch_data()
            status["wallbox"] = "ok" if data else "no_data"
        except Exception:
            status["wallbox"] = "timeout"

        # Boiler
        try:
            if not hasattr(self.boiler_bridge, "get_state"):
                status["boiler"] = "unavailable"
            else:
                simulated = getattr(self.boiler_bridge, "relay", None) is None
                status["boiler"] = "simulated" if simulated else "ok"
        except Exception:
            status["boiler"] = "error"

        # EPEX
        try:
            epex_data = self.db_bridge.get_latest_epex_data()

            if not epex_data or "_time" not in epex_data:
                status["epex"] = "no_data"
            else:
                epex_ts = datetime.fromisoformat(epex_data["_time"])
                now = datetime.now(ZoneInfo("Europe/Vienna"))

                if now - epex_ts > timedelta(hours=2):
                    status["epex"] = "stale"
                else:
                    status["epex"] = "ok"

        except Exception as e:
            status["epex"] = "error"
            self.logger.system_event(
                level="error",
                source="monitoring",
                message=f"EPEX data check failed: {e}"
        )

        return jsonify(status), 200
    
    # Logging endpoint: Returns filtered log entries from InfluxDB logging bucket
    def get_logging(self):

        log_type = request.args.get("type")
        limit = int(request.args.get("limit", 50))

        if not log_type:
            return self._json(
                {"error": "Missing query parameter: type"},
                400
            )

        try:
            logs = self.logger.query_logs(
                log_type=log_type,
                limit=limit,
                days=30
            )
            return self._json(logs, 200)

        except ValueError as e:
            return self._json({"error": str(e)}, 400)

        except Exception as e:
            self.logger.system_event(
                level="error",
                source="logging",
                message=f"Failed to fetch logging data: {e}"
            )
            return self._json(
                {"error": "Failed to fetch logging data"},
                500
            )