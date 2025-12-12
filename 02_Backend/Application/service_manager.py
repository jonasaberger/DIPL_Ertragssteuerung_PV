from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_swagger_ui import get_swaggerui_blueprint
from db_bridge import DB_Bridge
from wallbox_bridge import Wallbox_Bridge
from dotenv import load_dotenv, find_dotenv
from boiler_controller import BoilerController
import os

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

        # Wallbox endpoint
        self.app.add_url_rule('/api/wallbox/latest', 'wallbox_latest', self.get_wallbox_latest, methods=['GET'])

        # Boiler endpoints
        self.app.add_url_rule('/api/boiler/latest', 'boiler_latest', self.get_boiler_latest, methods=['GET'])
        self.app.add_url_rule('/api/boiler/state', 'boiler_state', self.get_boiler_state, methods=['GET'])
        self.app.add_url_rule('/api/boiler/control', 'boiler_control', self.control_boiler, methods=['POST'])

    # ----- Route Handlers -----
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
            return (jsonify(data), 200) if data else (jsonify({"message": "No Wallbox data found"}), 404)
        except Exception as e:
            return jsonify({"error": "Failed to fetch wallbox data", "detail": str(e)}), 502

    def get_boiler_latest(self):
        data = self.db_bridge.get_latest_boiler_data()
        return (jsonify(data), 200) if data else (jsonify({"message": "No Boiler data found"}), 404)
    
    def get_boiler_state(self):
        try:
            state = self.boiler_bridge.get_state()
            return jsonify({"heating": state}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    def control_boiler(self):
        """
        POST JSON: { "action": "on" | "off" | "toggle" }
        Controls the boiler relay.
        """
        try:
            payload = request.get_json(force=True)
            action = payload.get("action", "").lower()

            if action not in ("on", "off", "toggle"):
                return jsonify({"error": "Invalid action. Use: on/off/toggle"}), 400

            result = self.boiler_bridge.control(action)

            return jsonify(result), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500