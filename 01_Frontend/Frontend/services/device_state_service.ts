import { fetchJson, parseInfluxTime } from './helper'

type LoggingApiRow = {
  message: unknown
  time: unknown
}

export interface DeviceStateLogEntry {
  date: string
  time: string
  device: string
  from: string
  to: string
  rawMessage: string
  rawTime: string
}

function parseDeviceStateMessage(message: string): {
  device: string
  from: string
  to: string
} | null {
  const m = message.match(/^\s*([^:]+)\s*:\s*(.*?)\s*→\s*(.*?)\s*$/)
  if (!m) return null

  const device = (m[1] ?? '').trim()
  const from = (m[2] ?? '').trim()
  const to = (m[3] ?? '').trim()

  if (!device || !from || !to) return null
  return { device, from, to }
}

export async function fetchDeviceStateLogs(): Promise<DeviceStateLogEntry[]> {
  const rows = await fetchJson<LoggingApiRow[]>(
    '/logging?type=device_state_change&limit=50'
  )

  const out: DeviceStateLogEntry[] = []

  for (const row of rows ?? []) {
    if (typeof row?.message !== 'string') continue
    if (typeof row?.time !== 'string') continue

    const parsed = parseDeviceStateMessage(row.message)
    if (!parsed) continue

    const { date, time } = parseInfluxTime(row.time)

    out.push({
      date,
      time,
      device: parsed.device,
      from: parsed.from,
      to: parsed.to,
      rawMessage: row.message,
      rawTime: row.time,
    })
  }

  return out
}
