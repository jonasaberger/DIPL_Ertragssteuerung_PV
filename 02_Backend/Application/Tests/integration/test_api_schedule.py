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

    resp = client.put("/api/schedule", json=payload)
    assert resp.status_code == 200

    resp2 = client.get("/api/schedule")
    assert resp2.json["boiler"]["winter"]["start"] == "08:00"
