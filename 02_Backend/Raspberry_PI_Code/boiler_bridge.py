import os
import glob
import time
import platform

# import only for Linux system
try:
    from gpiozero import LED
except Exception:
    LED = None

# Initialise temperatur sensor if not done by os yet
if platform.system() == "Linux":
    os.system('modprobe w1-gpio')
    os.system('modprobe w1-therm')

class Boiler_Bridge:
    def __init__(self, gpio_pin=26, inverted_logic=True):
        # Define basedir + folder of temperator sensor(s); Sensor connected to GPIO17 (defined in /boot/firmware/config.txt)
        # initialize sensor only on Raspberry Pi
        if platform.system() != "Linux":
            # no 1-wire sensor on non-Linux systems
            self.device_file = None
        else:
            base_dir = '/sys/bus/w1/devices/'
            device_folders = glob.glob(base_dir + '28*')
            if not device_folders:
                raise FileNotFoundError(
                    "No DS18B20 temperature sensor found under /sys/bus/w1/devices/"
                )
            self.device_file = device_folders[0] + '/w1_slave'

        # store relay settings
        self.gpio_pin = gpio_pin
        self.inverted_logic = inverted_logic

        # initialize relay
        self.relay = None
        if LED and platform.system() == "Linux":
            try:
                self.relay = LED(self.gpio_pin)
            except Exception:
                self.relay = None

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

########### Relay Control ############

    def _apply_logic(self, logical_on: bool):
        """
        Handles relay logic with optional inverted behavior.
        logical_on = True  -> boiler should heat
        """
        if not self.relay:
            # If GPIO not available (Windows/dev), simulate by returning logical state
            return logical_on

        # Determine physical relay state depending on inversion
        physical_on = not logical_on if self.inverted_logic else logical_on

        if physical_on:
            self.relay.on()     # GPIO HIGH
        else:
            self.relay.off()    # GPIO LOW

        return logical_on

    def turn_on(self):
        """ Turn boiler heating ON (logical on) """
        return self._apply_logic(True)

    def turn_off(self):
        """ Turn boiler heating OFF (logical off) """
        return self._apply_logic(False)

    def toggle(self):
        """ Toggle boiler heating state """
        state = self.get_state()
        if state is None:
            return None
        return self._apply_logic(not state)

    def get_state(self):
        """ Returns logical boiler state (True/False) or None if relay unavailable"""
        if not self.relay:
            return None

        phys = self.relay.is_lit
        logical = not phys if self.inverted_logic else phys
        return logical
