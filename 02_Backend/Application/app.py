# This is the main entry point for the DIPL_Ertragssteuerung_PV Backend application - DURING PRODUCTION.
from service_manager import ServiceManager

# Create ServiceManager ONCE per worker
service_manager = ServiceManager()

# Expose Flask app for Hypercorn
app = service_manager.get_app()
