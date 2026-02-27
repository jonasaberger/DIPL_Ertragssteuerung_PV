import requests
from datetime import datetime
from zoneinfo import ZoneInfo

class PVForecastService:

    # Bruck an der Großglocknerstraße
    # Coordinates chosen as representative for the region of interest, can be adjusted if needed
    LAT = 47.2849
    LON = 12.8231
    
    def __init__(self, cloud_threshold=40):
        self.cloud_threshold = cloud_threshold
        self.tz = ZoneInfo("Europe/Vienna")

    # Public method to get PV forecast for today and tomorrow
    # Returns a dictionary with boolean flags for PV generation possibility, number of good PV hours today, best hour for PV generation, and any error messages if applicable
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
    # This method is responsible for making the HTTP request to the Open-Meteo API with the appropriate parameters and returning the JSON response as a dictionary
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

        # Today's sunrise/sunset times are needed to evaluate PV generation possibility for the remainder of today, 
        # which is the main focus of the forecast, so if today's data is not available, cannot provide a meaningful forecast
        sunrise_today = datetime.fromisoformat(data["daily"]["sunrise"][0]).astimezone(self.tz)
        sunset_today = datetime.fromisoformat(data["daily"]["sunset"][0]).astimezone(self.tz)

        # Tomorrow's sunrise/sunset times are needed to evaluate PV generation possibility for tomorrow, but the main focus is on today's forecast, 
        # so will still evaluate today's PV possibility even if tomorrow's data is not available
        sunrise_tomorrow = datetime.fromisoformat(data["daily"]["sunrise"][1]).astimezone(self.tz)
        sunset_tomorrow = datetime.fromisoformat(data["daily"]["sunset"][1]).astimezone(self.tz)

        # If current time is after today's sunset, then PV generation is not possible for the remainder of today, so can skip detailed evaluation and just set pv_today to False
        # If current time is before today's sunrise, then can evaluate PV possibility for the entire day starting from sunrise. If current time is between sunrise and sunset,
        # then can evaluate PV possibility starting from current time until sunset.
        start_remaining_today = max(now, sunrise_today)

        # If today's sunrise/sunset data is missing or invalid, cannot evaluate PV possibility for today, so set pv_today to False and skip detailed evaluation
        #  Can still evaluate tomorrow's PV possibility if tomorrow's sunrise/sunset data is available
        if start_remaining_today > sunset_today:
            pv_today = False
        else:
            pv_today, _, _ = self._pv_details(
                start_remaining_today,
                sunset_today,
                hourly_times,
                hourly_clouds
            )

        # For tomorrow, if sunrise/sunset data is missing or invalid, cannot evaluate PV possibility for tomorrow, so set pv_tomorrow to False
        _, hours_today_total, best_hour_today = self._pv_details(
            sunrise_today,
            sunset_today,
            hourly_times,
            hourly_clouds
        )

        # If tomorrow's sunrise/sunset data is missing or invalid, cannot evaluate PV possibility for tomorrow,
        # so set pv_tomorrow to False and skip detailed evaluation
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

        # Iterate through hourly data and evaluate cloud cover for hours between start and end times, 
        # counting good PV hours and finding the hour with the lowest cloud cover, which is considered the best hour for PV generation
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

        # PV generation is considered possible if there is at least one hour with acceptable cloud cover between sunrise and sunset,
        # so if pv_hours is greater than 0, then pv_possible is True, otherwise False
        pv_possible = pv_hours > 0

        return pv_possible, pv_hours, best_hour
