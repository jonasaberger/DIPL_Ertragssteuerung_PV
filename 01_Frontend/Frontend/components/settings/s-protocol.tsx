import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import SettingsCard from '@/components/settings/settingscard'
import {
  ControlDecisionLogEntry,
  fetchControlDecisionLogs,
} from '@/services/setting_services/logging-state-services/control_decision_service'

type ProtocolItem = {
  id: string
  date: string
  time: string
  title: string
  reason?: string
  success?: boolean
  extra?: string
}

function softBreak(s: string): string {
  return s.replace(/([,;:{}\[\]\(\)])/g, '$1\u200B')
}

export default function SProtocol() {
  const [data, setData] = useState<ControlDecisionLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      id: `${e.rawTime}-${idx}`,
      date: e.date,
      time: e.time,
      title: `${e.device ?? 'unknown'} • ${e.action ?? 'unknown'}`,
      reason: e.reason,
      success: e.success,
      extra:
        e.extra && e.extra !== 'None' ? softBreak(String(e.extra)) : undefined,
    }))
  }, [data])

  return (
    <SettingsCard title="Protokollierung">
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
            {items.map((it, idx) => (
              <View key={it.id}>
                <View style={styles.row}>
                  <View style={styles.leftCol}>
                    <Text style={styles.dateText}>{it.date}</Text>
                    <Text style={styles.timeText}>{it.time}</Text>
                  </View>

                  <View style={styles.rightCol}>
                    <Text
                      style={styles.titleText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {it.title}
                    </Text>

                    {it.reason ? (
                      <Text
                        style={styles.metaText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        reason: {it.reason}
                      </Text>
                    ) : null}

                    {typeof it.success === 'boolean' ? (
                      <Text style={styles.metaText}>
                        success: {it.success ? 'true' : 'false'}
                      </Text>
                    ) : null}

                    {it.extra ? (
                      <Text
                        style={styles.extraText}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        extra: {it.extra}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {idx !== items.length - 1 && <View style={styles.separator} />}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SettingsCard>
  )
}

const styles = StyleSheet.create({
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
