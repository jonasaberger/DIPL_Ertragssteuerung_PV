class WallboxDynamicController:
# Dynamic charge controller for PV-optimized charging
    def __init__(self, hysteresis_kw=0.3, min_surplus_kw=1.4, battery_protection_soc=20,max_battery_discharge_kw=0.5):
        self.hysteresis = hysteresis_kw
        self.min_surplus = min_surplus_kw
        self.battery_protection_soc = battery_protection_soc
        self.max_battery_discharge = max_battery_discharge_kw
        
        #  Current state for hysteresis
        self.current_ampere = 0
        
        # Ampere → kW Mapping (230V, 1 Phase)
        # P = U × I = 230V × I
        self.ampere_to_kw = {
            0: 0.0,
            6: 1.38,   # 230V × 6A
            10: 2.30,  # 230V × 10A
            12: 2.76,  # 230V × 12A
            14: 3.22,  # 230V × 14A
            16: 3.68   # 230V × 16A
        }
        
        # Sorted ampere values ​​for selection
        self.allowed_amperes = sorted(self.ampere_to_kw.keys())
    
    # Berechnet optimalen Ladestrom
    def calculate_optimal_ampere(self, pv_surplus_kw, battery_power_kw, battery_soc, current_ampere=None):
        # Save current hysteresis value
        if current_ampere is not None:
            self.current_ampere = current_ampere
        
        # 1. Battery protection: Do not charge if SOC is too low
        if battery_soc < self.battery_protection_soc:
            return 0
        
        # 2. Battery protection: If the battery is severely discharged, stop
        if battery_power_kw < -self.max_battery_discharge:
            return 0
        
        # 3. Calculate the effective surplus
        # Strategy: Slight battery discharge is OK (buffer utilization)
        effective_surplus = pv_surplus_kw
        
        # Use as a buffer if the battery is slightly discharging (< 500W)
        if -self.max_battery_discharge < battery_power_kw < 0:
            # Consider 50% of the discharge as usable
            effective_surplus += abs(battery_power_kw) * 0.5
        
       # 4. Finding the optimal amperage (with hysteresis)
        optimal = self._find_optimal_ampere_with_hysteresis(effective_surplus)
        
        return optimal
    
    # Finds optimal amperage with hysteresis Hysteresis / prevents constant fluctuations in voltage with varying PV output
    def _find_optimal_ampere_with_hysteresis(self, available_kw):
        
        optimal_amp = 0
        
        # Check for each ampere value
        for amp in self.allowed_amperes:
            required_kw = self.ampere_to_kw[amp]
            
            # Apply hysteresis
            if amp > self.current_ampere:
                # Upshifting: Requires more than required + hysteresis
                threshold = required_kw + self.hysteresis
            elif amp < self.current_ampere:
                # Downshifting: Uses less than required - Hysteresis
                threshold = required_kw - self.hysteresis
            else:
                # Same value: No hysteresis
                threshold = required_kw
            
            # If there is enough surplus for this value
            if available_kw >= threshold:
                optimal_amp = amp
            else:
                # Not enough for this value
                break
        
        return optimal_amp
    
    # Complete charging decision with justification
    def get_charging_decision(self, pv_surplus_kw, battery_power_kw, battery_soc,current_ampere=0):
    
        # Battery-state
        if battery_power_kw > 0.1:
            battery_status = "charging"
        elif battery_power_kw < -0.1:
            battery_status = "discharging"
        else:
            battery_status = "idle"
        
        # Calculate optimal amperage
        optimal_ampere = self.calculate_optimal_ampere(
            pv_surplus_kw=pv_surplus_kw,
            battery_power_kw=battery_power_kw,
            battery_soc=battery_soc,
            current_ampere=current_ampere
        )
        
       # Justification
        if battery_soc < self.battery_protection_soc:
            reason = f"battery_protection (SOC {battery_soc}% < {self.battery_protection_soc}%)"
        elif battery_power_kw < -self.max_battery_discharge:
            reason = f"battery_discharge_limit ({battery_power_kw:.1f} kW)"
        elif optimal_ampere == 0:
            reason = f"insufficient_pv (surplus {pv_surplus_kw:.1f} kW < {self.min_surplus} kW)"
        else:
            reason = f"pv_surplus_optimal (surplus {pv_surplus_kw:.1f} kW → {optimal_ampere}A)"
        
        return {
            'ampere': optimal_ampere,
            'allow_charging': optimal_ampere > 0,
            'reason': reason,
            'surplus_kw': round(pv_surplus_kw, 2),
            'battery_status': battery_status,
            'battery_soc': battery_soc,
            'battery_power_kw': round(battery_power_kw, 2)
        }