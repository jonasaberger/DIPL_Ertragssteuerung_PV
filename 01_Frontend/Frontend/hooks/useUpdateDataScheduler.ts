import { useEffect, useState } from 'react'
import { fetchLatestPVData, PV_Data } from '@/services/pv_services'
import { fetchBoilerData, BoilerData } from '@/services/boiler_service'
import { fetchEpexData, EpexData } from '@/services/epex_service'

/* =========================
   Zeit-Berechnung
========================= */
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

/* =========================
   Hook
========================= */
export function useUpdateDataScheduler() {
  const [pvData, setPvData] = useState<PV_Data | null>(null)
  const [boilerData, setBoilerData] = useState<BoilerData | null>(null)
  const [epexData, setEpexData] = useState<EpexData | null>(null)

  useEffect(() => {
    let isMounted = true

    let pvTimeout: ReturnType<typeof setTimeout>
    let pvInterval: ReturnType<typeof setInterval>

    let epexTimeout: ReturnType<typeof setTimeout>
    let epexInterval: ReturnType<typeof setInterval>

    /* -------- Fetcher -------- */
    const fetchPVAndBoiler = async () => {
      try {
        const [pv, boiler] = await Promise.all([
          fetchLatestPVData(),
          fetchBoilerData(),
        ])
        if (!isMounted) return
        if (pv) setPvData(pv)
        if (boiler) setBoilerData(boiler)
        console.log('PV+Boiler updated', pv, boiler)
      } catch (err) {
        console.error('Error fetching PV+Boiler:', err)
      }
    }

    const fetchEpex = async () => {
      try {
        const data = await fetchEpexData()
        if (isMounted && data) setEpexData(data)
        console.log('EPEX updated', data)
      } catch (err) {
        console.error('Error fetching EPEX:', err)
      }
    }

    /* -------- Initial Load -------- */
    fetchPVAndBoiler()
    fetchEpex()

    /* -------- PV + Boiler Scheduler (Viertelstunde) -------- */
    pvTimeout = setTimeout(() => {
      fetchPVAndBoiler()
      pvInterval = setInterval(fetchPVAndBoiler, 15 * 60 * 1000)
    }, msUntilNextQuarterHour())

    /* -------- EPEX Scheduler (volle Stunde + Puffer) -------- */
    epexTimeout = setTimeout(() => {
      fetchEpex()
      epexInterval = setInterval(fetchEpex, 60 * 60 * 1000)
    }, msUntilNextHourWithBuffer(2)) // 2 Minuten Puffer

    /* -------- Cleanup -------- */
    return () => {
      isMounted = false
      clearTimeout(pvTimeout)
      clearInterval(pvInterval)
      clearTimeout(epexTimeout)
      clearInterval(epexInterval)
    }
  }, [])

  return {
    pvData,
    boilerData,
    epexData,
  }
}
