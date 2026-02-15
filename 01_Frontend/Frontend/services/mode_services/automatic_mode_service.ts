import { fetchJson, postJson, putJson } from '../helper'

export interface SeasonConfig {
  enabled: boolean
  target_time: string
  target_temp_c?: number // nur für Boiler
  min_runtime_min?: number // nur für Boiler
  energy_kwh?: number // nur für Wallbox
  allow_night_grid?: boolean // nur für Wallbox
}

export interface BoilerAutomaticConfig {
  enabled: boolean
  summer: {
    enabled: boolean
    target_time: string
    target_temp_c: number
    min_runtime_min: number
  }
  winter: {
    enabled: boolean
    target_time: string
    target_temp_c: number
    min_runtime_min: number
  }
}

export interface WallboxAutomaticConfig {
  enabled: boolean
  summer: {
    enabled: boolean
    target_time: string
    energy_kwh: number
    allow_night_grid: boolean
  }
  winter: {
    enabled: boolean
    target_time: string
    energy_kwh: number
    allow_night_grid: boolean
  }
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
    const boilerChanges: any = {}
    
    if (currentConfig.boiler.enabled !== originalConfig.boiler.enabled) {
      boilerChanges.enabled = currentConfig.boiler.enabled
    }
    
    // Check summer changes
    const summerChanges: any = {}
    if (currentConfig.boiler.summer.enabled !== originalConfig.boiler.summer.enabled) {
      summerChanges.enabled = currentConfig.boiler.summer.enabled
    }
    if (currentConfig.boiler.summer.target_time !== originalConfig.boiler.summer.target_time) {
      summerChanges.target_time = currentConfig.boiler.summer.target_time
    }
    if (currentConfig.boiler.summer.target_temp_c !== originalConfig.boiler.summer.target_temp_c) {
      summerChanges.target_temp_c = currentConfig.boiler.summer.target_temp_c
    }
    if (currentConfig.boiler.summer.min_runtime_min !== originalConfig.boiler.summer.min_runtime_min) {
      summerChanges.min_runtime_min = currentConfig.boiler.summer.min_runtime_min
    }
    if (Object.keys(summerChanges).length > 0) {
      boilerChanges.summer = summerChanges
    }
    
    // Check winter changes
    const winterChanges: any = {}
    if (currentConfig.boiler.winter.enabled !== originalConfig.boiler.winter.enabled) {
      winterChanges.enabled = currentConfig.boiler.winter.enabled
    }
    if (currentConfig.boiler.winter.target_time !== originalConfig.boiler.winter.target_time) {
      winterChanges.target_time = currentConfig.boiler.winter.target_time
    }
    if (currentConfig.boiler.winter.target_temp_c !== originalConfig.boiler.winter.target_temp_c) {
      winterChanges.target_temp_c = currentConfig.boiler.winter.target_temp_c
    }
    if (currentConfig.boiler.winter.min_runtime_min !== originalConfig.boiler.winter.min_runtime_min) {
      winterChanges.min_runtime_min = currentConfig.boiler.winter.min_runtime_min
    }
    if (Object.keys(winterChanges).length > 0) {
      boilerChanges.winter = winterChanges
    }
    
    if (Object.keys(boilerChanges).length > 0) {
      payload.boiler = boilerChanges
    }

    // Check wallbox changes
    const wallboxChanges: any = {}
    
    if (currentConfig.wallbox.enabled !== originalConfig.wallbox.enabled) {
      wallboxChanges.enabled = currentConfig.wallbox.enabled
    }
    
    // Check summer changes
    const wallboxSummerChanges: any = {}
    if (currentConfig.wallbox.summer.enabled !== originalConfig.wallbox.summer.enabled) {
      wallboxSummerChanges.enabled = currentConfig.wallbox.summer.enabled
    }
    if (currentConfig.wallbox.summer.target_time !== originalConfig.wallbox.summer.target_time) {
      wallboxSummerChanges.target_time = currentConfig.wallbox.summer.target_time
    }
    if (currentConfig.wallbox.summer.energy_kwh !== originalConfig.wallbox.summer.energy_kwh) {
      wallboxSummerChanges.energy_kwh = currentConfig.wallbox.summer.energy_kwh
    }
    if (currentConfig.wallbox.summer.allow_night_grid !== originalConfig.wallbox.summer.allow_night_grid) {
      wallboxSummerChanges.allow_night_grid = currentConfig.wallbox.summer.allow_night_grid
    }
    if (Object.keys(wallboxSummerChanges).length > 0) {
      wallboxChanges.summer = wallboxSummerChanges
    }
    
    // Check winter changes
    const wallboxWinterChanges: any = {}
    if (currentConfig.wallbox.winter.enabled !== originalConfig.wallbox.winter.enabled) {
      wallboxWinterChanges.enabled = currentConfig.wallbox.winter.enabled
    }
    if (currentConfig.wallbox.winter.target_time !== originalConfig.wallbox.winter.target_time) {
      wallboxWinterChanges.target_time = currentConfig.wallbox.winter.target_time
    }
    if (currentConfig.wallbox.winter.energy_kwh !== originalConfig.wallbox.winter.energy_kwh) {
      wallboxWinterChanges.energy_kwh = currentConfig.wallbox.winter.energy_kwh
    }
    if (currentConfig.wallbox.winter.allow_night_grid !== originalConfig.wallbox.winter.allow_night_grid) {
      wallboxWinterChanges.allow_night_grid = currentConfig.wallbox.winter.allow_night_grid
    }
    if (Object.keys(wallboxWinterChanges).length > 0) {
      wallboxChanges.winter = wallboxWinterChanges
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