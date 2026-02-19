from datetime import datetime, time
from zoneinfo import ZoneInfo

class ScheduleManager:
    def __init__(self, store):
        self.store = store

    def determine_season(self) -> str:
        month = datetime.now(ZoneInfo("Europe/Vienna")).month
        return "summer" if 4 <= month <= 9 else "winter"

    def _parse(self, value: str | None) -> time | None:
        if not value or ":" not in value:
            return None
        try:
            h, m = map(int, value.split(":"))
            return time(hour=h, minute=m)
        except ValueError:
            return None

    def is_active(self, device: str) -> bool:
        # Get the effective schedule configuration for the device and current season
        config = self.store.get_effective()
        # Determine the current season (summer/winter) based on the month
        season = self.determine_season()

        # Get the schedule entry for the device and season
        entry = config.get(device, {}).get(season)
        if not entry:
            return False

        start = self._parse(entry.get("start"))
        end = self._parse(entry.get("end"))

        if not start or not end:
            return False

        now = datetime.now(ZoneInfo("Europe/Vienna")).time()

        # Edge case: if start and end are the same, consider the device to be inactive (no time window)
        if start == end:
            return False

        # Normal case: start < end -> active if now is between start and end
        if start < end:
            return start <= now <= end

        # Over midnight case
        return now >= start or now <= end
