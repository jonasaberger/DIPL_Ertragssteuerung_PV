# Tests for API validation.
# These tests will check if the API correctly handles invalid requests and returns appropriate error codes.

def test_wallbox_api_missing_payload(client):
    # Check if the wallbox API endpoint correctly handles a request with missing payload
    response = client.post("/api/wallbox/setCharging")

    # Bad Request (400)
    assert response.status_code == 400

def test_boiler_control_invalid_action(client):
    response = client.post(
        "/api/boiler/control",
        json={"action": "explode"}
    )

    # Bad Request (400)
    assert response.status_code == 400
