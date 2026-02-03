import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native'
import AppModal from '@/components/modal'

type Props = {
  visible: boolean
  initialIp: string
  onCancel: () => void
  onConfirm: (ip: string) => void
}

function splitIp(ip: string): [string, string, string, string] {
  const p = ip.split('.')
  return [p[0] ?? '', p[1] ?? '', p[2] ?? '', p[3] ?? '']
}

function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, '')
}

function isValidOctet(s: string) {
  if (!s.length) return false
  const n = Number(s)
  return Number.isInteger(n) && n >= 0 && n <= 255
}

type InputRef = React.RefObject<TextInput | null>

export default function SIPModal({ visible, initialIp, onCancel, onConfirm }: Props) {
  const [o1, setO1] = useState('')
  const [o2, setO2] = useState('')
  const [o3, setO3] = useState('')
  const [o4, setO4] = useState('')

  const in1 = useRef<TextInput | null>(null)
  const in2 = useRef<TextInput | null>(null)
  const in3 = useRef<TextInput | null>(null)
  const in4 = useRef<TextInput | null>(null)

  useEffect(() => {
    if (!visible) return
    const [a, b, c, d] = splitIp(initialIp)
    setO1(a)
    setO2(b)
    setO3(c)
    setO4(d)

    setTimeout(() => in1.current?.focus(), 80)
  }, [visible, initialIp])

  const canConfirm = useMemo(() => {
    return isValidOctet(o1) && isValidOctet(o2) && isValidOctet(o3) && isValidOctet(o4)
  }, [o1, o2, o3, o4])

  function confirm() {
    if (!canConfirm) {
      Alert.alert('Ungültige IP-Adresse', 'Bitte gib eine gültige IP-Adresse ein (0–255 pro Block).')
      return
    }
    onConfirm(`${Number(o1)}.${Number(o2)}.${Number(o3)}.${Number(o4)}`)
  }

  function handleChange(setter: (v: string) => void, nextRef?: InputRef) {
    return (t: string) => {
      const v = onlyDigits(t).slice(0, 3)
      setter(v)
      if (v.length === 3) nextRef?.current?.focus()
    }
  }

  function handleBackspace(current: string, prevRef?: InputRef) {
    return (e: any) => {
      if (e?.nativeEvent?.key === 'Backspace' && current.length === 0) {
        prevRef?.current?.focus()
      }
    }
  }

  return (
    <AppModal
      visible={visible}
      title="IP-Adresse"
      onCancel={onCancel}
      onConfirm={confirm}
      confirmDisabled={!canConfirm}
    >
      <View style={styles.ipRow}>
        <TextInput
          ref={in1}
          value={o1}
          onChangeText={handleChange(setO1, in2)}
          onKeyPress={handleBackspace(o1)}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={3}
          style={styles.ipInput}
          selectionColor="#474646"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => in2.current?.focus()}
        />
        <Text style={styles.dot}>.</Text>

        <TextInput
          ref={in2}
          value={o2}
          onChangeText={handleChange(setO2, in3)}
          onKeyPress={handleBackspace(o2, in1)}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={3}
          style={styles.ipInput}
          selectionColor="#474646"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => in3.current?.focus()}
        />
        <Text style={styles.dot}>.</Text>

        <TextInput
          ref={in3}
          value={o3}
          onChangeText={handleChange(setO3, in4)}
          onKeyPress={handleBackspace(o3, in2)}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={3}
          style={styles.ipInput}
          selectionColor="#474646"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => in4.current?.focus()}
        />
        <Text style={styles.dot}>.</Text>

        <TextInput
          ref={in4}
          value={o4}
          onChangeText={handleChange(setO4)}
          onKeyPress={handleBackspace(o4, in3)}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={3}
          style={styles.ipInput}
          selectionColor="#474646"
          returnKeyType="done"
          onSubmitEditing={confirm}
        />
      </View>

    </AppModal>
  )
}

const styles = StyleSheet.create({
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  ipInput: {
    width: 58,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#efefef',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#474646',
  },
  dot: {
    marginHorizontal: 8,
    fontSize: 22,
    fontWeight: '900',
    color: '#474646',
  },
})
