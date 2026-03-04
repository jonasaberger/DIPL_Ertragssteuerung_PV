import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native'
import SettingsCard from '@/components/settings/settingscard'
import {
  ControlDecisionLogEntry,
  fetchControlDecisionLogs,
} from '@/services/setting_services/logging-state-services/control_decision_service'
import {
  SDatePicker,
  fmtDateShort,
  filterByDateRange,
  extractLogTimeMs,
} from '@/components/settings/s-datePicker'
import { MaterialCommunityIcons } from '@expo/vector-icons' 
import { useIsFocused } from '@react-navigation/native'

type ProtocolItem = {
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

// Entfernt überflüssige Leerzeichen, Tabs und Zeilenumbrüche
function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function messageToLines(message: string): string[] {
  const cleaned = normalizeSpaces(message)

  // Erst bei "|" splitten, dann jede Sektion zusätzlich bei "/" splitten
  const parts = cleaned
    .split('|')
    .map(p => p.trim())
    .filter(Boolean)
    .flatMap(p => p.split('/').map(x => x.trim()).filter(Boolean))

  if (parts.length === 0) return [cleaned]

  // Zusätzlich auch für "|" und "/" und ":" 
  return parts.map(line =>
    softBreak(line).replace(/([|/:\-])/g, '$1\u200B'),
  )
}

export default function SProtocol() {
  const [data, setData] = useState<ControlDecisionLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isFocused = useIsFocused()

  // Zeitraum-Filter
  const [fromDate, setFromDate] = useState<Date | null>(null)
  const [toDate, setToDate] = useState<Date | null>(null)
  const [isFromOpen, setIsFromOpen] = useState(false)
  const [isToOpen, setIsToOpen] = useState(false)

  // Sortierung: absteigend = neueste oben (Default)
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    if (!isFocused) return

    let alive = true

    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const rows = await fetchControlDecisionLogs()
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
  }, [isFocused])

  const items = useMemo<ProtocolItem[]>(() => {
    return data.map((e, idx) => {
      const anyE: any = e as any

      const msg: string = String(anyE.message ?? anyE.rawMessage ?? '')

      return {
        id: `${anyE.rawTime ?? anyE.time ?? 'x'}-${idx}`,
        date: anyE.date,
        time: anyE.time,
        rawTime: anyE.rawTime,
        lines: messageToLines(msg),
      }
    })
  }, [data])

  const filteredItems = useMemo(() => {
    return filterByDateRange(
      items,
      { from: fromDate, to: toDate },
      (it) =>
        extractLogTimeMs({
          rawTime: it.rawTime,
          time: it.time,
          date: it.date,
        }),
    )
  }, [items, fromDate, toDate])

  const sortedItems = useMemo(() => {
    // Sortieren immer über den echten Zeitstempel (ms)
    const arr = [...filteredItems]
    arr.sort((a, b) => {
      const aMsRaw = extractLogTimeMs({ rawTime: a.rawTime, time: a.time, date: a.date })
      const bMsRaw = extractLogTimeMs({ rawTime: b.rawTime, time: b.time, date: b.date })

      const aMs = typeof aMsRaw === 'number' && Number.isFinite(aMsRaw) ? aMsRaw : 0
      const bMs = typeof bMsRaw === 'number' && Number.isFinite(bMsRaw) ? bMsRaw : 0

      return sortDir === 'desc' ? bMs - aMs : aMs - bMs
    })
    return arr
  }, [filteredItems, sortDir])

  const hasFilter = !!fromDate || !!toDate

  return (
    <SettingsCard title="Protokollierung">
      <View style={styles.filterBar}>
        <Pressable
          style={[styles.filterPill, fromDate && styles.filterPillActive]}
          onPress={() => {
            // niemals beide offen haben
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

      <View style={styles.sortRow}>
        <Pressable
          style={styles.sortBtn}
          onPress={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name={sortDir === 'desc' ? 'sort-descending' : 'sort-ascending'}
            size={18}
            color="#474646"
          />
          <Text style={styles.sortText}>
            {sortDir === 'desc' ? 'Neueste zuerst' : 'Älteste zuerst'}
          </Text>
        </Pressable>
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

      <View style={styles.listBox}>
        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator />
            <Text style={styles.stateText}>Lade Protokoll…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={[styles.stateText, styles.stateError]}>{error}</Text>
          </View>
        ) : sortedItems.length === 0 ? (
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
            {sortedItems.map((it, idx) => (
              <View key={it.id}>
                <View style={styles.row}>
                  <View style={styles.leftCol}>
                    <Text style={styles.dateText}>{it.date}</Text>
                    <Text style={styles.timeText}>{it.time}</Text>
                  </View>

                  <View style={styles.rightCol}>
                    {it.lines.map((line, i) => (
                      <Text
                        key={`${it.id}-line-${i}`}
                        style={i === 0 ? styles.firstLineText : styles.lineText}
                      >
                        {line}
                      </Text>
                    ))}
                  </View>
                </View>

                {idx !== sortedItems.length - 1 && <View style={styles.separator} />}
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

  sortRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F1F1',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#666',
  },

  listBox: {
    marginTop: 10,
    backgroundColor: '#eeeeee',
    borderRadius: 14,
    overflow: 'hidden',
  },

  scroll: {
    maxHeight: 260,
  },
  scrollContent: {
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

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },

  leftCol: {
    width: 108,
    flexShrink: 0,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#474646',
  },
  timeText: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '800',
    color: '#474646',
    opacity: 0.9,
  },

  rightCol: {
    flex: 1,
    minWidth: 0,
  },

  firstLineText: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#2d2d2d',
  },

  lineText: {
    marginTop: 2,
    fontSize: 12.8,
    fontWeight: '800',
    color: '#333',
  },

  separator: {
    height: 4,
    backgroundColor: '#1e90ff',
  },
})