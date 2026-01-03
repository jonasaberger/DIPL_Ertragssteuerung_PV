import pytest
from service_manager import ServiceManager

@pytest.fixture
def app():
    service = ServiceManager()
    service.app.config["TESTING"] = True
    return service.app

@pytest.fixture
def client(app):
    return app.test_client()