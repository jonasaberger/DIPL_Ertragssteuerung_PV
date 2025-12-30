from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_swagger_ui import get_swaggerui_blueprint
from db_bridge import DB_Bridge
from wallbox_bridge import Wallbox_Bridge
from dotenv import load_dotenv, find_dotenv
from boiler_controller import BoilerController
import os
import platform
from datetime import datetime

SWAGGER_URL = '/swagger'
API_URL = '/static/swagger.json'  # make sure this file exists under Application/static/swagger.json or static/

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

    def configure_routes(self):
        # Health / connection check
        self.app.add_url_rule('/connection', 'connection', self.check_connection, methods=['GET'])

        # PV endpoints
        self.app.add_url_rule('/api/latest', 'latest', self.get_latest, methods=['GET'])
        self.app.add_url_rule('/api/history/daily', 'daily', self.get_daily, methods=['GET'])
        self.app.add_url_rule('/api/history/weekly', 'weekly', self.get_weekly, methods=['GET'])

        # Wallbox endpoints
        self.app.add_url_rule('/api/wallbox/latest', 'wallbox_latest', self.get_wallbox_latest, methods=['GET'])
        self.app.add_url_rule('/api/wallbox/setCharging','wallbox_set_charging',self.set_wallbox_allow,methods=['POST'])

        # Boiler endpoints
        self.app.add_url_rule('/api/boiler/latest', 'boiler_latest', self.get_boiler_latest, methods=['GET'])
        self.app.add_url_rule('/api/boiler/state', 'boiler_state', self.get_boiler_state, methods=['GET'])
        self.app.add_url_rule('/api/boiler/control', 'boiler_control', self.control_boiler, methods=['POST'])

        # EPEX endpoints
        self.app.add_url_rule('/api/epex/latest', 'epex_latest', self.get_epex_latest, methods=['GET'])

    # ----- Route Handlers -----
    def _json(self, payload, status=200):
        """Helper for consistent JSON responses."""
        return jsonify(payload), status

    def check_connection(self):
        try:
            self.db_bridge.check_connection()
            return jsonify({"status": "ok"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

    def get_latest(self):
        data = self.db_bridge.get_latest_pv_data()
        return (jsonify(data), 200) if data else (jsonify({"message": "No PV data found"}), 404)

    def get_daily(self):
        data = self.db_bridge.get_daily_pv_data()
        return (jsonify(data), 200) if data else (jsonify({"message": "No daily data found"}), 404)

    def get_weekly(self):
        data = self.db_bridge.get_weekly_pv_data()
        return (jsonify(data), 200) if data else (jsonify({"message": "No weekly data found"}), 404)

    def get_wallbox_latest(self):
        try:
            data = self.wallbox_bridge.fetch_data()
            if not data:
                return self._json({"message": "No Wallbox data found"}, 404)
            return self._json(data, 200)
        except Exception as e:
            err = f"Failed to fetch wallbox data: {e}"
            print(err)
            return self._json({"error": err}, 502)
    
    def set_wallbox_allow(self):
        payload = request.get_json(silent=True)
        if not payload or "allow" not in payload:
            return self._json({"error": "Missing 'allow' field"}, 400)

        try:
            result = self.wallbox_bridge.set_allow_charging(bool(payload["allow"]))
            return self._json(result, 200)
        except Exception as e:
            err = f"Failed to set wallbox charging state: {e}"
            print(err)
            return self._json({"error": err}, 502)

    def get_boiler_latest(self):
        try:
            db_data = self.db_bridge.get_latest_boiler_data()
        except Exception as e:
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
            # detect simulation: controller exposes relay attr; if relay is None -> simulated
            simulated = getattr(self.boiler_bridge, "relay", None) is None

            # state may be True/False or None
            if state is None:
                return self._json({"heating": None, "simulated": simulated, "message": "Hardware unavailable or simulated"}, 502)

            return self._json({"heating": state, "simulated": simulated}, 200)

        except Exception as e:
            err = f"Failed to read boiler state: {e}"
            print(err)
            return self._json({"error": err}, 500)

    def control_boiler(self):
        """
        POST JSON: { "action": "on" | "off" | "toggle" }
        Controls the boiler relay.
        """
        try:
            payload = request.get_json(silent=True)
            if not payload:
                return self._json({"error": "Missing JSON body"}, 400)

            action = (payload.get("action") or "").lower()
            if action not in ("on", "off", "toggle"):
                return self._json({"error": "Invalid action. Use: on/off/toggle"}, 400)

            if not hasattr(self.boiler_bridge, "control"):
                return self._json({"error": "Boiler control not available"}, 502)

            try:
                result = self.boiler_bridge.control(action)
            except ValueError as e:
                return self._json({"error": str(e)}, 400)
            except Exception as e:
                err = f"Failed to execute control action: {e}"
                print(err)
                return self._json({"error": err}, 500)

            # guard: ensure result structure is valid
            if not isinstance(result, dict) or "action" not in result or "result" not in result:
                return self._json({"error": "Invalid result from controller"}, 500)

            # detect simulation state: relay == None = simulated mode
            simulated = getattr(self.boiler_bridge, "relay", None) is None

            # extend the output with simulated info
            extended = {
                "action": result["action"],
                "result": result["result"],
                "simulated": simulated
            }

            return self._json(extended, 200)

        except Exception as e:
            err = f"Unexpected error in control_boiler: {e}"
            print(err)
            return self._json({"error": err}, 500)

    def get_epex_latest(self):
        data = self.db_bridge.get_latest_epex_data()
        return (jsonify(data), 200) if data else (jsonify({"message": "No EPEX data found"}), 404)
    
    