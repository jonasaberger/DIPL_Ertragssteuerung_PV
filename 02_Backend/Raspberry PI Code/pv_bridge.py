import requests
from decimal import Decimal
from dotenv import load_dotenv
import os

class PV_Bridge:
    def __init__(self):
        load_dotenv()
        self.url = os.getenv("URL_PV")

    # Method for safe conversion to Decimal -> Fehler bei Db falls Wert: None 
    def safe_decimal(self, value):
        try:
            return Decimal(value)
        except (TypeError, ValueError, ArithmeticError):
            return Decimal(0)

    # Method to fetch PV data from the API
    def fetch_data(self):
        try:
            response = requests.get(self.url)
            # Check if the request was successful else raise an error
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error has occured at calling PV-Data: {e}")
            return None
        
    # Method to parse the fetched data and extract relevant values
    def parse_data(self, data):
        if not data:
            return None
        try:
            # Navigating the JSON structure to get the required values
            site = data['Body']['Data']['Site']
            inverter = data['Body']['Data']['Inverters'].get('1', {}) 
            
            return {
                 "pv_power": self.safe_decimal(site.get('P_PV')),
                "grid_power": self.safe_decimal(site.get('P_Grid')),
                "load_power": self.safe_decimal(site.get('P_Load')),
                "battery_power": self.safe_decimal(site.get('P_Akku')),
                "soc": self.safe_decimal(inverter.get('SOC')),
                "e_day": self.safe_decimal(site.get('E_Day')),
                "e_year": self.safe_decimal(site.get('E_Year')),
                "e_total": self.safe_decimal(site.get('E_Total')),
                "rel_autonomy": self.safe_decimal(site.get('rel_Autonomy')),
                "rel_selfconsumption": self.safe_decimal(site.get('rel_SelfConsumption')),
            }
        except Exception as e:
            print(f"Fehler beim Parsen der PV-Daten: {e}")
            return None

'''
{
   "Body" : {
      "Data" : {
         "Inverters" : {
            "1" : {
               "Battery_Mode" : "normal",
               "DT" : 1,
               "E_Day" : null,
               "E_Total" : 20084390.948055554,
               "E_Year" : null,
               "P" : 425.57150268554688,
               "SOC" : 93.900000000000006
            }
         },
         "SecondaryMeters" : {},
         "Site" : {
            "BackupMode" : false,
            "BatteryStandby" : true,
            "E_Day" : null,
            "E_Total" : 20084390.948055554,
            "E_Year" : null,
            "Meter_Location" : "grid",
            "Mode" : "bidirectional",
            "P_Akku" : -660.33734130859375,
            "P_Grid" : -56.5,
            "P_Load" : -375.45938110351562,
            "P_PV" : 1147.7030258178711,
            "rel_Autonomy" : 100.0,
            "rel_SelfConsumption" : 86.920066452623189
         },
         "Smartloads" : {
            "OhmpilotEcos" : {},
            "Ohmpilots" : {}
         },
         "Version" : "13"
      }
   },
   "Head" : {
      "RequestArguments" : {},
      "Status" : {
         "Code" : 0,
         "Reason" : "",
         "UserMessage" : ""
      },
      "Timestamp" : "2025-09-28T16:05:31+00:00"
   }
}
''' 