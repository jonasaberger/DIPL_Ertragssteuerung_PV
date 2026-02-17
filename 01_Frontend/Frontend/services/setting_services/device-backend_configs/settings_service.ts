import { postJson } from '@/services/helper'
import { getBackendBaseURL, type Device, type DeviceEndpoints, type DevicesResponse, type UpdateDevicePayload } from './backend_config_service'

// -----------------------
// ADMIN
// -----------------------

export async function verifyAdminPW(password: string): Promise<boolean> {
  try {
    const data = await postJson<{ success: boolean }>(
      '/devices/admin/verify_admin_pw',
      { password }
    )
    return Boolean(data && data.success === true)
  } catch (error) {
    console.error('Failed to verify admin password:', error)
    return false
  }
}

// -----------------------
// DEVICES
// -----------------------

export async function fetchDevices(): Promise<DevicesResponse> {
  try {
    const baseUrl = await getBackendBaseURL()
    const response = await fetch(`${baseUrl}/devices/get_devices`, {
      method: 'GET',
      headers: { 'accept': 'application/json' }
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText} ${text}`)
    }
    const devices: DevicesResponse = await response.json()
    console.log('Fetched devices from backend:', Object.keys(devices))
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
    return { deviceId, ...device }
  } catch (error) {
    console.error(`Error getting device ${deviceId}:`, error)
    return null
  }
}

export async function updateDeviceConfig(
  deviceId: string,
  password: string,
  baseUrl?: string,
  endpoints?: DeviceEndpoints
): Promise<DevicesResponse> {
  try {
    const backendUrl = await getBackendBaseURL()
    const payload: UpdateDevicePayload = { deviceId, password, payload: {} }
    if (baseUrl) payload.payload.baseUrl = baseUrl
    if (endpoints) payload.payload.endpoints = endpoints

    const response = await fetch(`${backendUrl}/devices/edit_device`, {
      method: 'POST',
      headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      if (response.status === 401 || response.status === 403) throw new Error('Falsches Passwort')
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

export async function resetDevices(): Promise<boolean> {
  try {
    const data = await postJson<{ success: boolean }>(
      '/devices/reset_devices',
      {}
    )
    return Boolean(data && data.success === true)
  } catch (error) {
    console.error('Failed to reset devices:', error)
    return false
  }
}

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