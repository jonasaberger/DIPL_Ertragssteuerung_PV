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

type ProtocolItem = {
  id: string
  date: string
  time: string
  rawTime?: string
  title: string
  reason?: string
  success?: boolean
  extra?: string
}

// Funktion, um harte Trennzeichen in einem String durch weiche Trennzeichen zu ersetzen
function softBreak(s: string): string {
  return s.replace(/([,;:{}\[\]\(\)])/g, '$1\u200B')
}

export default function SProtocol() {
  const [data, setData] = useState<ControlDecisionLogEntry[]>([])
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
  }, [])

  const items = useMemo<ProtocolItem[]>(() => {
    return data.map((e, idx) => ({
      id: `${(e as any).rawTime ?? (e as any).time ?? 'x'}-${idx}`,
      date: (e as any).date,
      time: (e as any).time,
      rawTime: (e as any).rawTime,
      title: `${(e as any).device ?? 'unknown'} • ${(e as any).action ?? 'unknown'}`,
      reason: (e as any).reason,
      success: (e as any).success,
      extra:
        (e as any).extra && (e as any).extra !== 'None'
          ? softBreak(String((e as any).extra))
          : undefined,
    }))
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
            {filteredItems.map((it, idx) => (
              <View key={it.id}>
                <View style={styles.row}>
                  <View style={styles.leftCol}>
                    <Text style={styles.dateText}>{it.date}</Text>
                    <Text style={styles.timeText}>{it.time}</Text>
                  </View>

                  <View style={styles.rightCol}>
                    <Text style={styles.titleText}>{it.title}</Text>

                    {it.reason ? (
                      <Text style={styles.metaText}>reason: {it.reason}</Text>
                    ) : null}

                    {typeof it.success === 'boolean' ? (
                      <Text style={styles.metaText}>
                        success: {it.success ? 'true' : 'false'}
                      </Text>
                    ) : null}

                    {it.extra ? (
                      <Text style={styles.extraText}>extra: {it.extra}</Text>
                    ) : null}
                  </View>
                </View>

                {idx !== filteredItems.length - 1 && <View style={styles.separator} />}
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
  titleText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2d2d2d',
  },
  metaText: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#474646',
  },
  extraText: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#333',
  },

  separator: {
    height: 4,
    backgroundColor: '#1e90ff',
  },
})