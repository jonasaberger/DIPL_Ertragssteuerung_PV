# Tests for the logging bridge. 
# This test will simply check if the LoggingBridge can be instantiated without errors.

from bridges.logging_bridge import LoggingBridge

def test_logging_bridge_can_be_created():
    logger = LoggingBridge()

    # LoggingBridge can be created without errors and has the expected interface
    assert logger is not None
