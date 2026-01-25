import os
import glob
import time
import platform

# import only for Linux system (sensor does not require gpiozero)
# keep try/except in case file reused elsewhere
try:
    # no gpio usage here for sensor-only file
    pass
except Exception:
    pass

# Initialise temperatur sensor if not done by os yet
if platform.system() == "Linux":
    os.system('modprobe w1-gpio')
    os.system('modprobe w1-therm')

class Boiler_Bridge:
    def __init__(self):
        # Define basedir + folder of temperator sensor(s); Sensor connected to GPIO17 (defined in /boot/firmware/config.txt)
        # initialize sensor only on Raspberry Pi
        if platform.system() != "Linux":
            # no 1-wire sensor on non-Linux systems
            self.device_file = None
        else:
            base_dir = '/sys/bus/w1/config/'
            device_folders = glob.glob(base_dir + '28*')
            if not device_folders:
                raise FileNotFoundError(
                    "No DS18B20 temperature sensor found under /sys/bus/w1/config/"
                )
            self.device_file = device_folders[0] + '/w1_slave'

########### Temperature Sensor ############

    def read_temp_raw(self):            # read temperatur sensor file, raw, no formatting
        if not self.device_file:
            return None
        with open(self.device_file, 'r') as f:
            lines = f.readlines()
        return lines

    def read_temp(self):                # format values read in temperatur sensor file
        if not self.device_file:
            return None
        lines = self.read_temp_raw()
        while lines[0].strip()[-3:] != 'YES':       # prepared for more than one temperature sensor, therefore array
            time.sleep(0.2)
            lines = self.read_temp_raw()
        equals_pos = lines[1].find('t=')            # filter position t= as after that the next 5 values are the temperatur *1000
        if equals_pos != -1:
            temp_string = lines[1][equals_pos+2:]
            temp_c = float(temp_string) / 1000.0    # value found / 1000 = temeratur in °C
            temp_c = int(temp_c)                    # remove comma values
            return temp_c
        return None
