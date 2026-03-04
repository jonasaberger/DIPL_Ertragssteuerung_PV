import requests

class DeviceManager:
    def __init__(self, api_base_url: str):
        """
        api_base_url example:
        http://192.168.0.10:5000/api/devices
        """
        self.api_base_url = api_base_url.rstrip("/")

    # Fetches the device information from the backend API
    def get_device(self, device_id: str) -> dict:
        url = f"{self.api_base_url}/get_device"
        try:
            response = requests.get(
                url,
                params={"deviceId": device_id},
                timeout=5
            )
            response.raise_for_status() # Raises HTTPError for bad responses (4xx and 5xx)
            return response.json()
        except Exception as e:
            raise Exception(f"Error fetching device '{device_id}': {e}") from e

    def get_device_url(self, device_id: str, endpoint_key: str) -> str:
        device = self.get_device(device_id)

        base_url = device.get("baseUrl")
        endpoint = device.get("endpoints", {}).get(endpoint_key)

        # Validate that both base_url and endpoint are present
        if not base_url or not endpoint:
            raise KeyError(
                f"Missing endpoint '{endpoint_key}' for device '{device_id}'"
            )

        return base_url.rstrip("/") + "/" + endpoint.lstrip("/")
