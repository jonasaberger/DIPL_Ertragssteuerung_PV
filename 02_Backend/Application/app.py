from managers.service_manager import ServiceManager

# Initialize service manager
service_manager = ServiceManager()

# Expose the Flask app for Gunicorn
app = service_manager.get_app()