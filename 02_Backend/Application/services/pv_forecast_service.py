import requests
from datetime import datetime
from zoneinfo import ZoneInfo

# Simple PV forecast using Open-Meteo, determines whether PV generation is likely today or tomorrow
class PVForecastService:
    # Bruck an der Großglocknerstraße
    LAT = 47.2849
    LON = 12.8231
    

    def __init__(self, cloud_threshold=40):
        self.cloud_threshold = cloud_threshold
        self.tz = ZoneInfo("Europe/Vienna")

    def get_forecast(self) -> dict:
        try:
            data = self._fetch()
            return self._evaluate(data)
        except Exception as e:
            return {
                "pv_today": False,
                "pv_tomorrow": False,
                "error": str(e),
                "source": "open-meteo"
            }

    # Fetches weather data from Open-Meteo API
    def _fetch(self) -> dict:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": self.LAT,
            "longitude": self.LON,
            "hourly": "cloudcover",
            "daily": "sunrise,sunset",
            "timezone": "Europe/Vienna"
        }

        r = requests.get(url, params=params, timeout=5)
        r.raise_for_status()
        return r.json()

    # Evaluates whether PV generation is likely based on cloud cover and sunrise/sunset times
    def _evaluate(self, data: dict) -> dict:
        now = datetime.now(self.tz)

        hourly_times = data["hourly"]["time"]
        hourly_clouds = data["hourly"]["cloudcover"]

        sunrise_today = datetime.fromisoformat(data["daily"]["sunrise"][0]).astimezone(self.tz)
        sunset_today = datetime.fromisoformat(data["daily"]["sunset"][0]).astimezone(self.tz)

        sunrise_tomorrow = datetime.fromisoformat(data["daily"]["sunrise"][1]).astimezone(self.tz)
        sunset_tomorrow = datetime.fromisoformat(data["daily"]["sunset"][1]).astimezone(self.tz)

        return {
            "pv_today": self._pv_possible(now, sunset_today, hourly_times, hourly_clouds),
            "pv_tomorrow": self._pv_possible(sunrise_tomorrow, sunset_tomorrow, hourly_times, hourly_clouds),
            "source": "open-meteo"
        }

    # Checks if there is a time between start and end where cloud cover is below the threshold
    def _pv_possible(self, start, end, times, clouds) -> bool:
        for t, cloud in zip(times, clouds):
            ts = datetime.fromisoformat(t).astimezone(self.tz)
            if start <= ts <= end and cloud <= self.cloud_threshold:
                return True
        return False
