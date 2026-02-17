// components/settings/s-errorlog.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import SettingsCard from '@/components/settings/settingscard'
import { ErrorLogEntry, fetchErrorLogs } from '@/services/setting_services/logging-state-services/error_service'

type ErrorItem = {
  id: string
  date: string
  time: string
  lines: string[]
}

function softBreak(s: string): string {
  return s.replace(/([,;:{}\[\]\(\)])/g, '$1\u200B')
}

function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function buildDisplayMessage(e: ErrorLogEntry): string {
  const parts = [e.error, e.detail].filter(Boolean) as string[]
  if (parts.length > 0) return parts.join(' | ')
  return e.rawMessage
}

function splitMessageToLines(raw: string): string[] {
  const msg = raw ?? ''
  if (!msg.trim()) return ['(kein Text)']

  const rawParts = msg
    .split(/\r?\n| \| /g)
    .map(x => x.trim())
    .filter(Boolean)

  const lines: string[] = []

  for (const p0 of rawParts) {
    const p = normalizeSpaces(p0)
    if (!p) continue

    if (p.length <= 60) {
      lines.push(softBreak(p))
      continue
    }

    const parts = p
      .split(/(?:\s+at\s+)|(?:\s*;\s*)/g)
      .map(x => normalizeSpaces(x))
      .filter(Boolean)

    if (parts.length <= 1) {
      lines.push(softBreak(p))
    } else {
      for (const part of parts) {
        if (part) lines.push(softBreak(part))
      }
    }
  }

  return lines.length ? lines.slice(0, 8) : ['(kein Text)']
}

export default function SErrorLog() {
  const [data, setData] = useState<ErrorLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const rows = await fetchErrorLogs(50)
        if (!alive) return
        setData(rows)
      } catch (e: any) {
        if (!alive) return
        setError(e?.message ?? 'Fehler')
        setData([])
      } finally {
        if (!alive) return
        setLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  const items = useMemo<ErrorItem[]>(() => {
    return data.map((e, idx) => ({
      id: `${e.rawTime}-${idx}`,
      date: e.date,
      time: e.time.slice(0, 5),
      lines: splitMessageToLines(buildDisplayMessage(e)),
    }))
  }, [data])

  return (
    <SettingsCard title="Error-Log">
      <View style={styles.wrapper}>
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator />
            <Text style={styles.stateText}>Lade Errors…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={[styles.stateText, styles.stateError]}>{error}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Keine Einträge</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {items.map(it => (
              <View key={it.id} style={styles.item}>
                <View style={styles.topRow}>
                  <View style={styles.topLeft}>
                    <MaterialCommunityIcons
                      name="alert-octagon"
                      size={22}
                      color="#d32f2f"
                    />
                    <Text style={styles.headline}>Fehler</Text>
                  </View>

                  <View style={styles.topRight}>
                    <Text style={styles.timeText}>{it.time}</Text>
                    <Text style={styles.dateText}>{it.date}</Text>
                  </View>
                </View>

                <View style={styles.body}>
                  {it.lines.map((line, idx) => (
                    <Text key={`${it.id}-l-${idx}`} style={styles.bodyText}>
                      {line}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SettingsCard>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 10,
  },

  scroll: {
    maxHeight: 260,
  },
  scrollContent: {
    gap: 10,
    paddingBottom: 2,
  },

  stateBox: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    color: '#474646',
    fontSize: 14,
    fontWeight: '800',
  },
  stateError: {
    color: '#9b1c1c',
  },

  item: {
    backgroundColor: '#eeeeee',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },

  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },

  headline: {
    fontSize: 20,
    fontWeight: '900',
    color: '#4a4a4a',
  },

  topRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#474646',
  },
  dateText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: '#474646',
    opacity: 0.9,
  },

  body: {
    marginTop: 10,
    gap: 4,
  },
  bodyText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#2d2d2d',
    lineHeight: 18,
  },
})
