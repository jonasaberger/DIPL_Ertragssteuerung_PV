import { getBackendBaseURL } from "./setting_services/device-backend_configs/backend_config_service"
import Toast from 'react-native-toast-message'

// Make API_BASE async-aware
let API_BASE: string | null = null

async function ensureAPIBase(): Promise<string> {
  if (!API_BASE) {
    API_BASE = await getBackendBaseURL()
  }
  return API_BASE
}

// Fetch - Helper
export async function fetchJson<T>(path: string): Promise<T> {
  const baseUrl = await ensureAPIBase()
  const response = await fetch(`${baseUrl}${path}`)

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `API ${path} failed: ${response.status} ${response.statusText} ${text}`
    )
  }
  return response.json() as Promise<T>
}

// POST - Helper
export async function postJson<T = any>(
  path: string,
  body: Record<string, any>
): Promise<T> {
  const baseUrl = await ensureAPIBase()
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `API POST ${path} failed: ${response.status} ${response.statusText} ${text}`
    )
  }
  console.log(`API POST ${path} succeeded.`)
  return response.json() as Promise<T>
}

// PUT - Helper
export async function putJson<T = any>(
  path: string,
  body: Record<string, any>
): Promise<T> {
  const baseUrl = await ensureAPIBase()
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `API PUT ${path} failed: ${response.status} ${response.statusText} ${text}`
    )
  }
  console.log(`API PUT ${path} succeeded.`)
  return response.json() as Promise<T>
}

// Helper to reset API_BASE (useful if backend config changes)
export function resetAPIBase(): void {
  API_BASE = null
}

// Rest of your helpers remain the same...
export function parseInfluxTime(rawTime: string): {
  date: string
  time: string
} {
  const [datePart, timePart] = rawTime.split('T')
  const [year, month, day] = datePart.split('-').map(Number)

  return {
    date: `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`,
    time: timePart.slice(0, 8),
  }
}

export function round1(value: number): number {
  return Number(value.toFixed(1))
}

export function timeStringToDate (timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

export function dateToTimeString (date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export const showToastMessage = (message: string, success: boolean) => {
  if (success) {
    Toast.show({
      type: 'success',
      text1: 'Erfolg',
      text2: `${message}`,
      position: 'bottom',
      visibilityTime: 2000,
    })
  } else {
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: `${message}`,
      position: 'bottom',
      visibilityTime: 2000,
    })
  }
}