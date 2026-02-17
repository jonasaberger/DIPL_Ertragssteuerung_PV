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
// BACKEND CONFIG (AsyncStorage)
// -----------------------

export async function setBackendConfigLocal(
  ip: string,
  port: number,
  path: string
): Promise<void> {
  try {
    const newConfig: BackendConfig = { backend_ip: ip, backend_port: port, backend_path: path }
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig))
    console.log('Backend config updated locally:', newConfig)
  } catch (error) {
    console.error('Error updating backend config locally:', error)
    throw error
  }
}

export async function getBackendConfig(): Promise<BackendConfig> {
  const defaultConfig: BackendConfig = {
    backend_ip: '100.120.107.71',
    backend_port: 5050,
    backend_path: '/api',
  }
  try {
    const json = await AsyncStorage.getItem(CONFIG_KEY)
    if (!json || json.trim() === '') {
      console.log('No config in storage, using and saving default')
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(defaultConfig))
      return defaultConfig
    }
    const parsed = JSON.parse(json)
    console.log('Loaded config from storage:', parsed)
    return parsed
  } catch (error) {
    console.error('Config error - using default:', error)
    try {
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(defaultConfig))
    } catch (saveError) {
      console.error('Could not save default config:', saveError)
    }
    return defaultConfig
  }
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

export async function resetBackendConfigLocal(): Promise<void> {
  const defaultConfig: BackendConfig = {
    backend_ip: '100.120.107.71',
    backend_port: 5050,
    backend_path: '/api',
  }
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(defaultConfig))
  console.log('Backend config reset to default:', defaultConfig)
}

// -----------------------
// HELPER FUNCTIONS
// -----------------------

export function parseDeviceUrl(device: Device): { ip: string; port: string; path: string } | null {
  try {
    const url = new URL(device.baseUrl)
    const ip = url.hostname
    const port = url.port || (url.protocol === 'https:' ? '443' : '80')
    const firstEndpoint = Object.values(device.endpoints)[0] || ''
    return { ip, port, path: firstEndpoint }
  } catch (error) {
    console.error('Error parsing device URL:', error)
    return null
  }
}

export function buildDeviceUrl(ip: string, port: string, useHttps: boolean = false): string {
  const protocol = useHttps ? 'https' : 'http'
  return `${protocol}://${ip}:${port}`
}