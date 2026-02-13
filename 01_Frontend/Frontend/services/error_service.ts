import { fetchJson, parseInfluxTime } from './helper'

type LoggingApiRow = {
  message: string
  time: string
}

export interface ErrorLogEntry {
  date: string
  time: string
  type?: string
  endpoint?: string
  method?: string
  status?: number
  error?: string
  detail?: string
  device?: string
  rawMessage: string
  rawTime: string
}

function parseKeyValueMessage(message: string): Record<string, string> {
  const parts = message.split('|').map(p => p.trim())
  const map: Record<string, string> = {}

  for (const part of parts) {
    const [key, ...rest] = part.split('=')
    if (!key || rest.length === 0) continue
    map[key.trim()] = rest.join('=').trim()
  }

  return map
}

function parseIntSafe(v?: string): number | undefined {
  if (v == null) return undefined
  const n = Number.parseInt(v.trim(), 10)
  return Number.isFinite(n) ? n : undefined
}

export async function fetchErrorLogs(limit: number = 50): Promise<ErrorLogEntry[]> {
  const rows = await fetchJson<LoggingApiRow[]>(
    `/logging?type=api_error&limit=${encodeURIComponent(String(limit))}`
  )

  return rows.map(row => {
    const { date, time } = parseInfluxTime(row.time)
    const kv = parseKeyValueMessage(row.message)

    return {
      date,
      time,
      type: kv.type,
      endpoint: kv.endpoint,
      method: kv.method,
      status: parseIntSafe(kv.status),
      error: kv.error,
      detail: kv.detail,
      device: kv.device,
      rawMessage: row.message,
      rawTime: row.time,
    }
  })
}
