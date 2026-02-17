import type { DateSelection } from '@/components/diagram/d-dates'
import { fetchJson } from './helper'

export type PvPoint = {
  _time: string
  pv_power: number
  load_power: number
  grid_power: number
  soc?: number
}

type Mode = 'day' | 'month' | 'year'

// kriegt eine Zahl, z.B: 5, und macht daraus '05'
function pad2(n: number) {
  return String(n).padStart(2, '0')
}

// Entscheidet, in welchem Modus wir sind (Tag/Monat/Jahr) basierend auf der DateSelection
function modeFromSelection(s: DateSelection): Mode {
  if (s.month === null) return 'year'
  if (s.day === null) return 'month'
  return 'day'
}

/**
 * WICHTIG:
 * helper.ts hat API_BASE = 'http://...:5050/api'
 * => hier dürfen wir NICHT nochmal '/api/...' davor setzen.
 * Also nur '/pv/daily', '/pv/monthly', '/pv/yearly'
 */
function apiParamsFromSelection(s: DateSelection): { path: string; query: Record<string, string> } {
  const mode = modeFromSelection(s)
  const y = s.year

  if (mode === 'day') {
    const m = (s.month ?? 0) + 1
    const d = s.day ?? 1
    const date = `${y}-${pad2(m)}-${pad2(d)}`
    return { path: '/pv/daily', query: { date } }
  }

  if (mode === 'month') {
    const m = (s.month ?? 0) + 1
    const month = `${y}-${pad2(m)}`
    return { path: '/pv/monthly', query: { month } }
  }

  return { path: '/pv/yearly', query: { year: String(y) } }
}

function buildPathWithQuery(path: string, query: Record<string, string>) {
  const params = new URLSearchParams(query)
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

// Macht aus einer rohen Fehlermeldung einen lesbaren Text
function parseErrorMessage(raw: string) {
  const s = (raw || '').trim()
  if (!s) return null

  // Wenn HTML zurückkommt (404-Page etc.), einfach abschneiden
  if (s.startsWith('<!doctype') || s.startsWith('<html')) {
    const short = s.replace(/\s+/g, ' ').slice(0, 120)
    return `${short}…`
  }

  try {
    const j = JSON.parse(s)
    if (typeof j?.detail === 'string') return j.detail
    if (typeof j?.message === 'string') return j.message
  } catch {}

  if (s.length > 140) return s.slice(0, 140) + '…'
  return s
}

function normalizeServiceError(e: unknown): string {
  const msg = String((e as any)?.message ?? e ?? '').trim()
  if (!msg) return 'Unbekannter Fehler.'

  // fetchJson baut: "API <path> failed: <status> <statusText> <text>"
  const marker = ' failed:'
  const i = msg.indexOf(marker)
  if (i === -1) return msg

  const after = msg.slice(i + marker.length).trim()

  // versuch den Body-Teil zu isolieren
  const parts = after.split(' ')
  if (parts.length >= 3) {
    const bodyCandidate = parts.slice(2).join(' ').trim()
    const parsed = parseErrorMessage(bodyCandidate)
    if (parsed) return parsed
  }

  return msg
}

export function diagramRequestKey(selection: DateSelection): string {
  return `${selection.year}-${selection.month ?? 'Y'}-${selection.day ?? 'M'}`
}

export async function fetchDiagramPvPoints(selection: DateSelection): Promise<PvPoint[]> {
  const { path, query } = apiParamsFromSelection(selection)
  const fullPath = buildPathWithQuery(path, query)

  try {
    const json = await fetchJson<unknown>(fullPath)
    return Array.isArray(json) ? (json as PvPoint[]) : []
  } catch (e) {
    throw new Error(normalizeServiceError(e))
  }
}
