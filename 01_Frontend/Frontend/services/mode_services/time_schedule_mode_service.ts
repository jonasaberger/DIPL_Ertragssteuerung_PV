import { fetchJson, postJson, putJson } from '@/services/helper'

export type Season = 'winter' | 'summer'

export interface TimeWindow {
  start: string
  end: string
}

export interface ScheduleConfig {
  boiler: {
    winter: TimeWindow
    summer: TimeWindow
  }
  wallbox: {
    winter: TimeWindow
    summer: TimeWindow
  }
}

export type PartialTimeWindow = Partial<TimeWindow>

export interface PartialScheduleConfig {
  boiler?: {
    winter?: PartialTimeWindow
    summer?: PartialTimeWindow
  }
  wallbox?: {
    winter?: PartialTimeWindow
    summer?: PartialTimeWindow
  }
}

/**
 * Fetch current schedule configuration
 */
export async function fetchScheduleConfig(): Promise<ScheduleConfig | null> {
  try {
    const data = await fetchJson<ScheduleConfig>('/schedule')
    return data
  } catch (error) {
    console.error('Failed to fetch schedule config:', error)
    return null
  }
}

/**
 * Zeitplan-Konfiguration aktualisieren (Partial-Update)
 */
export async function updateScheduleConfig(
  currentConfig: ScheduleConfig, // Aktualisierte Konfiguration aus dem Formular
  originalConfig: ScheduleConfig // Ursprüngliche Konfiguration vor den Änderungen
): Promise<boolean> {
  try {
    // Nur geänderte Felder werden ins Payload aufgenommen
    const payload: PartialScheduleConfig = {}

    const devices: Array<'boiler' | 'wallbox'> = ['boiler', 'wallbox']
    const seasons: Season[] = ['summer', 'winter']

    // Alle Geräte durchlaufen
    for (const device of devices) {
      const deviceChanges: any = {}

      // Alle Jahreszeiten pro Gerät durchlaufen
      for (const season of seasons) {
        const seasonChanges: PartialTimeWindow = {}
        
        // Start- und Endzeit mit Originalwerten vergleichen
        if (currentConfig[device][season].start !== originalConfig[device][season].start) {
          seasonChanges.start = currentConfig[device][season].start
        }
        if (currentConfig[device][season].end !== originalConfig[device][season].end) {
          seasonChanges.end = currentConfig[device][season].end
        }

        // Saison nur ins Payload aufnehmen, wenn Änderungen vorhanden
        if (Object.keys(seasonChanges).length > 0) {
          deviceChanges[season] = seasonChanges
        }
      }

      // Gerät nur ins Payload aufnehmen, wenn Änderungen vorhanden
      if (Object.keys(deviceChanges).length > 0) {
        payload[device] = deviceChanges
      }
    }

    // Minimales Partial-Update an das Backend senden
    await putJson('/schedule', payload)
    return true
  } catch (error) {
    console.error('Failed to update schedule config:', error)
    return false
  }
}

/**
 * Reset schedule configuration to default
 */
export async function resetScheduleConfig(): Promise<boolean> {
  try {
    await postJson('/schedule', {})
    return true
  } catch (error) {
    console.error('Failed to reset schedule config:', error)
    return false
  }
}