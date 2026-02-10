from datetime import datetime
from bridges.db_bridge import DB_Bridge

def test_get_latest_pv_data_mocked(mocker):
    # Simulates a successful InfluxDB response with a known pv_power value at a specific time (2026-01-01 12:00)
    fake_time = datetime(2026, 1, 1, 12, 0)

    # Simulated InfluxDB record with the expected structure
    fake_record = {
        "_time": fake_time,
        "pv_power": 1234
    }

    # Influx returns a table with one record containing the fake data
    fake_record_obj = mocker.Mock()
    fake_record_obj.values = fake_record

    fake_table = mocker.Mock()
    fake_table.records = [fake_record_obj]

    # Query-API mock
    fake_query_api = mocker.Mock()
    fake_query_api.query.return_value = [fake_table]

    # InfluxDBClient mock
    fake_client = mocker.Mock()
    fake_client.query_api.return_value = fake_query_api

    # Patch InfluxDBClient to return our fake client when instantiated
    mocker.patch("bridges.db_bridge.InfluxDBClient", return_value=fake_client)

    # DB_Bridge initializes its InfluxDBClient, which will now use the mocked version
    db = DB_Bridge()

    data = db.get_latest_pv_data()

  
    # The method should return a dict with the pv_power value from the fake record
    assert data is not None
    assert data["pv_power"] == 1234

# Simulates a scenario where the InfluxDB query raises an exception and checks that get_latest_pv_data() handles it gracefully by returning None
def test_get_latest_pv_data_handles_influx_error(mocker):
  
    fake_query_api = mocker.Mock()
    fake_query_api.query.side_effect = Exception("InfluxDB not reachable")

    fake_client = mocker.Mock()
    fake_client.query_api.return_value = fake_query_api

    mocker.patch("bridges.db_bridge.InfluxDBClient", return_value=fake_client)

    db = DB_Bridge()
    data = db.get_latest_pv_data()

    # In case of an exception, the method should return None
    assert data is None
