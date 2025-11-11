import service_manager as sm
import db_bridge as ddb

# This is the main entry point for the DIPL_Ertragssteuerung_PV Backend application.
# Swagger UI is served at host_ip:server_port/swagger
# By default that would be http://localhost:5050/swagger

def main():
    print("Starting PV Backend Service...")
    service_manager = sm.ServiceManager()
    dbbridge = ddb.DB_Bridge()
    
    dbbridge.check_connection()
    service_manager.start_server()

if __name__ == "__main__":
    main()