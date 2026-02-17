// services/state_service.ts
import { fetchJson } from '@/services/helper'

export type SystemState = {
  backend: 'ok' | 'timeout' | 'error'
  boiler: 'ok' | 'timeout' | 'error'
  influx: 'ok' | 'timeout' | 'error'
  wallbox: 'ok' | 'timeout' | 'error'
  epex: 'ok' | 'timeout' | 'error'
  timestamp: string
}

export function fetchSystemState(): Promise<SystemState> {
  return fetchJson<SystemState>('/state')
}
