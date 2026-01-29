# Testet die Initialisierung der LoggingBridge, Keine echte InfluxDB-Logging-Verbindung

from logging_bridge import LoggingBridge

def test_logging_bridge_can_be_created():
    logger = LoggingBridge()

    # Erwartung:
    # - LoggingBridge lässt sich initialisieren
    assert logger is not None
