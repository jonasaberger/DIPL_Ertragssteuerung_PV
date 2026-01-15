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
