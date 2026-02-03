import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import SettingsCard from '@/components/settingscard'
import {
  DeviceStateLogEntry,
  fetchDeviceStateLogs,
} from '../../services/device_state_service'

type RowItem = {
  id: string
  date: string
  time: string
  device: string
  from: string
  to: string
}

function stateKind(v: string): 'on' | 'off' | 'other' {
  const s = v.toLowerCase()
  if (s === 'on' || s === 'true' || s === '1') return 'on'
  if (s === 'off' || s === 'false' || s === '0') return 'off'
  return 'other'
}

function badgeStyle(kind: 'on' | 'off' | 'other') {
  if (kind === 'on') return styles.badgeOn
  if (kind === 'off') return styles.badgeOff
  return styles.badgeOther
}

export default function SDeviceStates() {
  const [data, setData] = useState<DeviceStateLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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
  }, [])

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
      .map((e, idx) => ({
        id: `${e.rawTime}-${idx}`,
        date: e.date,
        time: e.time,
        device: e.device!,
        from: e.from!,
        to: e.to!,
      }))
  }, [data])

  return (
    <SettingsCard title="Gerätezustände">
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
        ) : items.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Keine gültigen Einträge</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {items.map((it, idx) => {
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
                    </View>
                  </View>

                  {idx !== items.length - 1 && (
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
  listBox: {
    marginTop: 10,
    backgroundColor: '#d8d8d8',
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

  separator: {
    height: 4,
    backgroundColor: '#1e90ff',
  },
})
