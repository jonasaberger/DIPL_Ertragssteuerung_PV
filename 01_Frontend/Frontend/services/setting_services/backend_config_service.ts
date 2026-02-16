import AsyncStorage from '@react-native-async-storage/async-storage'

const CONFIG_KEY = 'backend_config'

// -----------------------
// TYPES
// -----------------------

export interface BackendConfig {
  backend_ip: string
  backend_port: number
  backend_path: string
}

export interface DeviceEndpoints {
  [key: string]: string
}

export interface Device {
  deviceId: string
  baseUrl: string
  endpoints: DeviceEndpoints
  [key: string]: any
}

export interface DevicesResponse {
  [deviceId: string]: {
    baseUrl: string
    endpoints: DeviceEndpoints
    [key: string]: any
  }
}

export interface UpdateDevicePayload {
  deviceId: string
  password: string
  payload: {
    baseUrl?: string
    endpoints?: DeviceEndpoints
  }
}

// -----------------------
// BACKEND CONFIG (AsyncStorage - nur Backend IP)
// -----------------------

export async function getBackendConfig(): Promise<BackendConfig> {
  try {
    const json = await AsyncStorage.getItem(CONFIG_KEY)
    if (json) {
      return JSON.parse(json)
    }
  } catch (error) {
    console.error('Error loading backend config:', error)
  }

  // Default config
  const defaultConfig: BackendConfig = {
    backend_ip: '100.120.107.71',
    backend_port: 5050,
    backend_path: '/api',
  }
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(defaultConfig))

  console.log('Using default backend config:', defaultConfig)
  return defaultConfig
}

export async function editBackendURL(ip: string, port: number, path: string) {
  const newConfig: BackendConfig = { backend_ip: ip, backend_port: port, backend_path: path }
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig))
  console.log('Backend URL updated successfully')
}

export async function getBackendBaseURL(): Promise<string> {
  const cfg = await getBackendConfig()
  return `http://${cfg.backend_ip}:${cfg.backend_port}${cfg.backend_path}`
}

// -----------------------
// DEVICES FROM BACKEND API
// -----------------------

export async function fetchDevices(): Promise<DevicesResponse> {
  try {
    const baseUrl = await getBackendBaseURL()
    const response = await fetch(`${baseUrl}/devices/get_devices`, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText} ${text}`)
    }

    const devices: DevicesResponse = await response.json()
    console.log(`Fetched devices from backend:`, Object.keys(devices))
    return devices
  } catch (error) {
    console.error('Error fetching devices:', error)
    throw error
  }
}

export async function getDevice(deviceId: string): Promise<Device | null> {
  try {
    const devices = await fetchDevices()
    const device = devices[deviceId]
    if (!device) return null
    
    return {
      deviceId,
      ...device
    }
  } catch (error) {
    console.error(`Error getting device ${deviceId}:`, error)
    return null
  }
}

// -----------------------
// UPDATE DEVICE CONFIG
// -----------------------

export async function updateDeviceConfig(
  deviceId: string,
  password: string,
  baseUrl?: string,
  endpoints?: DeviceEndpoints
): Promise<DevicesResponse> {
  try {
    const backendUrl = await getBackendBaseURL()
    
    const payload: UpdateDevicePayload = {
      deviceId,
      password,
      payload: {}
    }

    if (baseUrl) payload.payload.baseUrl = baseUrl
    if (endpoints) payload.payload.endpoints = endpoints

    const response = await fetch(`${backendUrl}/devices/edit_device`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      if (response.status === 401 || response.status === 403) {
        throw new Error('Falsches Passwort')
      }
      throw new Error(`Failed to update device: ${response.status} ${response.statusText} ${text}`)
    }

    const updatedDevices: DevicesResponse = await response.json()
    console.log(`Device ${deviceId} updated successfully`)
    return updatedDevices
  } catch (error) {
    console.error(`Error updating device ${deviceId}:`, error)
    throw error
  }
}

// -----------------------
// HELPER FUNCTIONS
// -----------------------

export function parseDeviceUrl(device: Device): { ip: string; port: string; path: string } | null {
  try {
    const url = new URL(device.baseUrl)
    const ip = url.hostname
    const port = url.port || (url.protocol === 'https:' ? '443' : '80')
    
    // Get first endpoint as path, or empty string
    const firstEndpoint = Object.values(device.endpoints)[0] || ''
    
    return {
      ip,
      port,
      path: firstEndpoint
    }
  } catch (error) {
    console.error('Error parsing device URL:', error)
    return null
  }
}

export function buildDeviceUrl(ip: string, port: string, useHttps: boolean = false): string {
  const protocol = useHttps ? 'https' : 'http'
  return `${protocol}://${ip}:${port}`
}

// -----------------------
// CONVENIENCE FUNCTIONS
// -----------------------

export async function getDevicesByType(): Promise<{
  epex?: Device
  pv?: Device
  wallbox?: Device
}> {
  try {
    const devices = await fetchDevices()
    
    return {
      epex: devices['epex'] ? { deviceId: 'epex', ...devices['epex'] } : undefined,
      pv: devices['pv'] ? { deviceId: 'pv', ...devices['pv'] } : undefined,
      wallbox: devices['wallbox'] ? { deviceId: 'wallbox', ...devices['wallbox'] } : undefined
    }
  } catch (error) {
    console.error('Error getting devices by type:', error)
    return {}
  }
}