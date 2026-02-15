import { fetchJson, postJson, putJson } from '../helper'

export interface BoilerAutomaticConfig {
  enabled: boolean
  target_time: string
  target_temp_c: number
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

// Partial types for updates
export type PartialBoilerConfig = Partial<BoilerAutomaticConfig>
export type PartialWallboxConfig = Partial<WallboxAutomaticConfig>

export interface PartialAutomaticConfig {
  boiler?: PartialBoilerConfig
  wallbox?: PartialWallboxConfig
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
 * Update automatic configuration (supports partial updates)
 */
export async function updateAutomaticConfig(
  currentConfig: AutomaticConfig,
  originalConfig: AutomaticConfig
): Promise<boolean> {
  try {
    // Build partial update payload with only changed fields
    const payload: PartialAutomaticConfig = {}

    // Check boiler changes
    const boilerChanges: PartialBoilerConfig = {}
    if (currentConfig.boiler.enabled !== originalConfig.boiler.enabled) {
      boilerChanges.enabled = currentConfig.boiler.enabled
    }
    if (currentConfig.boiler.target_time !== originalConfig.boiler.target_time) {
      boilerChanges.target_time = currentConfig.boiler.target_time
    }
    if (currentConfig.boiler.target_temp_c !== originalConfig.boiler.target_temp_c) {
      boilerChanges.target_temp_c = currentConfig.boiler.target_temp_c
    }
    if (currentConfig.boiler.min_runtime_min !== originalConfig.boiler.min_runtime_min) {
      boilerChanges.min_runtime_min = currentConfig.boiler.min_runtime_min
    }
    if (Object.keys(boilerChanges).length > 0) {
      payload.boiler = boilerChanges
    }

    // Check wallbox changes
    const wallboxChanges: PartialWallboxConfig = {}
    if (currentConfig.wallbox.enabled !== originalConfig.wallbox.enabled) {
      wallboxChanges.enabled = currentConfig.wallbox.enabled
    }
    if (currentConfig.wallbox.target_time !== originalConfig.wallbox.target_time) {
      wallboxChanges.target_time = currentConfig.wallbox.target_time
    }
    if (currentConfig.wallbox.energy_kwh !== originalConfig.wallbox.energy_kwh) {
      wallboxChanges.energy_kwh = currentConfig.wallbox.energy_kwh
    }
    if (currentConfig.wallbox.allow_night_grid !== originalConfig.wallbox.allow_night_grid) {
      wallboxChanges.allow_night_grid = currentConfig.wallbox.allow_night_grid
    }
    if (Object.keys(wallboxChanges).length > 0) {
      payload.wallbox = wallboxChanges
    }

    // Send partial update
    await putJson('/automatic-config', payload)
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