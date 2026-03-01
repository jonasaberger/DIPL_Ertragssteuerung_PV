import React, { useEffect, useMemo, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  Platform,
} from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'

// ISO mit Offset kann Date() parsen (z.B. 2026-03-01T11:45:33+01:00)
export function parseIsoMs(iso: string): number | null {
  const d = new Date(String(iso ?? ''))
  const t = d.getTime()
  return Number.isFinite(t) ? t : null
}

export function startOfDayMs(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

export function endOfDayMs(d: Date): number {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x.getTime()
}

export function fmtDateShort(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  return `${dd}.${mm}.${yy}`
}

export function extractLogTimeMs(input: {
  rawTime?: string | null
  time?: string | null
  date?: string | null
}): number | null {
  const raw = String(input.rawTime ?? '').trim()
  if (raw && raw.includes('T')) {
    const t = parseIsoMs(raw)
    if (t !== null) return t
  }

  const time = String(input.time ?? '').trim()
  if (time && time.includes('T')) {
    const t = parseIsoMs(time)
    if (t !== null) return t
  }

  const date = String(input.date ?? '').trim()
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && time) {
    const m = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
    if (m) {
      const hh = m[1]
      const mm = m[2]
      const ss = m[3] ?? '00'
      const d = new Date(`${date}T${hh}:${mm}:${ss}`)
      const t = d.getTime()
      return Number.isFinite(t) ? t : null
    }
  }

  return null
}

// Filtert Items nach Zeitraum (inklusive).
export function filterByDateRange<T>(
  items: T[],
  range: { from: Date | null; to: Date | null },
  getTimeMs: (item: T) => number | null,
) {
  const { from, to } = range
  if (!from && !to) return items

  const fromT = from ? startOfDayMs(from) : -Infinity
  const toT = to ? endOfDayMs(to) : Infinity

  const minT = Math.min(fromT, toT)
  const maxT = Math.max(fromT, toT)

  return items.filter((it) => {
    const t = getTimeMs(it)
    if (t === null) return false
    return t >= minT && t <= maxT
  })
}


type Props = {
  visible: boolean
  title: string
  initialDate?: Date | null
  onCancel: () => void
  onConfirm: (date: Date) => void
}

export const SDatePicker: React.FC<Props> = ({
  visible,
  title,
  initialDate = null,
  onCancel,
  onConfirm,
}) => {
  const initial = useMemo(() => initialDate ?? new Date(), [initialDate])

  // iOS braucht einen temp state für "Bestätigen"
  const [tempDate, setTempDate] = useState<Date>(initial)

  useEffect(() => {
    if (!visible) return
    setTempDate(initial)
  }, [initial, visible])

  // ANDROID: direkt DateTimePicker rendern --> nativer Dialog erscheint
  if (Platform.OS === 'android') {
    if (!visible) return null

    return (
      <DateTimePicker
        value={initial}
        mode="date"
        display="default"
        onChange={(e: DateTimePickerEvent, d?: Date) => {
          // Android liefert event.type: 'set' | 'dismissed'
          if (e?.type === 'dismissed') {
            onCancel()
            return
          }
          if (d) {
            onConfirm(d) 
          } else {
            onCancel()
          }
        }}
      />
    )
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.modalWrapper}>
        <View style={styles.modalBox}>
          <View style={styles.blueBorder}>
            <View style={styles.innerBox}>
              <Text style={styles.modalTitle}>{title}</Text>

              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(_, d) => {
                  if (!d) return
                  setTempDate(d)
                }}
              />
            </View>

            <View style={styles.footerDivider} />
            <View style={styles.footerRow}>
              <Pressable onPress={onCancel} style={styles.footerButton}>
                <Text style={styles.footerCancel}>Abbrechen</Text>
              </Pressable>

              <View style={styles.footerButtonDivider} />

              <Pressable onPress={() => onConfirm(tempDate)} style={styles.footerButton}>
                <Text style={styles.footerConfirm}>Bestätigen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalBox: {
    width: '100%',
  },
  blueBorder: {
    borderWidth: 3,
    borderColor: '#1EAFF3',
    borderRadius: 16,
    backgroundColor: '#E6F5FF',
    overflow: 'hidden',
  },
  innerBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 0,
    padding: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#474646',
    marginBottom: 12,
  },

  footerDivider: {
    height: 1,
    backgroundColor: '#c0dff0',
  },
  footerRow: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: '#E6F5FF',
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonDivider: {
    width: 1,
    backgroundColor: '#c0dff0',
    marginVertical: 10,
  },
  footerCancel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#474646',
  },
  footerConfirm: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1EAFF3',
  },
})