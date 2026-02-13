import { fetchJson, postJson, putJson } from './helper'

export interface BoilerAutomaticConfig {
  enabled: boolean
  target_time: string
  energy_kwh: number
  min_runtime_min: number
}

export interface WallboxAutomaticConfig {
  enabled: boolean
  target_time: string
  energy_kwh: number
  allow_night_grid: boolean
}

export interface AutomaticConfig {
  boiler: BoilerAutomaticConfig
  wallbox: WallboxAutomaticConfig
}

/**
 * Fetch current automatic configuration
 */
export async function fetchAutomaticConfig(): Promise<AutomaticConfig | null> {
  try {
    const data = await fetchJson<AutomaticConfig>('/automatic-config')
    return data
  } catch (error) {
    console.error('Failed to fetch automatic config:', error)
    return null
  }
}

/**
 * Update automatic configuration
 */
export async function updateAutomaticConfig(config: AutomaticConfig): Promise<boolean> {
  try {
    await putJson('/automatic-config', config)
    return true
  } catch (error) {
    console.error('Failed to update automatic config:', error)
    return false
  }
}

/**
 * Reset automatic configuration to default
 */
export async function resetAutomaticConfig(): Promise<boolean> {
  try {
    await postJson('/automatic-config', {})
    return true
  } catch (error) {
    console.error('Failed to reset automatic config:', error)
    return false
  }
}