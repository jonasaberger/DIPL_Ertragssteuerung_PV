class PVSurplusService:
    def __init__(self, db_bridge):
        self.db = db_bridge

    #  Returns current PV surplus in kW ( Positive = available surplus | Negative = grid consumption)
    def get_surplus_kw(self) -> float:
        data = self.db.get_latest_pv_data()
        if data is None:
            raise RuntimeError("PV data unavailable")

        pv_power = float(data.get("pv_power_kw", 0))
        house_load = float(data.get("house_load_kw", 0))
        battery_power = float(data.get("battery_power_kw", 0))

        surplus = pv_power - house_load - max(battery_power, 0)
        return round(surplus, 2)
