from datetime import datetime
from db_bridge import DB_Bridge

# Testet die Datenaufbereitung der DB_Bridge-Klasse,
# ohne eine echte InfluxDB-Verbindung aufzubauen
# Die InfluxDB-Client-Komponenten werden vollständig gemockt

def test_get_latest_pv_data_mocked(mocker):
    # Simulierter Zeitstempel (bewusst OHNE echte Zeitzone,
    # um plattformabhängige Probleme zu vermeiden)
    fake_time = datetime(2026, 1, 1, 12, 0)

    # Simulierter Datensatz, wie er von InfluxDB geliefert wird
    fake_record = {
        "_time": fake_time,
        "pv_power": 1234
    }

    # InfluxDB liefert Records verschachtelt in Tabellenobjekten
    fake_record_obj = mocker.Mock()
    fake_record_obj.values = fake_record

    fake_table = mocker.Mock()
    fake_table.records = [fake_record_obj]

    # Query-API mocken
    fake_query_api = mocker.Mock()
    fake_query_api.query.return_value = [fake_table]

    # InfluxDBClient mocken
    fake_client = mocker.Mock()
    fake_client.query_api.return_value = fake_query_api

    # Patchen des InfluxDBClient-Konstruktors im db_bridge-Modul
    mocker.patch("db_bridge.InfluxDBClient", return_value=fake_client)

    # DB_Bridge initialisieren (nutzt jetzt den gemockten Client)
    db = DB_Bridge()

    # Methode ausführen
    data = db.get_latest_pv_data()

    # Erwartung:
    # - Daten wurden korrekt extrahiert
    # - pv_power-Wert stimmt
    assert data is not None
    assert data["pv_power"] == 1234


# --------------------------------------------------
# Error-Handling Tests für DB_Bridge
# --------------------------------------------------

def test_get_latest_pv_data_handles_influx_error(mocker):
    """
    Simuliert einen InfluxDB-Ausfall und prüft,
    dass die Methode sauber mit None reagiert
    statt zu crashen.
    """

    fake_query_api = mocker.Mock()
    fake_query_api.query.side_effect = Exception("InfluxDB not reachable")

    fake_client = mocker.Mock()
    fake_client.query_api.return_value = fake_query_api

    mocker.patch("db_bridge.InfluxDBClient", return_value=fake_client)

    db = DB_Bridge()
    data = db.get_latest_pv_data()

    # Erwartung: Fehler wird abgefangen
    assert data is None
