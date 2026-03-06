import { fetchJson, postJson, parseInfluxTime, round1, showToastMessage } from '@/services/helper'

export interface EGoData {
  date: string
  time: string
  energy: number        // Gesamtenergie in kWh
  ampere: number        // Strom in A
  carState: 0 | 1 | 2 | 3 | 4 | 5 // Rohwert: 0=Unknown/Error, 1=Idle, 2=Charging, 3=WaitCar, 4=Complete, 5=Error
  carConnected: boolean // true wenn Fahrzeug physisch verbunden (car_connected === 1)
  phases: number        // Anzahl aktiver Phasen
  alwaysAllowed: boolean
}

// Holt die aktuellen Daten der Wallbox dynamisch aus der API
export async function fetchEGoData(): Promise<EGoData | null> {
  try {
    const data = await fetchJson<any>('/wallbox/latest')

    const { date, time } = parseInfluxTime(data._time)

    console.log(data)
    return {
      date,
      time,
      energy: round1(Number(data.eto ?? 0) / 10),
      ampere: data.amp,
      carState: data.car,
      carConnected: data.car_connected === 1,
      phases: data.pha_count,
      alwaysAllowed: data.alw === 1,
    }

  } catch (error) {
    showToastMessage('Boiler-Error', 'Boiler Daten konnten nicht geladen werden!', 0)
    console.error('Failed to fetch e-Go Wallbox data:', error)
    return null
  }
}

// Setzt den Lademodus (EIN/AUS)
export async function allowEGoPower(setting: 'MANUAL_OFF' | 'MANUAL_ON'): Promise<boolean> {
  try {
    const allow = setting === 'MANUAL_ON'
    console.log('Toggling EGoAllow to:', allow)
    await postJson('/wallbox/setCharging', { allow })
    return true
  } catch (error) {
    console.error('Failed to allow the EGoPower:', error)
    return false
  }
}

// Setzt die Amperezahl (6-16A)
export async function setEGoAmpere(ampere: number): Promise<boolean> {
  try {
    if (ampere < 6 || ampere > 16) {
      console.error('Invalid ampere value. Must be between 6 and 16.')
      return false
    }
    console.log('Setting EGo ampere to:', ampere)
    await postJson('/wallbox/setCurrent', { amp: ampere })
    return true
  } catch (error) {
    console.error('Failed to set EGo ampere:', error)
    return false
  }
}