from flask import Flask, jsonify
from flask_cors import CORS
from flask_swagger_ui import get_swaggerui_blueprint
from db_bridge import DB_Bridge

SWAGGER_URL = '/swagger'
API_URL = '/static/swagger.json'

swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,
    API_URL,
    config={
        'app_name': "PV_Backend_Service"
    }
)

class ServiceManager:
    def __init__(self, server_port=5050, host_ip='0.0.0.0'):
        self.server_port = server_port
        self.host_ip = host_ip
        self.app = Flask(__name__, static_folder='static')
        CORS(self.app, resources={r"/*": {"origins": "*"}})

        # Register Swagger UI
        self.app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

        # Initialize DB Bridge
        self.db_bridge = DB_Bridge()

        self.configure_routes()

    def start_server(self):
        self.app.run(host=self.host_ip, port=self.server_port)

    def configure_routes(self):
        # DB Connection-check
        self.app.add_url_rule('/connection', 'connection', self.check_connection, methods=['GET'])

        # PV Data endpoints
        self.app.add_url_rule('/api/latest', 'latest', self.get_latest, methods=['GET'])
        self.app.add_url_rule('/api/history/daily', 'daily', self.get_daily, methods=['GET'])
        self.app.add_url_rule('/api/history/weekly', 'weekly', self.get_weekly, methods=['GET'])

    # Endpoint implementations
    def check_connection(self):
        try:
            self.db_bridge.check_connection()
            return jsonify({"status": "ok"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
   
    def get_latest(self):
        data = self.db_bridge.get_latest_pv_data()
        if data:
            return jsonify(data)
        return jsonify({"message": "No data found"}), 404

    def get_daily(self):
        data = self.db_bridge.get_daily_pv_data()
        if data:
            return jsonify(data)
        return jsonify({"message": "No daily data found"}), 404

    def get_weekly(self):
        data = self.db_bridge.get_weekly_pv_data()
        if data:
            return jsonify(data)
        return jsonify({"message": "No weekly data found"}), 404

if __name__ == "__main__":
    service_manager = ServiceManager()
    service_manager.start_server()
