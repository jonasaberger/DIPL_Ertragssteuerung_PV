import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native'
import AppModal from '@/components/modal'

type ServiceConfig = {
  ip: string
  port: string
  path: string
}

type Props = {
  visible: boolean
  service: 'backend' | 'epex' | 'pv' | 'wallbox'
  config: ServiceConfig
  onCancel: () => void
  onConfirm: (config: ServiceConfig) => void
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

function isValidPort(s: string) {
  if (!s.length) return false
  const n = Number(s)
  return Number.isInteger(n) && n > 0 && n <= 65535
}

function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length === 0) return false
  // Erlaubt Domains und IPs
  return true
}

type InputRef = React.RefObject<TextInput | null>

const SERVICE_TITLES: Record<string, string> = {
  backend: 'Backend API',
  epex: 'EPEX Spot',
  pv: 'PV Anlage',
  wallbox: 'Wallbox'
}

export default function SIPModal({ visible, service, config, onCancel, onConfirm }: Props) {
  const isEpex = service === 'epex'

  // IP State (für IP-basierte Services)
  const [o1, setO1] = useState('')
  const [o2, setO2] = useState('')
  const [o3, setO3] = useState('')
  const [o4, setO4] = useState('')
  
  // Hostname State (für EPEX)
  const [hostname, setHostname] = useState('')
  
  const [port, setPort] = useState('')
  const [path, setPath] = useState('')

  // Refs
  const r1 = useRef<TextInput>(null)
  const r2 = useRef<TextInput>(null)
  const r3 = useRef<TextInput>(null)
  const r4 = useRef<TextInput>(null)
  const rHostname = useRef<TextInput>(null)
  const rPort = useRef<TextInput>(null)
  const rPath = useRef<TextInput>(null)

  // Initialize from props
  useEffect(() => {
    if (!visible) return

    if (isEpex) {
      setHostname(config.ip)
    } else {
      const [a, b, c, d] = splitIp(config.ip)
      setO1(a)
      setO2(b)
      setO3(c)
      setO4(d)
    }
    
    setPort(config.port)
    setPath(config.path)

    setTimeout(() => {
      if (isEpex) {
        rHostname.current?.focus()
      } else {
        r1.current?.focus()
      }
    }, 80)
  }, [visible, config, isEpex])

  // Validation
  const canConfirm = useMemo(() => {
    const hostValid = isEpex
      ? isValidHostname(hostname)
      : (isValidOctet(o1) && isValidOctet(o2) && isValidOctet(o3) && isValidOctet(o4))
    
    return hostValid && isValidPort(port) && path.length > 0
  }, [isEpex, hostname, o1, o2, o3, o4, port, path])

  function confirm() {
    if (!canConfirm) {
      Alert.alert('Ungültige Eingaben', 'Bitte überprüfe alle Felder.')
      return
    }

    const finalIp = isEpex 
      ? hostname 
      : `${Number(o1)}.${Number(o2)}.${Number(o3)}.${Number(o4)}`

    onConfirm({
      ip: finalIp,
      port: port,
      path: path
    })
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
      title={SERVICE_TITLES[service] || 'Service Konfiguration'}
      onCancel={onCancel}
      onConfirm={confirm}
      confirmDisabled={!canConfirm}
    >
      <View style={styles.container}>
        {/* Host Input */}
        <Text style={styles.sectionLabel}>
          {isEpex ? 'Hostname/Domain' : 'IP-Adresse'}
        </Text>
        
        {isEpex ? (
          // Hostname Input für EPEX
          <TextInput
            ref={rHostname}
            value={hostname}
            onChangeText={setHostname}
            style={styles.hostnameInput}
            placeholder="z.B. apis.smartenergy.at"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            selectionColor="#474646"
            returnKeyType="next"
            onSubmitEditing={() => rPort.current?.focus()}
          />
        ) : (
          // IP Input für andere Services
          <View style={styles.ipRow}>
            <TextInput
              ref={r1}
              value={o1}
              onChangeText={handleChange(setO1, r2)}
              onKeyPress={handleBackspace(o1)}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.ipInput}
              selectionColor="#474646"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => r2.current?.focus()}
            />
            <Text style={styles.dot}>.</Text>

            <TextInput
              ref={r2}
              value={o2}
              onChangeText={handleChange(setO2, r3)}
              onKeyPress={handleBackspace(o2, r1)}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.ipInput}
              selectionColor="#474646"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => r3.current?.focus()}
            />
            <Text style={styles.dot}>.</Text>

            <TextInput
              ref={r3}
              value={o3}
              onChangeText={handleChange(setO3, r4)}
              onKeyPress={handleBackspace(o3, r2)}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.ipInput}
              selectionColor="#474646"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => r4.current?.focus()}
            />
            <Text style={styles.dot}>.</Text>

            <TextInput
              ref={r4}
              value={o4}
              onChangeText={handleChange(setO4, rPort)}
              onKeyPress={handleBackspace(o4, r3)}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.ipInput}
              selectionColor="#474646"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => rPort.current?.focus()}
            />
          </View>
        )}

        {/* Port & Path */}
        <View style={styles.extraRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Port</Text>
            <TextInput
              ref={rPort}
              value={port}
              onChangeText={(t) => setPort(onlyDigits(t).slice(0, 5))}
              keyboardType="number-pad"
              maxLength={5}
              style={styles.portInput}
              selectionColor="#474646"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => rPath.current?.focus()}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 2 }]}>
            <Text style={styles.label}>Pfad</Text>
            <TextInput
              ref={rPath}
              value={path}
              onChangeText={setPath}
              style={styles.pathInput}
              selectionColor="#474646"
              returnKeyType="done"
              onSubmitEditing={confirm}
            />
          </View>
        </View>
      </View>
    </AppModal>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8
  },
  hostnameInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#efefef',
    fontSize: 16,
    fontWeight: '600',
    color: '#474646',
    paddingHorizontal: 12,
    marginBottom: 16,
    textAlign: 'center'
  },
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  ipInput: {
    width: 58,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#efefef',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#474646'
  },
  dot: {
    marginHorizontal: 8,
    fontSize: 22,
    fontWeight: '900',
    color: '#474646'
  },
  extraRow: {
    flexDirection: 'row',
    gap: 12
  },
  inputGroup: {
    flex: 1
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6
  },
  portInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#efefef',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#474646',
    paddingHorizontal: 12
  },
  pathInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#efefef',
    fontSize: 16,
    fontWeight: '600',
    color: '#474646',
    paddingHorizontal: 12
  }
})