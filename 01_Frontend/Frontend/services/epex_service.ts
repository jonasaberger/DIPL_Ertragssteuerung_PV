import { fetchJson, parseInfluxTime, round1 } from './helper'

export interface EpexData {
  date: string
  time: string
  pricePerKWh: number
}

export async function fetchEpexData(): Promise<EpexData | null> {
  try {
    const data = await fetchJson<any>('/epex/latest')
    const { date, time } = parseInfluxTime(data._time)

    return {
      date,
      time,
      pricePerKWh: round1(data.price),
    }
  } catch (error) {
    console.error('Failed to fetch EPEX data:', error)
    return null
  }
}
