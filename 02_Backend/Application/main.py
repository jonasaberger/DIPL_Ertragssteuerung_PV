import service_manager as sm
import db_bridge as ddb

# This is the main entry point for the DIPL_Ertragssteuerung_PV Backend application - DURING DEVELOPMENT.

# Swagger-Page http://localhost:5050/swagger
# InfluxDB-Dashboard: http://100.120.107.71:8086/orgs/946f4ae86d9a0222/dashboards/0f9e17345daef000?lower=now%28%29+-+24h

# Make sure to add these requirements when deploying on the RaspberryPI
# gpiozero==2.0.1
# RPi.GPIO==0.7.1

def main():
    print("Starting PV Backend Service...")
    service_manager = sm.ServiceManager()
    dbbridge = ddb.DB_Bridge()
    
    dbbridge.check_connection()
    service_manager.start_server()

if __name__ == "__main__":
    main()