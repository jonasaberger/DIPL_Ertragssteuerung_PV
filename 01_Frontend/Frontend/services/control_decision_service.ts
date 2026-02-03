// services/control_decision_service.ts
import { fetchJson, parseInfluxTime } from './helper'

type LoggingApiRow = {
  message: string
  time: string
}

export interface ControlDecisionLogEntry {
  date: string
  time: string
  device?: string
  action?: string
  reason?: string
  success?: boolean
  extra?: string | null
  rawMessage: string
  rawTime: string
}

function parseBool(value?: string): boolean | undefined {
  if (value == null) return undefined
  const v = value.trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return undefined
}

function parseMessage(message: string): {
  device?: string
  action?: string
  reason?: string
  success?: boolean
  extra?: string | null
} {
  const parts = message.split('|').map(p => p.trim())
  const map: Record<string, string> = {}

  for (const part of parts) {
    const [key, ...rest] = part.split('=')
    if (!key || rest.length === 0) continue
    map[key.trim()] = rest.join('=').trim()
  }

  return {
    device: map.device,
    action: map.action,
    reason: map.reason,
    success: parseBool(map.success),
    extra: map.extra === 'None' ? null : map.extra,
  }
}

export async function fetchControlDecisionLogs(): Promise<ControlDecisionLogEntry[]> {
  const rows = await fetchJson<LoggingApiRow[]>(
    '/logging?type=control_decision&limit=50'
  )

  return rows.map(row => {
    const { date, time } = parseInfluxTime(row.time)
    const parsed = parseMessage(row.message)

    return {
      date,
      time,
      ...parsed,
      rawMessage: row.message,
      rawTime: row.time,
    }
  })
}
