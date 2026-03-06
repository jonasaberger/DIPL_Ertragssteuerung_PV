import { fetchJson, showToastMessage } from '@/services/helper'

export interface ForecastData {
  best_hour_today: string
  pv_hours_today: number
  pv_today: boolean
  pv_tomorrow: boolean
  source: string
}

export async function fetchForecastData(): Promise<ForecastData | null> {
  try {
    const data = await fetchJson<ForecastData>('/forecast')
    return data
  }
  catch (error) {
    showToastMessage('Wettervorhersage-Error', 'Wetterdaten konnten nicht geladen werden', 0)
    console.error('Failed to fetch Forecast data:', error)
  }
  return null
}