const API_BASE = 'http://100.120.107.71:5050/api'

// Fetch - Helper
export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)

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
  const response = await fetch(`${API_BASE}${path}`, {
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
  const response = await fetch(`${API_BASE}${path}`, {
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

// TimeConvert - Helper
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

// Number - Helper
export function round1(value: number): number {
  return Number(value.toFixed(1))
}

// Convert time string to Date object
export function timeStringToDate (timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

// Convert Date to time string
export function dateToTimeString (date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}