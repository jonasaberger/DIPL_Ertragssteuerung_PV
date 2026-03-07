class PVSurplusService:
    def __init__(self, db_bridge):
        self.db = db_bridge

    # Returns current PV surplus in kW (Positive = available surplus | Negative = grid consumption)
    def get_surplus_kw(self) -> float:
        data = self.db.get_latest_pv_data()
        if data is None:
            raise RuntimeError("PV data unavailable")

        pv_power     = float(data.get("pv_power_kw", 0))
        # P_Load from Fronius is negative (consumption = negative convention)
        # -> abs() to get the actual consumption value
        house_load   = abs(float(data.get("house_load_kw", 0)))
        battery_power = float(data.get("battery_power_kw", 0))

        # Surplus = PV generation minus house load minus battery charging
        # If battery is discharging (battery_power < 0), it contributes to supply -> don't subtract
        surplus = pv_power - house_load - max(battery_power, 0)
        return round(surplus, 2)

    # Returns full PV state dict including surplus and SOC
    def get_pv_state(self) -> dict:
        data = self.db.get_latest_pv_data()
        if data is None:
            raise RuntimeError("PV data unavailable")

        pv_power = float(data.get("pv_power_kw", 0))
        house_load = abs(float(data.get("house_load_kw", 0)))
        battery_power = float(data.get("battery_power_kw", 0))
        soc = float(data.get("soc", 0))

        surplus = pv_power - house_load - max(battery_power, 0)

        return {
            "surplus_kw": round(surplus, 2),
            "pv_power_kw": round(pv_power, 2),
            "house_load_kw": round(house_load, 2),
            "battery_power_kw": round(battery_power, 2),
            "soc": round(soc, 1),
        }