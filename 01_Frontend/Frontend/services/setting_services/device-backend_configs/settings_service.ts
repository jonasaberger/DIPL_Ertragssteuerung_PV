import { fetchJson, postJson } from '@/services/helper'

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
// ADMIN
// -----------------------

export async function verifyAdminPW(password: string): Promise<boolean> {
  const data = await postJson<{ success: boolean }>(
    '/devices/admin/verify_admin_pw',
    { password }
  )
  return Boolean(data?.success === true)
}

// -----------------------
// DEVICES
// -----------------------

export async function fetchDevices(): Promise<DevicesResponse | null> {
  return fetchJson<DevicesResponse>('/devices/get_devices')
}

export async function getDevice(deviceId: string): Promise<Device | null> {
  const devices = await fetchDevices()
  if (!devices?.[deviceId]) return null
  return { deviceId, ...devices[deviceId] }
}

export async function updateDeviceConfig(
  deviceId: string,
  password: string,
  baseUrl?: string,
  endpoints?: DeviceEndpoints
): Promise<DevicesResponse | null> {
  const payload: UpdateDevicePayload = { deviceId, password, payload: {} }
  if (baseUrl) payload.payload.baseUrl = baseUrl
  if (endpoints) payload.payload.endpoints = endpoints

  return postJson<DevicesResponse>('/devices/edit_device', payload)
}

export async function resetDevices(): Promise<boolean> {
  const data = await postJson<{ success: boolean }>('/devices/reset_devices', {})
  return Boolean(data?.success === true)
}

export async function getDevicesByType(): Promise<{
  epex?: Device
  pv?: Device
  wallbox?: Device
}> {
  const devices = await fetchDevices()
  if (!devices) return {}
  return {
    epex: devices['epex'] ? { deviceId: 'epex', ...devices['epex'] } : undefined,
    pv: devices['pv'] ? { deviceId: 'pv', ...devices['pv'] } : undefined,
    wallbox: devices['wallbox'] ? { deviceId: 'wallbox', ...devices['wallbox'] } : undefined,
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