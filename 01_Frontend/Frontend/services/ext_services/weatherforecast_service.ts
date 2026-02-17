import { fetchJson } from '@/services/helper'

export interface ForecastData {
  best_hour_today: string
  pv_hours_today: number
  pv_today: boolean
  pv_tomorrow: boolean
  source: string
}

export async function fetchForecastData(): Promise<ForecastData | null> {
  return fetchJson<ForecastData>('/api/forecast')
}