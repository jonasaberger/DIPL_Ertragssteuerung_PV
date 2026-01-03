from logging_bridge import LoggingBridge

def test_logging_bridge_can_be_created():
    logger = LoggingBridge()
    assert logger is not None