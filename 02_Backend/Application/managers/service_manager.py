import os
import platform
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dotenv import load_dotenv, find_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_swagger_ui import get_swaggerui_blueprint

from managers.device_manager import DeviceManager
from managers.schedule_manager import ScheduleManager

from bridges.db_bridge import DB_Bridge
from bridges.logging_bridge import LoggingBridge

from controllers.wallbox_controller import WallboxController
from controllers.boiler_controller import BoilerController

from stores.system_mode_store import SystemMode, SystemModeStore
from stores.schedule_store import ScheduleStore
from stores.automatic_config_store import AutomaticConfigStore

from services.scheduler_service import SchedulerService
from services.pv_forecast_service import PVForecastService


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

        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        self.server_port = server_port
        self.host_ip = host_ip
        self.app = Flask(  __name__,  static_folder=os.path.join(BASE_DIR, "static"), static_url_path="/static")
        CORS(self.app, resources={r"/*": {"origins": "*"}})

        # Register Swagger UI
        self.app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)

        # Initialize database connection
        self.db_bridge = DB_Bridge()

        # Initialize wallbox bridge (live GETs)
        self.wallbox_controller = WallboxController()

        # Initialize boiler bridge (GPIO control)
        self.boiler_bridge = BoilerController()

        # Initialize logging bridge
        self.logger = LoggingBridge()

        # Initialize system mode
        self.mode_store = SystemModeStore()

        self.schedule_store = ScheduleStore()
        self.schedule_manager = ScheduleManager(self.schedule_store)

        # AUTOMATIC mode configuration store
        self.automatic_config_store = AutomaticConfigStore()

        # Initialize forecast service
        self.pv_forecast_service = PVForecastService()

        self.scheduler = SchedulerService(
             mode_store=self.mode_store,
            schedule_manager=self.schedule_manager,
            boiler=self.boiler_bridge,
            wallbox=self.wallbox_controller,
            db_bridge=self.db_bridge,
            logger=self.logger
        )
        self.scheduler.start()

        self.logger.system_event(
            level="info",
            source="backend",
            message="PV Backend Service started"
        )

        # Initialize the IP-/Device-Manager
        self.device_manager = DeviceManager()

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
        self.app.add_url_rule('/api/wallbox/setCurrent','wallbox_set_current',self.set_wallbox_current,methods=['POST'])

        # Boiler endpoints
        self.app.add_url_rule('/api/boiler/latest','boiler_latest',self.get_boiler_latest,methods=['GET'])
        self.app.add_url_rule('/api/boiler/state', 'boiler_state', self.get_boiler_state, methods=['GET'])
        self.app.add_url_rule('/api/boiler/control', 'boiler_control', self.control_boiler, methods=['POST'])

        # EPEX endpoints
        self.app.add_url_rule('/api/epex/latest', 'epex_latest', self.get_epex_latest, methods=['GET'])
        self.app.add_url_rule(
            '/api/epex/price-offset',
            'epex_price_offset',
            self.device_manager.epex_price_offset_endpoint,
            methods=['PUT']
        )

        # Monitoring-/State Enpoint
        self.app.add_url_rule('/api/state', 'state', self.get_state, methods=['GET'])

        # Logging endpoints
        self.app.add_url_rule('/api/logging', 'logging', self.get_logging, methods=['GET'])

        # Device IP-Manager
        self.app.add_url_rule('/api/devices/get_devices', 'get_devices', self.device_manager.get_devices, methods=['GET'])
        self.app.add_url_rule('/api/devices/get_device', 'get_device', self.device_manager.get_device, methods=['GET'])
        self.app.add_url_rule('/api/devices/admin/verify_admin_pw', 'verify_admin_pw', self.device_manager.verify_admin_pw, methods=['POST'])
        self.app.add_url_rule('/api/devices/edit_device', 'edit_device', self.edit_device_endpoint, methods=['POST'])
        self.app.add_url_rule('/api/devices/reset_devices', 'reset_devices', self.device_manager.reset_devices_endpoint, methods=["POST"])

        # Mode Management endpoints
        self.app.add_url_rule('/api/mode', 'mode', self.mode_endpoint, methods=['GET', 'POST'])
        self.app.add_url_rule('/api/schedule', 'schedule', self.schedule_endpoint, methods=['GET', 'PUT', 'POST'])
        self.app.add_url_rule('/api/schedule/reset','schedule_reset',self.schedule_reset_endpoint,methods=['POST'])

        # AUTOMATIC mode configuration endpoint
        self.app.add_url_rule("/api/automatic-config","automatic_config",self.automatic_config_endpoint,methods=["GET", "PUT", "POST"])

        # Forecast service endpoint
        self.app.add_url_rule( "/api/forecast", "forecast", self.get_forecast, methods=["GET"])


    ################################
    #### System State Endpoints ####
    ################################

    # GET /api/state - Get overall system state, including device connectivity and data freshness
    def get_state(self):
        status = {
            "backend": "ok",
            "influx": "unknown",
            "wallbox": "unknown",
            "boiler": "unknown",
            "epex": "unknown",
            "forecast": "unknown",
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
            data = self.wallbox_controller.fetch_data()
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
            
        # PV Forecast
        try:
            forecast_data = self.pv_forecast_service.get_forecast()

            if not forecast_data:
                status["forecast"] = "no_data"
            else:
                status["forecast"] = "ok"

        except Exception as e:
            status["forecast"] = "error"
            self.logger.system_event(
                level="error",
                source="monitoring",
                message=f"Forecast service failed: {e}"
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

    # Device management endpoint: Edit device configuration and AUTO-RELOAD AFFECTED CONTROLLERS 
    def edit_device_endpoint(self):
        """Edit device and automatically reload affected controllers"""
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Missing JSON body"}), 400

        device_id = data.get("deviceId")
        password = data.get("password")
        payload = data.get("payload")

        if not device_id or not password or not payload:
            return jsonify({"error": "Missing required fields: deviceId, password, payload"}), 400

        try:
            # Edit the device config
            updated_devices = self.device_manager.edit_device_logic(device_id, payload, password)
        except KeyError as e:
            return jsonify({"error": str(e)}), 404

        if updated_devices is None:
            return jsonify({"success": False, "message": "Invalid admin password"}), 401

        # Auto-reload affected devices
        reload_results = {"reloaded": [], "failed": []}
        
        # Reload based on which device was edited
        if device_id == "wallbox":
            try:
                self.wallbox_controller.load_config()
                reload_results["reloaded"].append("wallbox")
            except Exception as e:
                reload_results["failed"].append({"device": "wallbox", "error": str(e)})
        
        # Add other device-specific reloads as needed
        # 
        #
        
        # Log the change
        self.logger.system_event(
            level="info",
            source="device_config",
            message=f"Device '{device_id}' configuration updated and reloaded"
        )

        return jsonify({
            "success": True,
            "devices": self.device_manager.get_devices(),
            "reload": reload_results
        }), 200

    # Route Handlers
    def _json(self, payload, status=200):
        """Helper for consistent JSON responses."""
        return jsonify(payload), status

    def check_connection(self):
        try:
            self.db_bridge.check_connection()
            return jsonify({"status": "ok", "influx": "reachable"})
        except Exception as e:
            # SYSTEM ERROR LOG
            self.logger.system_event(
                level="error",
                source="backend",
                message=f"InfluxDB connection failed: {e}"
            )
            return jsonify({"status": "error", "message": str(e)}), 500

    #########################
    ### PV Data Endpoints ###
    #########################

    # GET /api/pv/latest - Get the latest PV measurement
    def get_latest(self):
        data = self.db_bridge.get_latest_pv_data()
        if not data:
            return jsonify({"message": "No PV data found"}), 404

        # Rename _kw keys back to original field names for frontend compatibility
        frontend_data = {**data}
        frontend_data["pv_power"]      = frontend_data.pop("pv_power_kw",      None)
        frontend_data["load_power"]    = frontend_data.pop("house_load_kw",    None)
        frontend_data["battery_power"] = frontend_data.pop("battery_power_kw", None)

        frontend_data = {k: v for k, v in frontend_data.items() if v is not None}

        return jsonify(frontend_data), 200

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
    

    #########################
    ### Wallbox Endpoints ###
    #########################

    def get_wallbox_latest(self):
        try:
            data = self.wallbox_controller.fetch_data()
            if not data:
                return self._json({"message": "No Wallbox data found"}, 404)
            return self._json(data, 200)
        except Exception as e:
            # API ERROR LOG 
            self.logger.api_error(
                device="wallbox",
                endpoint="/api/wallbox/latest",
                error=e
            )
            err = f"Failed to fetch wallbox data: {e}"
            print(err)
            return self._json({"error": err}, 502)
    
    # Wallbox: POST JSON: { "allow": true | false }
    def set_wallbox_allow(self):
        if self.mode_store.get() in (SystemMode.TIME_CONTROLLED, SystemMode.AUTOMATIC):
            return self._json(
                {
                    "error": "Manual wallbox control disabled in AUTOMATIC and TIME_CONTROLLED mode"
                },
                403
            )

        payload = request.get_json(silent=True)
        if not payload or "allow" not in payload:
            return self._json({"error": "Missing 'allow' field"}, 400)

        # Logging purpose: Capture the old state before attempting to change it, to log the state change if it occurs
        old_state = self.wallbox_controller.get_allow_state()

        try:
            result = self.wallbox_controller.set_allow_charging(bool(payload["allow"]))

            # Logging purpose: Capture the new state after the change, to log the state change if it differs from the old state
            new_state = self.wallbox_controller.get_allow_state()

            # CONTROL DECISION LOG 
            self.logger.control_decision(
                device="wallbox",
                action="set_allow",
                reason="manual_api_call",
                success=True,
                extra=result
            )

            # DEVICE STATE CHANGE 
            if old_state != new_state:
                self.logger.device_state_change(
                    device="wallbox",
                    old_state=old_state,
                    new_state=new_state
                )

            return self._json(result, 200)

        except Exception as e:
            self.logger.api_error(
                device="wallbox",
                endpoint="/api/wallbox/setCharging",
                error=e
            )
            return self._json({"error": str(e)}, 502)
    
     # POST JSON: { "amp": 6 | 10 | 12 | 14 | 16 }
    def set_wallbox_current(self):
        # Manual control disabled in automatic modes
        if self.mode_store.get() in (SystemMode.TIME_CONTROLLED, SystemMode.AUTOMATIC):
            return self._json(
                {
                    "error": "Manual wallbox control disabled in AUTOMATIC and TIME_CONTROLLED mode"
                },
                403
            )

        payload = request.get_json(silent=True)

        if not payload or "amp" not in payload:
            return self._json({"error": "Missing 'amp' field"}, 400)

        try:
            amp = int(payload["amp"])

            # Old value for state-change logging
            old_data = self.wallbox_controller.fetch_data()
            old_amp = old_data.get("amp")

            result = self.wallbox_controller.set_charging_ampere(amp)

            # New value for state-change logging
            new_data = self.wallbox_controller.fetch_data()
            new_amp = new_data.get("amp")

            # CONTROL DECISION LOG
            self.logger.control_decision(
                device="wallbox",
                action="set_ampere",
                reason="manual_api_call",
                success=True,
                extra=result
            )

            # DEVICE STATE CHANGE LOG
            if old_amp != new_amp:
                self.logger.device_state_change(
                    device="wallbox_ampere",
                    old_state=old_amp,
                    new_state=new_amp
                )

            return self._json(result, 200)

        except ValueError as e:
            return self._json({"error": str(e)}, 400)

        except Exception as e:
            # API ERROR LOG
            self.logger.api_error(
                device="wallbox",
                endpoint="/api/wallbox/setCurrent",
                error=e
            )
            return self._json({"error": str(e)}, 502)

    ############################
    ##### Boiler Endpoints #####
    ############################

    # GET /api/boiler/latest - Get the latest boiler measurement
    def get_boiler_latest(self):
        try:
            db_data = self.db_bridge.get_latest_boiler_data()
        except Exception as e:

            # API ERROR LOG 
            self.logger.api_error(
                device="influxdb",
                endpoint="get_latest_boiler_data",
                error=e
            )
            err = f"Failed to query DB for boiler data: {e}"
            print(err)
            return self._json({"error": err}, 500)

        if not db_data:
            return self._json({"message": "No Boiler data found"}, 404)

        return self._json(db_data, 200)
    
    # GET /api/boiler/state - Get current boiler state (heating on/off + simulated or real)
    def get_boiler_state(self):
        try:
            if not hasattr(self.boiler_bridge, "get_state"):
                return self._json({"error": "Boiler control not available"}, 502)

            state = self.boiler_bridge.get_state()
            simulated = getattr(self.boiler_bridge, "relay", None) is None

            return self._json(
                {
                    "heating": state,
                    "simulated": simulated
                },
                200
            )

        except Exception as e:
            self.logger.api_error(
                device="boiler",
                endpoint="/api/boiler/state",
                error=e
            )
            return self._json({"error": str(e)}, 500)

        
    # POST JSON: { "action": "on" | "off" | "toggle" }
    def control_boiler(self):

        if self.mode_store.get() in (SystemMode.TIME_CONTROLLED, SystemMode.AUTOMATIC):
            return self._json(
                {
                    "error": "Manual boiler control disabled in AUTOMATIC and TIME_CONTROLLED mode"
                },
                403
            )

        payload = request.get_json(silent=True)
        if not payload:
            return self._json({"error": "Missing JSON body"}, 400)

        action = (payload.get("action") or "").lower()
        if action not in ("on", "off", "toggle"):
            return self._json({"error": "Invalid action. Use: on/off/toggle"}, 400)

        old_state = self.boiler_bridge.get_state()

        if action == "on" and old_state is True:
            return self._json({"heating": True, "message": "already on"}, 200)

        if action == "off" and old_state is False:
            return self._json({"heating": False, "message": "already off"}, 200)

        self.boiler_bridge.control(action)
        new_state = self.boiler_bridge.get_state()

        # CONTROL DECISION LOG
        self.logger.control_decision(
            device="boiler",
            action=action,
            reason="manual_api_call",
            success=True
        )

        if old_state != new_state:
            # DEVICE STATE CHANGE LOG
            self.logger.device_state_change(
                device="boiler",
                old_state=old_state,
                new_state=new_state
            )

        simulated = getattr(self.boiler_bridge, "relay", None) is None

        return self._json(
            {
                "heating": new_state,
                "simulated": simulated
            },
            200
        )
    

    ########################
    #### EPEX Endpoints ####
    ########################

    # GET /api/epex/latest - Get the latest EPEX price data with applied offset
    def get_epex_latest(self):
        try:
            data = self.db_bridge.get_latest_epex_data()
            
            if not data:
                return jsonify({"message": "No EPEX data found"}), 404
            
            # Add the configured price offset
            price_offset = self.device_manager.get_epex_price_offset()
            
            if "price" in data:
                data["price_raw"] = data["price"]  # Original DB price
                data["price"] = data["price"] + price_offset  # Adjusted price
                data["price_offset"] = price_offset  # For transparency
            return jsonify(data), 200
            
        except Exception as e:
            self.logger.api_error(
                device="epex",
                endpoint="/api/epex/latest",
                error=e
            )
            return jsonify({"error": "EPEX data unavailable"}), 502
        
    ########################
    #### Mode Endpoints ####
    ########################

    # GET / POST system mode
    def mode_endpoint(self):
        # Get: current mode
        if request.method == 'GET':
            return self._json({
                "mode": self.mode_store.get().value
            })
        
        # Post: set mode
        payload = request.get_json(silent=True)
        if not payload or "mode" not in payload:
            return self._json({"error": "Missing 'mode' field"}, 400)
        
        try:
            mode = SystemMode(payload["mode"])
            self.mode_store.set(mode)

            self.logger.system_event(
                level="info",
                source="mode",
                message=f"System mode set to {mode.value}"
            )

            return self._json({"mode": mode.value})
        
        except ValueError:
            return self._json({"error": "Invalid mode. Use AUTOMATIC | MANUAL | TIME_CONTROLLED"},400)
        
    # GET / PUT / POST schedule configuration
    def schedule_endpoint(self):
        # GET: actual effective schedule configuration (after applying overrides)
        if request.method == "GET":
            return self._json(self.schedule_store.get_effective())

        # PUT: Set override 
        if request.method == "PUT":
            payload = request.get_json(force=True)
            if not payload:
                return self._json({"error": "Missing JSON body"}, 400)

            self.schedule_store.update(payload)

            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="info",
                source="schedule",
                message="Schedule configuration updated"
            )

            return self._json({"status": "ok"})

        # POST: RESET to default
        if request.method == "POST":
            self.schedule_store.reset_to_default()

            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="info",
                source="schedule",
                message="Schedule reset to default"
            )

            return self._json({
                "status": "ok",
                "message": "Schedule reset to default"
            })
    
    # POST: Reset schedule to default
    def schedule_reset_endpoint(self):
        self.schedule_store.reset_to_default()

        self.logger.system_event(
            level="info",
            source="schedule",
            message="Schedule reset to default configuration"
        )

        return self._json({
            "status": "ok",
            "message": "Schedule reset to default"
        })
    
    def automatic_config_endpoint(self):
        # GET: actual effective AUTOMATIC mode configuration
        if request.method == "GET":
            return self._json(self.automatic_config_store.get())

        # PUT: Partial Update
        if request.method == "PUT":
            payload = request.get_json(force=True)
            if not payload:
                return self._json({"error": "Missing JSON body"}, 400)

            self.automatic_config_store.update(payload)

            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="info",
                source="automatic_config",
                message="AUTOMATIC configuration updated"
            )

            return self._json({"status": "ok"})

        # POST: Reset to default
        if request.method == "POST":
            self.automatic_config_store.reset_to_default()

            # SYSTEM EVENT LOG
            self.logger.system_event(
                level="info",
                source="automatic_config",
                message="AUTOMATIC configuration reset to default"
            )

            return self._json({
                "status": "ok",
                "message": "AUTOMATIC configuration reset to default"
            })
        
    # GET /api/forecast - Get PV forecast for today and tomorrow
    def get_forecast(self):
        try:
            data = self.pv_forecast_service.get_forecast()
            return self._json(data, 200)
        except Exception as e:
            # API ERROR LOG
            self.logger.api_error(
                device="forecast",
                endpoint="/api/forecast",
                error=e
            )
            return self._json(
                {"error": "Forecast service unavailable"},
                502
            )