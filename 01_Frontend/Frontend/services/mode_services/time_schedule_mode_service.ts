// services/schedule_service.ts
import { fetchJson, postJson, putJson } from '../helper'

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
 * Update schedule configuration
 */
export async function updateScheduleConfig(config: ScheduleConfig): Promise<boolean> {
  try {
    await putJson('/schedule', config)
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