from datetime import datetime
from bridges.db_bridge import DB_Bridge

# Simualtes a successful InfluxDB query and checks that get_latest_pv_data() correctly processes the data and returns the expected dictionary with pv_power_kw and _time converted to ISO format
def test_get_latest_pv_data_mocked(mocker):
    fake_time = datetime(2026, 1, 1, 12, 0)

    fake_record = {
        "_time": fake_time,
        "pv_power": 1234
    }

    fake_record_obj = mocker.Mock()
    fake_record_obj.values = fake_record

    fake_table = mocker.Mock()
    fake_table.records = [fake_record_obj]

    fake_query_api = mocker.Mock()
    fake_query_api.query.return_value = [fake_table]

    fake_client = mocker.Mock()
    fake_client.query_api.return_value = fake_query_api

    mocker.patch("bridges.db_bridge.InfluxDBClient", return_value=fake_client)

    db = DB_Bridge()
    data = db.get_latest_pv_data()

    assert data is not None
    # pv_power wird in get_latest_pv_data() zu pv_power_kw umbenannt
    assert "pv_power" not in data
    assert data["pv_power_kw"] == 1234

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
