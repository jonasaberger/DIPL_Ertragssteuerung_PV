import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import AppModal from '@/components/modal'
import type { ServiceConfig } from '@/components/settings/s-device-configs'

type Props = {
  visible: boolean
  service: 'backend' | 'epex' | 'pv' | 'wallbox'
  config: ServiceConfig
  onCancel: () => void
  onConfirm: (config: ServiceConfig) => void
}

type IpOctets = { first: string; second: string; third: string; fourth: string }

// --- Hilfsfunktionen ---

// IP-Adresse in vier Oktetten aufteilen
function splitIpIntoOctets(ip: string): IpOctets {
  const parts = ip.split('.')
  return {
    first:  parts[0] ?? '',
    second: parts[1] ?? '',
    third:  parts[2] ?? '',
    fourth: parts[3] ?? '',
  }
}

// Vier Oktetten wieder zu einer IP-Adresse zusammensetzen
function joinOctetsToIp({ first, second, third, fourth }: IpOctets): string {
  return `${Number(first)}.${Number(second)}.${Number(third)}.${Number(fourth)}`
}

// Nur Ziffern erlauben
function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, '')
}

// Validierung von IP-Oktetten
function isValidOctet(value: string): boolean {
  if (!value.length) return false
  const num = Number(value)
  return Number.isInteger(num) && num >= 0 && num <= 255
}

// Validierung von Portnummern
function isValidPort(value: string): boolean {
  if (!value.length) return false
  const num = Number(value)
  return Number.isInteger(num) && num > 0 && num <= 65535
}

// Validierung von Hostnamen (sehr einfach, nur auf Nicht-Leerzeichen prüfen)
function isValidHostname(hostname: string): boolean {
  return !!hostname && hostname.length > 0 // !! bewirkt, dass auch reine Leerzeichen als ungültig erkannt werden
}

const SERVICE_TITLES: Record<string, string> = {
  backend: 'Backend API',
  epex:    'EPEX Spot',
  pv:      'PV Anlage',
  wallbox: 'Wallbox',
}

export default function SIPModal({ visible, service, config, onCancel, onConfirm }: Props) {
  const isEpex = service === 'epex'

  // IP-Oktetten (nur für Backend, PV und Wallbox, nicht für EPEX)
  const [ipOctets, setIpOctets] = useState<IpOctets>({ first: '', second: '', third: '', fourth: '' })

  // Hostname (nur für EPEX)
  const [hostname, setHostname] = useState('')

  // Portnummer und Endpoints (für alle Services)
  const [port, setPort] = useState('')
  const [endpointPaths, setEndpointPaths] = useState<Record<string, string>>({})

  // Refs für die TextInput-Felder, um Fokus zu steuern
  const ipFirstRef  = useRef<TextInput>(null)
  const ipSecondRef = useRef<TextInput>(null)
  const ipThirdRef  = useRef<TextInput>(null)
  const ipFourthRef = useRef<TextInput>(null)
  const hostnameRef = useRef<TextInput>(null)
  const portRef     = useRef<TextInput>(null)

  // Dynamische Refs für Endpoint-Pfleger, da Anzahl und Keys variieren können
  const endpointPathRefs = useRef<Record<string, React.RefObject<TextInput | null>>>({})

  function getEndpointPathRef(key: string): React.RefObject<TextInput | null> {
    if (!endpointPathRefs.current[key]) {
      endpointPathRefs.current[key] = React.createRef<TextInput>()
    }
    return endpointPathRefs.current[key]
  }

  // Beim Öffnen Modal mit aktuellen Werten befüllen und Fokus setzen
  useEffect(() => {
    if (!visible) return

    if (isEpex) {
      setHostname(config.ip)
    } else {
      setIpOctets(splitIpIntoOctets(config.ip))
    }

    setPort(config.port)
    setEndpointPaths(config.paths ? { ...config.paths } : { default: '' })
    endpointPathRefs.current = {}

    setTimeout(() => {
      if (isEpex) hostnameRef.current?.focus()
      else ipFirstRef.current?.focus()
    }, 80)
  }, [visible, config, isEpex])

  const endpointKeys = Object.keys(endpointPaths)

  // Validierung, ob alle Eingaben korrekt sind und der "Bestätigen"-Button aktiviert werden kann
  const canConfirm = useMemo(() => {
    const hostIsValid = isEpex
      ? isValidHostname(hostname)
      : Object.values(ipOctets).every(isValidOctet)

    const allPathsFilled = endpointKeys.length > 0
      && endpointKeys.every(key => endpointPaths[key].length > 0)

    return hostIsValid && isValidPort(port) && allPathsFilled
  }, [isEpex, hostname, ipOctets, port, endpointPaths, endpointKeys])

  // --- Event-Handler ---
  function handleConfirm() {
    if (!canConfirm) {
      Alert.alert('Ungültige Eingaben', 'Bitte überprüfe alle Felder.')
      return
    }
    const finalIp = isEpex ? hostname : joinOctetsToIp(ipOctets)
    onConfirm({ ip: finalIp, port, paths: endpointPaths })
  }

  function handleOctetChange(
    field: keyof IpOctets,
    value: string,
    nextRef?: React.RefObject<TextInput | null>
  ) {
    const cleaned = digitsOnly(value).slice(0, 3)
    setIpOctets(prev => ({ ...prev, [field]: cleaned }))
    if (cleaned.length === 3) nextRef?.current?.focus()
  }

  function handleOctetBackspace(
    currentValue: string,
    previousRef?: React.RefObject<TextInput | null>
  ) {
    return (event: any) => {
      if (event?.nativeEvent?.key === 'Backspace' && currentValue.length === 0) {
        previousRef?.current?.focus()
      }
    }
  }

  // Handler für Änderungen bei Endpoint-Pfaden
  function handleEndpointPathChange(key: string, value: string) {
    setEndpointPaths(prev => ({ ...prev, [key]: value }))
  }

  // Fokus auf nächsten Endpoint oder Bestätigen => wenn es der letzte ist
  function focusNextEndpointOrConfirm(currentIndex: number) {
    const nextKey = endpointKeys[currentIndex + 1]
    if (nextKey) {
      getEndpointPathRef(nextKey).current?.focus()
    } else {
      handleConfirm()
    }
  }

  return (
    <AppModal
      visible={visible}
      title={SERVICE_TITLES[service] || 'Service Konfiguration'} // Fallback-Titel
      onCancel={onCancel}
      onConfirm={handleConfirm}
      confirmDisabled={!canConfirm} // Bestätigen-Button nur aktiv => wenn alle Eingaben gültig sind
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hostname (EPEX) oder IP-Adresse (PV...) */}
        <Text style={styles.sectionLabel}>
          {isEpex ? 'Hostname/Domain' : 'IP-Adresse'}
        </Text>

        {isEpex ? (
          <TextInput
            ref={hostnameRef}
            value={hostname}
            onChangeText={setHostname}
            style={styles.hostnameInput}
            placeholder="z.B. apis.smartenergy.at"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            selectionColor="#474646"
            returnKeyType="next"
            onSubmitEditing={() => portRef.current?.focus()}
          />
        ) : (
          <View style={styles.ipRow}>
            <TextInput
              ref={ipFirstRef}
              value={ipOctets.first}
              onChangeText={(v) => handleOctetChange('first', v, ipSecondRef)}
              onKeyPress={handleOctetBackspace(ipOctets.first)}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.ipOctetInput}
              selectionColor="#474646"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => ipSecondRef.current?.focus()}
            />
            <Text style={styles.ipDot}>.</Text>
            <TextInput
              ref={ipSecondRef}
              value={ipOctets.second}
              onChangeText={(v) => handleOctetChange('second', v, ipThirdRef)}
              onKeyPress={handleOctetBackspace(ipOctets.second, ipFirstRef)}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.ipOctetInput}
              selectionColor="#474646"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => ipThirdRef.current?.focus()}
            />
            <Text style={styles.ipDot}>.</Text>
            <TextInput
              ref={ipThirdRef}
              value={ipOctets.third}
              onChangeText={(v) => handleOctetChange('third', v, ipFourthRef)}
              onKeyPress={handleOctetBackspace(ipOctets.third, ipSecondRef)}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.ipOctetInput}
              selectionColor="#474646"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => ipFourthRef.current?.focus()}
            />
            <Text style={styles.ipDot}>.</Text>
            <TextInput
              ref={ipFourthRef}
              value={ipOctets.fourth}
              onChangeText={(v) => handleOctetChange('fourth', v, portRef)}
              onKeyPress={handleOctetBackspace(ipOctets.fourth, ipThirdRef)}
              keyboardType="number-pad"
              maxLength={3}
              style={styles.ipOctetInput}
              selectionColor="#474646"
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => portRef.current?.focus()}
            />
          </View>
        )}

        {/* Port Sektion */}
        <View style={styles.portRow}>
          <Text style={styles.fieldLabel}>Port</Text>
          <TextInput
            ref={portRef}
            value={port}
            onChangeText={(value) => setPort(digitsOnly(value).slice(0, 5))}
            keyboardType="number-pad"
            maxLength={5}
            style={styles.portInput}
            selectionColor="#474646"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              const firstKey = endpointKeys[0]
              if (firstKey) getEndpointPathRef(firstKey).current?.focus()
            }}
          />
        </View>

        {/* Verschiedene Endpunkte oder Pfade */}
        <View style={styles.endpointsSection}>
          <Text style={styles.sectionLabel}>
            {endpointKeys.length > 1 ? 'Endpunkte' : 'Pfad'}
          </Text>

          {endpointKeys.map((key, index) => (
            <View key={key} style={styles.endpointRow}>
              {endpointKeys.length > 1 && (
                <View style={styles.endpointKeyBadge}>
                  <Text style={styles.endpointKeyText} numberOfLines={1}>{key}</Text>
                </View>
              )}
              <TextInput
                ref={getEndpointPathRef(key)}
                value={endpointPaths[key]}
                onChangeText={(value) => handleEndpointPathChange(key, value)}
                style={[styles.endpointPathInput, endpointKeys.length > 1 && styles.endpointPathInputWithBadge]}
                placeholder={`/${key}`}
                autoCapitalize="none"
                autoCorrect={false}
                selectionColor="#474646"
                returnKeyType={index < endpointKeys.length - 1 ? 'next' : 'done'}
                blurOnSubmit={false}
                onSubmitEditing={() => focusNextEndpointOrConfirm(index)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </AppModal>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  container: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
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
    textAlign: 'center',
  },
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ipOctetInput: {
    width: 58,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#efefef',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#474646',
  },
  ipDot: {
    marginHorizontal: 8,
    fontSize: 22,
    fontWeight: '900',
    color: '#474646',
  },
  portRow: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  portInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#efefef',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#474646',
    paddingHorizontal: 12,
  },
  endpointsSection: {
    gap: 8,
  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  endpointKeyBadge: {
    backgroundColor: '#474646',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    maxWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  endpointKeyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  endpointPathInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#efefef',
    fontSize: 15,
    fontWeight: '600',
    color: '#474646',
    paddingHorizontal: 12,
  },
  endpointPathInputWithBadge: {
    fontSize: 14,
  },
})