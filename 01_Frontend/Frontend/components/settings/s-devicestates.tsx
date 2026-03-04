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
  DeviceStateLogEntry,
  fetchDeviceStateLogs,
} from '@/services/setting_services/logging-state-services/device_state_service'
import {
  SDatePicker,
  fmtDateShort,
  filterByDateRange,
  extractLogTimeMs,
} from '@/components/settings/s-datePicker'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useIsFocused } from '@react-navigation/native'

type RowItem = {
  id: string
  date: string
  time: string
  rawTime?: string
  device: string
  from: string
  to: string
  details: string[]
}

function stateKind(v: string): 'on' | 'off' | 'other' {
  const s = v.toLowerCase().trim()

  if (
    s === 'on' ||
    s === 'an' ||
    s === 'true' ||
    s === '1' ||
    s === 'enabled' ||
    s === 'ein' ||
    s === 'aktiv' ||
    s === 'lädt'
  ) return 'on'

  if (
    s === 'off' ||
    s === 'aus' ||
    s === 'false' ||
    s === '0' ||
    s === 'disabled' ||
    s === 'ausgeschaltet' ||
    s === 'inaktiv' ||
    s === 'pausiert'
  ) return 'off'

  return 'other'
}

function badgeStyle(kind: 'on' | 'off' | 'other') {
  if (kind === 'on') return styles.badgeOn
  if (kind === 'off') return styles.badgeOff
  return styles.badgeOther
}

// harte Trennzeichen mit weichen Umbruchstellen versehen 
function softBreak(s: string): string {
  return s.replace(/([,;:{}\[\]\(\)])/g, '$1\u200B')
}

// Format: "Label: Text" -> Label fett, Rest normal
function splitLabelValue(line: string): { label?: string; value: string } {
  const t = String(line ?? '').trim()
  const idx = t.indexOf(':')
  if (idx <= 0) return { value: t }
  const label = t.slice(0, idx).trim()
  const value = t.slice(idx + 1).trim()
  if (!label) return { value: t }
  return { label, value }
}

export default function SDeviceStates() {
  const [data, setData] = useState<DeviceStateLogEntry[]>([])
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
        const rows = await fetchDeviceStateLogs()
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

  const items = useMemo<RowItem[]>(() => {
    return data
      .filter(
        e =>
          e.device != null &&
          e.from != null &&
          e.to != null &&
          e.date != null &&
          e.time != null
      )
      // In RowItem umwandeln, id aus rawTime und Index generieren, damit auch gleiche Zeiten möglich sind
      .map((e, idx) => ({
        id: `${(e as any).rawTime ?? e.time}-${idx}`,
        date: e.date!,
        time: e.time!,
        rawTime: (e as any).rawTime,
        device: e.device!,
        from: e.from!,
        to: e.to!,
        details: Array.isArray((e as any).details) ? (e as any).details : [],
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
    <SettingsCard title="Gerätezustände">
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
            <Text style={styles.stateText}>Lade Zustände…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={[styles.stateText, styles.stateError]}>{error}</Text>
          </View>
        ) : sortedItems.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>
              {hasFilter ? 'Keine Einträge im Zeitraum' : 'Keine gültigen Einträge'}
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
            {sortedItems.map((it, idx) => {
              const fromKind = stateKind(it.from)
              const toKind = stateKind(it.to)

              return (
                <View key={it.id}>
                  <View style={styles.row}>
                    <View style={styles.leftCol}>
                      <Text style={styles.dateText}>{it.date}</Text>
                      <Text style={styles.timeText}>{it.time}</Text>
                    </View>

                    <View style={styles.rightCol}>
                      <Text
                        style={styles.deviceText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {it.device}
                      </Text>

                      <View style={styles.stateLine}>
                        <View style={[styles.badge, badgeStyle(fromKind)]}>
                          <Text style={styles.badgeText}>{it.from}</Text>
                        </View>

                        <Text style={styles.arrow}>→</Text>

                        <View style={[styles.badge, badgeStyle(toKind)]}>
                          <Text style={styles.badgeText}>{it.to}</Text>
                        </View>
                      </View>

                      {Array.isArray(it.details) && it.details.length > 0 ? (
                        <View style={styles.detailsBox}>
                          {it.details.map((line, i) => {
                            const { label, value } = splitLabelValue(line)
                            return (
                              <Text key={`${it.id}-d-${i}`} style={styles.detailText}>
                                {label ? (
                                  <Text style={styles.detailLabel}>
                                    {softBreak(label)}:{' '}
                                  </Text>
                                ) : null}
                                <Text style={styles.detailValue}>
                                  {softBreak(value)}
                                </Text>
                              </Text>
                            )
                          })}
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {idx !== sortedItems.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </View>
              )
            })}
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
  deviceText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2d2d2d',
  },

  stateLine: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#fff',
  },

  badgeOn: {
    backgroundColor: '#1aa34a',
  },
  badgeOff: {
    backgroundColor: '#c62828',
  },
  badgeOther: {
    backgroundColor: '#6b6b6b',
  },

  arrow: {
    fontSize: 14,
    fontWeight: '900',
    color: '#474646',
  },

  detailsBox: {
    marginTop: 6,
    gap: 2,
  },
  detailText: {
    fontSize: 12.7,
    fontWeight: '800',
    color: '#333',
  },
  detailLabel: {
    fontWeight: '900',
    color: '#2d2d2d',
  },
  detailValue: {
    fontWeight: '800',
    color: '#333',
  },

  separator: {
    height: 4,
    backgroundColor: '#1e90ff',
  },
})