# Integration tests for the schedule API endpoint.
# These tests will check if the API correctly handles requests to get and update the schedule.

def test_get_schedule(client):
    resp = client.get("/api/schedule")
    assert resp.status_code == 200
    assert "boiler" in resp.json

def test_put_schedule(client):
    client.post("/api/mode", json={"mode": "MANUAL"})

    payload = {
        "boiler": {
            "winter": {"start": "08:00", "end": "16:00"}
        }
    }

    # Update the schedule with a valid payload
    resp = client.put("/api/schedule", json=payload)
    assert resp.status_code == 200

    # Verify that the schedule was updated correctly
    resp2 = client.get("/api/schedule")
    assert resp2.json["boiler"]["winter"]["start"] == "08:00"
