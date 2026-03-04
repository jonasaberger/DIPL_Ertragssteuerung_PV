import { fetchJson, parseInfluxTime } from '@/services/helper'

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
  details: string[] // ✅ Rest der Message (| und / => Zeilen)
  rawMessage: string
  rawTime: string
}

// ✅ macht aus "a | b / c | d" => ["a", "b", "c", "d"]
function splitDetails(s: string): string[] {
  return s
    .split('|')
    .map(p => p.trim())
    .filter(Boolean)
    .flatMap(p => p.split('/').map(x => x.trim()).filter(Boolean))
}

function parseDeviceStateMessage(message: string): {
  device: string
  from: string
  to: string
  details: string[]
} | null {
  const msg = String(message ?? '').trim()
  if (!msg) return null

  // ✅ Erstes "|" trennt Zustandswechsel von Details
  const pipeIdx = msg.indexOf('|')
  const head = (pipeIdx >= 0 ? msg.slice(0, pipeIdx) : msg).trim()
  const tail = (pipeIdx >= 0 ? msg.slice(pipeIdx + 1) : '').trim()

  // ✅ Unterstützt "→" und "->"
  const m = head.match(/^\s*([^:]+)\s*:\s*(.*?)\s*(?:→|->)\s*(.*?)\s*$/)
  if (!m) return null

  const device = (m[1] ?? '').trim()
  const from = (m[2] ?? '').trim()
  const to = (m[3] ?? '').trim()

  if (!device || !from || !to) return null

  const details = tail ? splitDetails(tail) : []

  return { device, from, to, details }
}

export async function fetchDeviceStateLogs(): Promise<DeviceStateLogEntry[]> {
  const rows = await fetchJson<LoggingApiRow[]>(
    '/logging?type=device_state_change&limit=200'
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
      details: parsed.details, // ✅ Details mitnehmen
      rawMessage: row.message,
      rawTime: row.time,
    })
  }

  return out
}