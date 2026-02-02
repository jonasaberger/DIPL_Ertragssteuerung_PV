import { fetchJson, postJson, parseInfluxTime, round1 } from './helper'

export interface BoilerData {
  date: string
  time: string
  temp: number
  heating: boolean
}

export async function fetchBoilerData(): Promise<BoilerData | null> {
  try {
    const tempData = await fetchJson<any>('/boiler/latest')
    const stateData = await fetchJson<any>('/boiler/state')

    const { date, time } = parseInfluxTime(tempData._time)

    return {
      date,
      time,
      temp: round1(tempData.boiler_temp),
      heating: Boolean(stateData.heating),
    }
  } catch (error) {
    console.error('Failed to fetch Boiler data:', error)
    return null
  }
}

export async function toggleBoilerSetting(setting: 'MANUAL_OFF' | 'MANUAL_ON'): Promise<boolean> {
  try {
    const action = setting === 'MANUAL_ON' ? 'on' : 'off'
    console.log('Toggling Boiler setting to:', action)
    await postJson('/boiler/control', { action })
    
    return true
  } catch (error) {
    console.error('Failed to toggle Boiler setting:', error)
    return false
  }
}