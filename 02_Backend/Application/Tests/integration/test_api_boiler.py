# Integrationstest für die Boiler-API Flask-Routing wird getestet, Hardwarezugriffe werden gemockt

def test_api_boiler_control(client):
    client.post("/api/mode", json={"mode": "MANUAL"})

    response = client.post(
        "/api/boiler/control",
        json={"action": "on"}
    )

    assert response.status_code == 200
    assert "heating" in response.json


def test_boiler_control_missing_payload(client):
    client.post("/api/mode", json={"mode": "MANUAL"})

    response = client.post("/api/boiler/control")
    assert response.status_code == 400


def test_boiler_control_invalid_action(client):
    client.post("/api/mode", json={"mode": "MANUAL"})

    response = client.post(
        "/api/boiler/control",
        json={"action": "explode"}
    )

    assert response.status_code == 400
