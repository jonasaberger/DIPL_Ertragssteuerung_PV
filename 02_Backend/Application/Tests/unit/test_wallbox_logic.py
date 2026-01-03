from wallbox_bridge import Wallbox_Bridge

def test_wallbox_can_be_created():
    wallbox = Wallbox_Bridge()
    assert wallbox is not None