# Integrationstest für die Boiler-API Flask-Routing wird getestet, Hardwarezugriffe werden gemockt

def test_api_boiler_control(client, mocker):
    # Fake-BoilerController mit definiertem Verhalten
    fake_boiler = mocker.Mock()

    # Simulierte Zustandsänderung:
    # vorher AUS → nachher EIN
    fake_boiler.get_state.side_effect = [False, True]

    fake_boiler.control.return_value = {
        "action": "on",
        "result": True
    }

    # BoilerController im ServiceManager mocken
    mocker.patch(
        "service_manager.BoilerController",
        return_value=fake_boiler
    )

    # API-Aufruf simulieren
    response = client.post(
        "/api/boiler/control",
        json={"action": "on"}
    )

    # Erwartung:
    # - HTTP 200 OK
    # - Boiler wurde erfolgreich eingeschaltet
    assert response.status_code == 200
    assert response.json["result"] is True

#  Prüft, dass ein fehlender JSON-Body  korrekt mit HTTP 400 beantwortet wird
def test_boiler_control_missing_payload(client):
   
    response = client.post("/api/boiler/control")

    assert response.status_code == 400

# Prüft, dass ungültige Steueraktionen vom Backend abgelehnt werden
def test_boiler_control_invalid_action(client):
    
    response = client.post(
        "/api/boiler/control",
        json={"action": "explode"}
    )

    assert response.status_code == 400
