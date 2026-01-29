from datetime import datetime
from wallbox_bridge import Wallbox_Bridge
from decimal import Decimal

# Simulierter HTTP-Response der Wallbox
def test_wallbox_fetch_data(mocker):
    fake_response = mocker.Mock()
    fake_response.json.return_value = {
        "amp": 16,
        "car": 1,
        "wst": 3,
        "eto": 100
    }
    fake_response.raise_for_status.return_value = None

    # requests.get mocken → verhindert echte HTTP-Verbindungen
    mocker.patch("requests.get", return_value=fake_response)

    # ZoneInfo mocken, um fehlende tzdata auf Windows zu vermeiden
    mocker.patch("wallbox_bridge.ZoneInfo", return_value=None)

    # datetime mocken, aber echte Funktionalität beibehalten
    mocker.patch("wallbox_bridge.datetime", wraps=datetime)

    # Wallbox_Bridge initialisieren
    wb = Wallbox_Bridge()

    # Daten abrufen
    data = wb.fetch_data()

    # Erwartung:
    # - Rückgabe enthält korrekt verarbeitete Wallbox-Daten
    assert data["amp"] == 16
    assert data["car"] == 1

# Prüft, dass ungültige Eingaben nicht zu Exceptions führen
def test_safe_decimal_handles_invalid_input():
    wb = Wallbox_Bridge()

    result = wb.safe_decimal("not_a_number")

    assert result == Decimal(0)