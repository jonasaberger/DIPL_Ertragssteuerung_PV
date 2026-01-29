# Testet die Validierung von API-Eingaben im ServiceManager Stellt sicher, dass fehlerhafte Requests korrekt abgewiesen werden

def test_wallbox_api_missing_payload(client):
    # Kein JSON-Body
    response = client.post("/api/wallbox/setCharging")

    # Erwartung:
    # - Bad Request (400)
    assert response.status_code == 400

def test_boiler_control_invalid_action(client):
    response = client.post(
        "/api/boiler/control",
        json={"action": "explode"}
    )

    # Erwartung:
    # - Ungültige Aktion → 400
    assert response.status_code == 400
