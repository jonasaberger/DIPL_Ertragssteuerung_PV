import { fetchJson, postJson,  parseInfluxTime, round1 } from './helper'

export interface EGoData {
  date: string
  time: string
  energy: number       // Gesamtenergie in kWh
  ampere: number       // Strom in A
  carConnected: boolean
  isCharging: boolean
  phases: number
  alwaysAllowed: boolean
}

// Holt die aktuellen Daten der Wallbox dynamisch aus der API
export async function fetchEGoData(): Promise<EGoData | null> {
  try {
    const data = await fetchJson<any>('/wallbox/latest')

    const { date, time } = parseInfluxTime(data._time)

    return {
      date,
      time,
      energy: round1(data.eto),                // Gesamtenergie kWh
      ampere: data.amp,                        // Ampere
      carConnected: data.car === 1,            // 1 = true, 0 = false
      isCharging: data.charging === 1,         // 1 = true, 0 = false
      phases: data.pha_count,                  // Anzahl Phasen
      alwaysAllowed: data.alw === 1,           // Lademodus-Flag
    }
  } catch (error) {
    console.error('Failed to fetch e-Go Wallbox data:', error)
    return null
  }
}

export async function allowEGoPower(setting: 'MANUAL_OFF' | 'MANUAL_ON'): Promise<boolean> {
    try {
        const allow = setting === 'MANUAL_ON' ? true : false
        console.log('Toggling EGoAllow to:', allow)
        await postJson('/wallbox/setCharging', {allow})

        return true
    }
    catch(error) {
        console.error('Failed to allow the EGoPower:',error)
        return false
    }
}
