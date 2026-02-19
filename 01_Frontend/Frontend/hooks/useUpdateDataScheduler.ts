import { useEffect, useState } from 'react'
import { fetchLatestPVData, PV_Data } from '@/services/iot_services/pv_services'
import { fetchBoilerData, BoilerData } from '@/services/iot_services/boiler_service'
import { fetchEpexData, EpexData } from '@/services/ext_services/epex_service'
import { fetchSystemState, SystemState } from '@/services/setting_services/logging-state-services/state_service'
import { fetchEGoData, EGoData } from '@/services/iot_services/e_go_service'
import { fetchForecastData, ForecastData } from '@/services/ext_services/weatherforecast_service'


// Berechnet die Millisekunden bis zur nächsten vollen Viertelstunde (z.B. :00, :15, :30, :45).
function msUntilNextQuarterHour() {
  const now = new Date()
  const minutes = now.getMinutes()
  const nextQuarter = Math.ceil(minutes / 15) * 15
  const next = new Date(now)
  next.setMinutes(nextQuarter, 0, 0)
  if (next <= now) next.setMinutes(next.getMinutes() + 15)
  return next.getTime() - now.getTime()
}


// Berechnet die Millisekunden bis zur nächsten vollen Stunde + kleinem Puffer (2min).
function msUntilNextHourWithBuffer(bufferMinutes = 2) {
  const now = new Date()
  const next = new Date(now)
  next.setHours(now.getHours() + 1, bufferMinutes, 0, 0)
  return next.getTime() - now.getTime()
}

/*
 * Hook zur zentralen Datenverwaltung und zeitgesteuerten Aktualisierung aller Gerätedaten.
 *
 * Ablauf & Verwendung:
 * 1. Beim Mount: alle Daten einmalig sofort laden (initialize)
 * 2. Danach: automatische Hintergrundaktualisierung über Intervalle/Timeouts
 * 3. Bei Bedarf: manuelle Sofortaktualisierung nach Benutzeraktionen (Toggle)
 *
*/
export function useUpdateDataScheduler() {
  const [pvData, setPvData] = useState<PV_Data | null>(null)
  const [boilerData, setBoilerData] = useState<BoilerData | null>(null)
  const [epexData, setEpexData] = useState<EpexData | null>(null)
  const [systemState, setSystemState] = useState<SystemState | null>(null)
  const [wallboxData, setWallboxData] = useState<EGoData | null>(null)
  const [forecastData, setForecastData] = useState<ForecastData | null>(null)

  useEffect(() => {
    // Verhindert State-Updates nach dem Unmount der Komponente
    let isMounted = true

    // Timer-Referenzen für späteres Cleanup beim Unmount
    let pvTimeout: ReturnType<typeof setTimeout>
    let pvInterval: ReturnType<typeof setInterval>
    let epexTimeout: ReturnType<typeof setTimeout>
    let epexInterval: ReturnType<typeof setInterval>
    let stateInterval: ReturnType<typeof setInterval>
    let wallboxInterval: ReturnType<typeof setInterval>
    let forecastTimeout: ReturnType<typeof setTimeout>
    let forecastInterval: ReturnType<typeof setInterval>

    /* -------- Systemstatus abrufen -------- */
    /*
     * Holt den aktuellen Systemstatus vom Backend.
     * Dieser gibt an, welche Dienste verfügbar sind (influx, boiler, wallbox, backend, epex, forecast).
     * Wird vor jedem Datenabruf aufgerufen, um zu prüfen ob der jeweilige Dienst erreichbar ist.
    */
    const fetchState = async () => {
      try {
        const state = await fetchSystemState()
        if (!isMounted) return null
        setSystemState(state)
        return state
      } catch (err) {
        console.error('Error fetching system state:', err)
        return null
      }
    }

    // Wenn der Systemstatus nicht verfügbar ist, werden die entsprechenden Daten auf null gesetzt.
    // Damit kann die UI sofort reagieren und die entsprechende Komponente ausblenden.

    /* -------- PV- und Boilerdaten abrufen -------- */
    const fetchPVAndBoiler = async (state: SystemState | null) => {
      if (!state) return

      const promises: Promise<any>[] = []

      if (state.influx === 'ok') promises.push(fetchLatestPVData())
      else setPvData(null)

      if (state.boiler === 'ok') promises.push(fetchBoilerData())
      else setBoilerData(null)

      try {
        const [pv, boiler] = await Promise.all(promises)
        if (!isMounted) return
        if (pv) setPvData(pv)
        if (boiler) setBoilerData(boiler)
      } catch (err) {
        console.error('Error fetching PV/Boiler:', err)
      }
    }

    /* -------- EPEX-Strompreisdaten abrufen -------- */
    const fetchEpex = async (state: SystemState | null) => {
      if (!state) return
      if (state.backend !== 'ok') {
        setEpexData(null)
        return
      }
      try {
        const data = await fetchEpexData()
        if (!isMounted) return
        if (data) setEpexData(data)
      } catch (err) {
        console.error('Error fetching EPEX:', err)
      }
    }
    /* -------- Wallbox-Daten abrufen -------- */
    const fetchWallbox = async (state: SystemState | null) => {
      if (!state) return
      if (state.wallbox !== 'ok') {
        setWallboxData(null)
        return
      }
      try {
        const data = await fetchEGoData()
        if (!isMounted) return
        if (data) setWallboxData(data)
      } catch (err) {
        console.error('Error fetching Wallbox:', err)
      }
    }
    /* -------- Wettervorhersage abrufen -------- */
    const fetchForecast = async () => {
      try {
        const data = await fetchForecastData()
        if (!isMounted) return
        if (data) setForecastData(data)
      } catch (err) {
        console.error('Error fetching Forecast:', err)
      }
    }

    /* -------- Initialer Ladevorgang beim Mount -------- */
    /*
     * Lädt beim ersten Rendern einmalig alle Daten sofort:
     * zuerst den Systemstatus, dann alle weiteren Daten parallel.
    */
    const initialize = async () => {
      const state = await fetchState()
      await Promise.all([
        fetchPVAndBoiler(state),
        fetchEpex(state),
        fetchWallbox(state),
        fetchForecast(),
      ])
    }
    initialize()


    /* -------- Zeitgesteuerte Hintergrundaktualisierungen -------- */

    // PV & Boiler: wartet bis zur nächsten vollen Viertelstund => dann alle 15 Minuten.
    // Vor jedem Abruf wird der Systemstatus frisch geholt.
    pvTimeout = setTimeout(async () => {
      const state = await fetchState()
      await fetchPVAndBoiler(state)
      pvInterval = setInterval(() => fetchPVAndBoiler(state), 15 * 60 * 1000)
    }, msUntilNextQuarterHour())

    // EPEX: wartet bis zur nächsten vollen Stunde + 2 Minuten Puffer => danach stündlich.
    // Der Puffer stellt sicher, dass der externe EPEX-Dienst seine Daten bereits aktualisiert hat.
    epexTimeout = setTimeout(async () => {
      const state = await fetchState()
      await fetchEpex(state)
      epexInterval = setInterval(() => fetchEpex(state), 60 * 60 * 1000)
    }, msUntilNextHourWithBuffer(2))

    // Wettervorhersage: wartet bis zur nächsten vollen Stunde + 2 Minuten Puffer => danach stündlich.
    forecastTimeout = setTimeout(async () => {
      await fetchForecast()
      forecastInterval = setInterval(fetchForecast, 60 * 60 * 1000)
    }, msUntilNextHourWithBuffer(2))

    // Wallbox: sofort starten => danach alle 15 Minuten.
    // Kein Timeout-Versatz nötig, da die Daten nicht aus dem Influx stammen.
    wallboxInterval = setInterval(async () => {
      const state = await fetchState()
      await fetchWallbox(state)
    }, 15 * 60 * 1000)

    // Systemstatus: alle 30 Sekunden aktualisieren, damit Verfügbarkeitsänderungen
    // (z.B. Wallbox geht offline) schnell in der UI sichtbar werden.
    stateInterval = setInterval(fetchState, 30 * 1000)

    // Cleanup beim Unmount (z.B. Navigation oder Screen-Remount nach Konfigurationsänderung):
    // Alle Timer stoppen und isMounted auf false setzen, um verwaiste State-Updates zu verhindern.
    return () => {
      isMounted = false
      clearTimeout(pvTimeout)
      clearInterval(pvInterval)
      clearTimeout(epexTimeout)
      clearInterval(epexInterval)
      clearTimeout(forecastTimeout)
      clearInterval(forecastInterval)
      clearInterval(stateInterval)
      clearInterval(wallboxInterval)
    }
  }, [])

  // Sofortaktualisierung der Boilerdaten nach einem Toggle im UI.
  // Wird aufgerufen, damit die Anzeige nicht auf das nächste Intervall warten muss.
  const refetchBoilerData = async () => {
    const data = await fetchBoilerData()
    setBoilerData(data)
  }
  // Sofortaktualisierung der Wallboxdaten nach einem Toggle oder Ampere-Änderung im UI.
  const refetchEGoData = async () => {
    const data = await fetchEGoData()
    setWallboxData(data)
  }
  // Sofortaktualisierung der EPEX-Daten nach einer Preisoffset-Änderung im UI.
  const refetchEpexData = async () => {
    const data = await fetchEpexData()
    setEpexData(data)
  }

  return {
    pvData,
    boilerData,
    epexData,
    wallboxData,
    systemState,
    forecastData,
    refetchBoilerData,
    refetchEGoData,
    refetchEpexData,
  }
}