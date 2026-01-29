# DIPL_Ertragssteuerung_PV


## Setting up the Virtual Enviroment / Backend

### Navigate to the correct folder containing the requirements.txt
- cd DIPL_Ertragssteuerung_PV\02_Backend\BackendApplication

### Initialize the Virtual environment

- python -m venv .venv

- Application für Tim: & C:\gitRepos\Diplomarbeit\DIPL_Ertragssteuerung_PV\02_Backend\Application\.venv\Scripts\Activate.ps1
                       cd C:\gitRepos\Diplomarbeit\DIPL_Ertragssteuerung_PV\02_Backend\Application

- PI für Tim: & C:\gitRepos\Diplomarbeit\DIPL_Ertragssteuerung_PV\02_Backend\Raspberry_PI_Code\.venv\Scripts\Activate.ps1
              cd C:\gitRepos\Diplomarbeit\DIPL_Ertragssteuerung_PV\02_Backend\Raspberry_PI_Code

- pip install -r requirements.txt


### How to Start Backend

- Docker-Desktop has to be running, etc...

- For first build + After changeing Code: docker compose build --no-cache

- docker compose up

### How to start Tests
- venv has to be active
- cd \DIPL_Ertragssteuerung_PV\02_Backend\Application
-  paytest / pytest -m hardware

