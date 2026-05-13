# DIPL_Ertragssteuerung_PV

Dieses Projekt wurde im Rahmen einer Diplomarbeit entwickelt und beschäftigt sich mit der intelligenten Steuerung und Überwachung einer Photovoltaikanlage. Ziel des Systems ist es, den Eigenverbrauch der erzeugten Energie zu optimieren, Verbraucher automatisch zu steuern und Energiedaten übersichtlich darzustellen.

Das System besteht aus einer mobilen App als Benutzeroberfläche, einem Python-Backend zur Verarbeitung und Steuerung der Daten sowie einem Raspberry Pi zur Kommunikation mit der Hardware. Zusätzlich werden aktuelle Messwerte und historische Daten in einer InfluxDB gespeichert und visualisiert.

Zu den unterstützten Funktionen gehören unter anderem:
- automatische Boilersteuerung
- Wallboxsteuerung
- Anzeige von Energieflüssen
- Diagramme historischer Daten
- Geräte- und Fehlerprotokolle
- Echtzeitüberwachung der PV-Anlage

Das Projekt wurde primär für den Einsatz im lokalen Netzwerk entwickelt und verbindet moderne Web-, Mobile- und IoT-Technologien in einem gemeinsamen System.

---

# Technologien

## Frontend
- React Native
- Expo
- TypeScript
- Expo Router
- Victory Native
- React Native Skia

## Backend
- Python
- Flask
- Docker
- InfluxDB
- Swagger / OpenAPI

## Hardware / IoT
- Raspberry Pi
- GO-E Charger API
- DS18B20 Temperatursensor
- GPIO-Steuerung

---

# Voraussetzungen

Für das Projekt werden folgende Programme benötigt:

- Python 3
- Node.js
- npm
- Docker Desktop
- Git

Optional:
- Android Studio Emulator
- Expo Go

---

# Frontend

Das Frontend wurde mit React Native und Expo entwickelt und dient als Benutzeroberfläche des Systems.

Die App ermöglicht:
- Anzeige aktueller Energiedaten
- Visualisierung historischer Diagramme
- Steuerung von Geräten
- Anzeige von Gerätestatus und Fehlerprotokollen
- Konfiguration des Systems

Zum Starten des Frontends:

```bash
cd 01_Frontend/Frontend
npm install
npx expo start
```

---

# Backend

Das Backend basiert auf Python und Flask und übernimmt die zentrale Verarbeitung und Steuerung des Systems.

Zu den Aufgaben gehören:
- Bereitstellung der REST-API
- Verarbeitung von Sensordaten
- Kommunikation mit Geräten
- automatische Steuerungslogik
- Speicherung historischer Daten

Das Backend wird über Docker ausgeführt.

Zum Starten:

```bash
docker compose up
```

Nach Änderungen am Backend:

```bash
docker compose build --no-cache
```

---

# Raspberry Pi

Der Raspberry Pi übernimmt die hardwarebezogene Kommunikation und Datenerfassung.

Dazu gehören:
- Temperaturmessung
- GPIO-Steuerung
- Boilersteuerung
- Kommunikation mit der Wallbox
- periodische Datenerfassung

---

# Tests

Für das Backend wurden automatisierte Tests mit pytest erstellt.

Tests können im Backend-Verzeichnis ausgeführt werden:

```bash
pytest
```

Hardwaretests:

```bash
pytest -m hardware
```

---

# API Dokumentation

Nach dem Start des Backends ist die Swagger/OpenAPI-Dokumentation erreichbar.

---

# Datenbank

Zur Speicherung historischer Messwerte wird InfluxDB verwendet.

Gespeichert werden unter anderem:
- PV-Leistung
- Hausverbrauch
- Batteriestand
- Strompreise
- Temperaturdaten

---

# Hinweise

- Das System ist für den Einsatz im lokalen Netzwerk vorgesehen.
- Die Kommunikation erfolgt über HTTP.
- Einige Funktionen benötigen reale Hardwarekomponenten.