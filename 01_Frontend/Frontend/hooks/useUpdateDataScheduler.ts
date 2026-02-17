import { useEffect, useState } from 'react'
import { fetchLatestPVData, PV_Data } from '@/services/iot_services/pv_services'
import { fetchBoilerData, BoilerData } from '@/services/iot_services/boiler_service'
import { fetchEpexData, EpexData } from '@/services/ext_services/epex_service'
import { fetchSystemState, SystemState } from '@/services/setting_services/logging-state-services/state_service'
import { fetchEGoData, EGoData } from '@/services/iot_services/e_go_service'
import { fetchForecastData, ForecastData } from '@/services/ext_services/weatherforecast_service'

function msUntilNextQuarterHour() {
  const now = new Date()
  const minutes = now.getMinutes()
  const nextQuarter = Math.ceil(minutes / 15) * 15
  const next = new Date(now)
  next.setMinutes(nextQuarter, 0, 0)
  if (next <= now) next.setMinutes(next.getMinutes() + 15)
  return next.getTime() - now.getTime()
}

function msUntilNextHourWithBuffer(bufferMinutes = 2) {
  const now = new Date()
  const next = new Date(now)
  next.setHours(now.getHours() + 1, bufferMinutes, 0, 0)
  return next.getTime() - now.getTime()
}

export function useUpdateDataScheduler() {
  const [pvData, setPvData] = useState<PV_Data | null>(null)
  const [boilerData, setBoilerData] = useState<BoilerData | null>(null)
  const [epexData, setEpexData] = useState<EpexData | null>(null)
  const [systemState, setSystemState] = useState<SystemState | null>(null)
  const [wallboxData, setWallboxData] = useState<EGoData | null>(null)
  const [forecastData, setForecastData] = useState<ForecastData | null>(null)

  useEffect(() => {
    let isMounted = true

    let pvTimeout: ReturnType<typeof setTimeout>
    let pvInterval: ReturnType<typeof setInterval>
    let epexTimeout: ReturnType<typeof setTimeout>
    let epexInterval: ReturnType<typeof setInterval>
    let stateInterval: ReturnType<typeof setInterval>
    let wallboxInterval: ReturnType<typeof setInterval>
    let forecastTimeout: ReturnType<typeof setTimeout>
    let forecastInterval: ReturnType<typeof setInterval>

    /* -------- Fetch system state -------- */
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

    /* -------- Fetch PV + Boiler if available -------- */
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

    /* -------- Fetch EPEX if backend is OK -------- */
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

    /* -------- Fetch Wallbox if available -------- */
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

    /* -------- Fetch Forecast (stündlich) -------- */
    const fetchForecast = async () => {
      try {
        const data = await fetchForecastData()
        if (!isMounted) return
        if (data) setForecastData(data)
      } catch (err) {
        console.error('Error fetching Forecast:', err)
      }
    }

    /* -------- Initial load -------- */
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

    /* -------- Schedulers -------- */
    pvTimeout = setTimeout(async () => {
      const state = await fetchState()
      await fetchPVAndBoiler(state)
      pvInterval = setInterval(() => fetchPVAndBoiler(state), 15 * 60 * 1000)
    }, msUntilNextQuarterHour())

    epexTimeout = setTimeout(async () => {
      const state = await fetchState()
      await fetchEpex(state)
      epexInterval = setInterval(() => fetchEpex(state), 60 * 60 * 1000)
    }, msUntilNextHourWithBuffer(2))

    // Forecast: zum nächsten vollen Stunde + 1 Minute Puffer, dann stündlich
    forecastTimeout = setTimeout(async () => {
      await fetchForecast()
      forecastInterval = setInterval(fetchForecast, 60 * 60 * 1000)
    }, msUntilNextHourWithBuffer(1))

    wallboxInterval = setInterval(async () => {
      const state = await fetchState()
      await fetchWallbox(state)
    }, 15 * 60 * 1000)

    stateInterval = setInterval(fetchState, 30 * 1000)

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

  // Instant Update for the boilerData after toggle
  const refetchBoilerData = async () => {
    const data = await fetchBoilerData()
    setBoilerData(data)
  }

  // Instant Update for the wallboxData after toggle
  const refetchEGoData = async () => {
    const data = await fetchEGoData()
    setWallboxData(data)
  }

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