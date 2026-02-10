# Integration tests for the boiler control API endpoint.
# These tests will check if the API correctly handles valid and invalid requests to control the boiler.

def test_api_boiler_control(client):
    client.post("/api/mode", json={"mode": "MANUAL"})

    # Valid request to turn on the boiler
    response = client.post(
        "/api/boiler/control",
        json={"action": "on"}
    )

    # Response OK (200)
    assert response.status_code == 200
    assert "heating" in response.json


def test_boiler_control_missing_payload(client):
    client.post("/api/mode", json={"mode": "MANUAL"})

    # Missing payload
    response = client.post("/api/boiler/control")
    assert response.status_code == 400


def test_boiler_control_invalid_action(client):
    client.post("/api/mode", json={"mode": "MANUAL"})

    # Invalid action
    response = client.post(
        "/api/boiler/control",
        json={"action": "explode"}
    )

    assert response.status_code == 400
