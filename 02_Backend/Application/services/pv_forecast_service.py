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

        start_remaining_today = max(now, sunrise_today)

        if start_remaining_today > sunset_today:
            pv_today = False
        else:
            pv_today, _, _ = self._pv_details(
                start_remaining_today,
                sunset_today,
                hourly_times,
                hourly_clouds
            )
        
        _, hours_today_total, best_hour_today = self._pv_details(
            sunrise_today,
            sunset_today,
            hourly_times,
            hourly_clouds
        )

        pv_tomorrow, _, _ = self._pv_details(
            sunrise_tomorrow,
            sunset_tomorrow,
            hourly_times,
            hourly_clouds
        )

        return {
            "pv_today": pv_today,
            "pv_tomorrow": pv_tomorrow,
            "pv_hours_today": hours_today_total,
            "best_hour_today": best_hour_today,
            "source": "open-meteo"
        }
    
    # More detailed analysis that counts the number of good PV hours and finds the best hour with lowest cloud cover
    def _pv_details(self, start, end, times, clouds):
        pv_hours = 0
        best_hour = None
        # Highest possible cloud cover in the forecast is 100
        lowest_cloud = 101  

        for t, cloud in zip(times, clouds):
            ts = datetime.fromisoformat(t).astimezone(self.tz)

            if start <= ts <= end:

                # Count hours with acceptable cloud cover
                if cloud <= self.cloud_threshold:
                    pv_hours += 1

                # Find the hour with the lowest cloud cover
                if cloud < lowest_cloud:
                    lowest_cloud = cloud
                    best_hour = ts.strftime("%H:%M")

        pv_possible = pv_hours > 0

        return pv_possible, pv_hours, best_hour
