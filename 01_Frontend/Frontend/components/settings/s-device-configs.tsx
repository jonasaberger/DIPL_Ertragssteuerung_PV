import * as Updates from 'expo-updates'
import React, { useState, useEffect } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import SettingsCard from '@/components/settings/settingscard'
import SIPModal from '@/components/settings/s-ipmodal'
import { useAuth } from '@/contexts/s-authcontext'
import {
  getBackendConfig,
  setBackendConfigLocal,
  resetBackendConfigLocal,
} from '@/services/setting_services/device-backend_configs/backend_config_service'
import {
  fetchDevices,
  updateDeviceConfig,
  resetDevices,
  buildDeviceUrl,
  parseDeviceUrl,
  DevicesResponse
} from '@/services/setting_services/device-backend_configs/settings_service'
import { resetAPIBase } from '@/services/helper'



export type ServiceConfig = {
  ip: string
  port: string
  paths: Record<string, string>
}

export default function SDeviceConfigs() {
  const { password } = useAuth() // Passwort wird vom Context bereitgestellt
  const [openModal, setOpenModal] = useState<'backend' | 'epex' | 'pv' | 'wallbox' | null>(null)
  const [loading, setLoading] = useState(false)
  const [backendConfig, setBackendConfig] = useState({ backend_ip: '', backend_port: 0, backend_path: '' })
  const [devices, setDevices] = useState<DevicesResponse>({})

  // Initiales Laden der Konfigurationen
  useEffect(() => { loadConfigs() }, [])

  const loadConfigs = async () => {
    try {
      // Lade Backend-Konfiguration (IP-Adresse / Port des Backends)
      setLoading(true)
      const backend = await getBackendConfig()
      setBackendConfig(backend)
      try {
        // Laden der Geräte-Konfigurationen (EPEX, PV, Wallbox - IPs, Ports, Pfade) 
        const devicesData = await fetchDevices()
        setDevices(devicesData ?? {})
      } catch (deviceError) {
        console.warn('Could not fetch devices:', deviceError)
        setDevices({})
      }
    } catch (error) {
      console.error('Error loading backend config:', error)
      Alert.alert('Fehler', 'Backend-Konfiguration konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  const handleBackendConfirm = async (config: ServiceConfig) => {
    try {
      setLoading(true)
      const path = Object.values(config.paths)[0] ?? '' // Für Backend gibt es immer nur einen zentralen Pfad
      await setBackendConfigLocal(config.ip, Number(config.port), path)
      resetAPIBase()
      setOpenModal(null)
      setLoading(false)
      Alert.alert(
        'Erfolg',
        'Backend-Konfiguration wurde gespeichert.\n\nDie App muss neu geladen werden, um die Änderungen zu übernehmen.',
        [{
          text: 'Jetzt neu starten',
          onPress: async () => {
            try {
              await Updates.reloadAsync()
            } catch (error) {
              Alert.alert('Manueller Neustart nötig', 'In der Entwicklungsumgebung muss die App manuell neu geladen werden.')
            }
          }
        }],
        { cancelable: false }
      )
    } catch (error) {
      console.error('Error updating backend:', error)
      setLoading(false)
      Alert.alert('Fehler', 'Backend-Konfiguration konnte nicht gespeichert werden')
    }
  }

  const handleDeviceConfirm = async (deviceId: string, config: ServiceConfig) => {
    if (!password) {
      Alert.alert('Fehler', 'Nicht autorisiert')
      return
    }
    setOpenModal(null)
    try {
      setLoading(true)
      const baseUrl = buildDeviceUrl(config.ip, config.port, deviceId === 'epex')
      await updateDeviceConfig(deviceId, password, baseUrl, config.paths)
      await loadConfigs()
      Alert.alert('Erfolg', `${deviceId.toUpperCase()} Konfiguration gespeichert`)
    } catch (error: any) {
      console.error('Error updating device:', error)
      if (error.message === 'Falsches Passwort') {
        Alert.alert('Fehler', 'Falsches Passwort')
      } else {
        Alert.alert('Fehler', 'Gerät konnte nicht aktualisiert werden')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    Alert.alert(
      'Alles zurücksetzen?',
      'Die Backend-Konfiguration wird auf die Standardwerte zurückgesetzt und alle Geräte werden zurückgesetzt.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true)
              await resetBackendConfigLocal()
              const resetResult = await resetDevices()
              if (!resetResult) throw new Error('API Reset fehlgeschlagen')
              resetAPIBase()
              await loadConfigs()
              Alert.alert('Erfolg', 'Alle Konfigurationen wurden zurückgesetzt.')
            } catch (error) {
              console.error('Error resetting configs:', error)
              Alert.alert('Fehler', 'Reset konnte nicht durchgeführt werden')
            } finally {
              setLoading(false)
            }
          }
        }
      ]
    )
  }

  const getDeviceConfig = (deviceId: string): ServiceConfig => {
    const device = devices[deviceId]
    if (!device) return { ip: '', port: '', paths: { default: '' } }
    const parsed = parseDeviceUrl({ deviceId, ...device })
    if (!parsed) return { ip: '', port: '', paths: { default: '' } }

    const endpoints = device.endpoints || {}

    // Wenn es keine benannten Endpunkte gibt, aber ein Pfad vorhanden ist -  diesen als "default" zurückgeben
    const paths: Record<string, string> = Object.keys(endpoints).length > 0
      ? { ...endpoints }
      : { default: parsed.path ?? '' }

    return { ip: parsed.ip, port: parsed.port, paths }
  }

  const renderServiceItem = (
    label: string,
    deviceId: string | null,
    config: ServiceConfig,
    modalKey: 'backend' | 'epex' | 'pv' | 'wallbox'
  ) => (
    <TouchableOpacity style={styles.item} activeOpacity={0.85} onPress={() => setOpenModal(modalKey)} disabled={loading}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.right}>
          <Text style={styles.value} numberOfLines={1}>
            {config.ip || 'nicht konfiguriert'}{config.ip && config.port ? `:${config.port}` : ''}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#474646" />
        </View>
      </View>
    </TouchableOpacity>
  )

  // Hilfsfunktion, um die aktuelle Konfiguration für das geöffnete Modal zu erhalten
  const getModalConfig = (): ServiceConfig => {
    switch (openModal) {
      case 'backend': return {
        ip: backendConfig.backend_ip,
        port: String(backendConfig.backend_port),
        paths: { path: backendConfig.backend_path }
      }
      case 'epex': return getDeviceConfig('epex')
      case 'pv': return getDeviceConfig('pv')
      case 'wallbox': return getDeviceConfig('wallbox')
      default: return { ip: '', port: '', paths: { default: '' } }
    }
  }

  const handleModalConfirm = (config: ServiceConfig) => {
    if (openModal === 'backend') handleBackendConfirm(config)
    else if (openModal) handleDeviceConfirm(openModal, config)
  }

  if (loading && !openModal) {
    return (
      <SettingsCard title="System- & Backendeinstellungen">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#474646" />
        </View>
      </SettingsCard>
    )
  }

  return (
    <>
      <SettingsCard title="System- & Backendeinstellungen">
        {renderServiceItem('Backend API', null, { ip: backendConfig.backend_ip, port: String(backendConfig.backend_port), paths: { path: backendConfig.backend_path } }, 'backend')}
        {renderServiceItem('EPEX Spot', 'epex', getDeviceConfig('epex'), 'epex')}
        {renderServiceItem('PV Anlage', 'pv', getDeviceConfig('pv'), 'pv')}
        {renderServiceItem('Wallbox', 'wallbox', getDeviceConfig('wallbox'), 'wallbox')}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, styles.syncButton]} activeOpacity={0.85} onPress={loadConfigs} disabled={loading}>
            <MaterialCommunityIcons name="refresh" size={20} color="#474646" />
            <Text style={styles.actionLabel}>Neu laden</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionButton, styles.resetButton]} activeOpacity={0.85} onPress={handleReset} disabled={loading}>
            <MaterialCommunityIcons name="restore" size={20} color="#c0392b" />
            <Text style={[styles.actionLabel, styles.resetLabel]}>Zurücksetzen</Text>
          </TouchableOpacity>
        </View>
      </SettingsCard>

      {openModal && (
        <SIPModal
          visible={true}
          service={openModal}
          config={getModalConfig()}
          onCancel={() => setOpenModal(null)}
          onConfirm={handleModalConfirm}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  item: { backgroundColor: '#eeeeee', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 18, fontWeight: '800', color: '#474646' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' },
  value: { fontSize: 16, fontWeight: '600', color: '#666', maxWidth: 180 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  actionLabel: { fontSize: 16, fontWeight: '800', color: '#474646' },
  syncButton: { backgroundColor: '#d4edda', borderWidth: 1, borderColor: '#c3e6cb' },
  resetButton: { backgroundColor: '#fde8e8', borderWidth: 1, borderColor: '#f5c6cb' },
  resetLabel: { color: '#c0392b' },
  loadingContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' }
})