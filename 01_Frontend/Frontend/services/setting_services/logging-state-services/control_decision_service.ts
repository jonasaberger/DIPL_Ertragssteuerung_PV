import { fetchJson, parseInfluxTime } from '@/services/helper'

type LoggingApiRow = {
  message: string
  time: string
}

export interface ControlDecisionLogEntry {
  date: string
  time: string
  message: string
  rawMessage: string
  rawTime: string
}

export async function fetchControlDecisionLogs(): Promise<ControlDecisionLogEntry[]> {
  const rows = await fetchJson<LoggingApiRow[]>(
    '/logging?type=system_event&limit=200', 
  )

  return rows.map((row) => {
    const { date, time } = parseInfluxTime(row.time)

    return {
      date,
      time,
      message: row.message,
      rawMessage: row.message,
      rawTime: row.time,
    }
  })
}