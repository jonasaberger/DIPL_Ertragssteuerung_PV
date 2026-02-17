import { fetchJson, parseInfluxTime, round1 } from '@/services/helper'
export interface PV_Data {
  date: string
  time: string
  pv_power: number
  grid_power: number
  load_power: number
  battery_power: number
  soc: number
  energy_total: number
  rel_autonomy: number
  rel_selfconsumption: number
}

export async function fetchLatestPVData(): Promise<PV_Data | null> {
  try {
    const data = await fetchJson<any>('/pv/latest')
    const { date, time } = parseInfluxTime(data._time)

    return {
      date,
      time,
      pv_power: round1(data.pv_power),
      grid_power: round1(data.grid_power),
      load_power: round1(data.load_power),
      battery_power: round1(data.battery_power),
      soc: round1(data.soc),
      energy_total: round1(data.e_total),
      rel_autonomy: round1(data.rel_autonomy),
      rel_selfconsumption: round1(data.rel_selfconsumption),
    }
  } catch (error) {
    console.error('Failed to fetch PV data:', error)
    return null
  }
}
