// components/settings/s-errorlog.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import SettingsCard from '@/components/settings/settingscard'
import { ErrorLogEntry, fetchErrorLogs } from '@/services/setting_services/logging-state-services/error_service'
import {
  SDatePicker,
  fmtDateShort,
  filterByDateRange,
  extractLogTimeMs,
} from '@/components/settings/s-datePicker' 

type ErrorItem = {
  id: string
  date: string
  time: string
  rawTime?: string
  lines: string[]
}

// Funktion, um harte Trennzeichen in einem String durch weiche Trennzeichen zu ersetzen
function softBreak(s: string): string {
  return s.replace(/([,;:{}\[\]\(\)])/g, '$1\u200B')
}

// Funktion, um überflüssige Leerzeichen zu entfernen und mehrere Leerzeichen durch ein einzelnes zu ersetzen
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

  // Zeitraum-Filter
  const [fromDate, setFromDate] = useState<Date | null>(null)
  const [toDate, setToDate] = useState<Date | null>(null)
  const [isFromOpen, setIsFromOpen] = useState(false)
  const [isToOpen, setIsToOpen] = useState(false)

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
      id: `${(e as any).rawTime ?? e.time}-${idx}`,
      date: (e as any).date,
      time: String((e as any).time ?? '').slice(0, 5),
      rawTime: (e as any).rawTime,
      lines: splitMessageToLines(buildDisplayMessage(e)),
    }))
  }, [data])

  const filteredItems = useMemo(() => {
    return filterByDateRange(
      items,
      { from: fromDate, to: toDate },
      it =>
        extractLogTimeMs({
          rawTime: it.rawTime,
          time: it.time, 
          date: it.date,
        }),
    )
  }, [items, fromDate, toDate])

  const hasFilter = !!fromDate || !!toDate

  return (
    <SettingsCard title="Error-Log">
      <View style={styles.filterBar}>
        <Pressable
          style={[styles.filterPill, fromDate && styles.filterPillActive]}
          onPress={() => {
            setIsToOpen(false)
            setIsFromOpen(true)
          }}
        >
          <Text style={[styles.filterText, fromDate && styles.filterTextActive]}>
            Von: {fromDate ? fmtDateShort(fromDate) : '—'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.filterPill, toDate && styles.filterPillActive]}
          onPress={() => {
            setIsFromOpen(false)
            setIsToOpen(true)
          }}
        >
          <Text style={[styles.filterText, toDate && styles.filterTextActive]}>
            Bis: {toDate ? fmtDateShort(toDate) : '—'}
          </Text>
        </Pressable>

        {hasFilter && (
          <Pressable
            onPress={() => {
              setFromDate(null)
              setToDate(null)
            }}
            style={styles.clearBtn}
            hitSlop={10}
          >
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        )}
      </View>

      <SDatePicker
        visible={isFromOpen}
        title="Von-Datum auswählen"
        initialDate={fromDate}
        onCancel={() => setIsFromOpen(false)}
        onConfirm={(d) => {
          setFromDate(d)
          setIsFromOpen(false)
        }}
      />

      <SDatePicker
        visible={isToOpen}
        title="Bis-Datum auswählen"
        initialDate={toDate}
        onCancel={() => setIsToOpen(false)}
        onConfirm={(d) => {
          setToDate(d)
          setIsToOpen(false)
        }}
      />

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
        ) : filteredItems.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              {hasFilter ? 'Keine Einträge im Zeitraum' : 'Keine Einträge'}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {filteredItems.map(it => (
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
  filterBar: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    backgroundColor: '#F1F1F1',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  filterPillActive: {
    backgroundColor: '#1EAFF3',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },

  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#ffe8e8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffbcbc',
  },
  clearText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#b91c1c',
    marginTop: -1,
  },

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