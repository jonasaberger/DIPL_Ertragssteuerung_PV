import requests

class DeviceManager:
    def __init__(self, api_base_url: str):
        """
        api_base_url example:
        http://192.168.0.10:5000/api/devices
        """
        self.api_base_url = api_base_url.rstrip("/")

    def get_device(self, device_id: str) -> dict:
        url = f"{self.api_base_url}/get_device"
        response = requests.get(
            url,
            params={"deviceId": device_id},
            timeout=5
        )
        response.raise_for_status()
        return response.json()

    def get_device_url(self, device_id: str, endpoint_key: str) -> str:
        device = self.get_device(device_id)

        base_url = device.get("baseUrl")
        endpoint = device.get("endpoints", {}).get(endpoint_key)

        if not base_url or not endpoint:
            raise KeyError(
                f"Missing endpoint '{endpoint_key}' for device '{device_id}'"
            )

        return base_url.rstrip("/") + "/" + endpoint.lstrip("/")
