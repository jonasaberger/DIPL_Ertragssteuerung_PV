// helper/epex.ts
import { fetchJson, putJson, parseInfluxTime, round1 } from '../helper'

export interface EpexData {
  date: string
  time: string
  priceRaw: number
  priceOffset: number
  pricePerKWh: number
}

export async function fetchEpexData(): Promise<EpexData | null> {
  try {
    const data = await fetchJson<any>('/epex/latest')
    const { date, time } = parseInfluxTime(data._time)

    return {
      date,
      time,
      priceRaw: round1(data.price_raw),
      priceOffset: round1(data.price_offset ?? 0),
      pricePerKWh: round1(data.price),
    }
  } catch (error) {
    console.error('Failed to fetch EPEX data:', error)
    return null
  }
}

export async function updatePriceOffset(newOffset: number): Promise<void> {
  await putJson('/epex/price-offset', {
    priceOffset: newOffset
  })
}