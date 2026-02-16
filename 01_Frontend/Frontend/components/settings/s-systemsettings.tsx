import React, { useState, useEffect } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import SettingsCard from '@/components/settingscard'
import SIPModal from '@/components/settings/s-ipmodal'
import SPasswordModal from '@/components/settings/s-passwordmodal'
import {
  getBackendConfig,
  editBackendURL,
  fetchDevices,
  updateDeviceConfig,
  parseDeviceUrl,
  buildDeviceUrl,
  type Device,
  type DevicesResponse
} from '@/services/setting_services/backend_config_service'

type ServiceConfig = {
  ip: string
  port: string
  path: string
}

export default function SSystemSettings() {
  const [openModal, setOpenModal] = useState<'backend' | 'epex' | 'pv' | 'wallbox' | null>(null)
  const [passwordModal, setPasswordModal] = useState<{
    visible: boolean
    deviceId: string
    config: ServiceConfig
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const [backendConfig, setBackendConfig] = useState({ backend_ip: '', backend_port: 0, backend_path: '' })
  const [devices, setDevices] = useState<DevicesResponse>({})

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    try {
      setLoading(true)
      const backend = await getBackendConfig()
      setBackendConfig(backend)

      const devicesData = await fetchDevices()
      setDevices(devicesData)
    } catch (error) {
      console.error('Error loading configs:', error)
      Alert.alert('Fehler', 'Konfiguration konnte nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  const handleBackendConfirm = async (config: ServiceConfig) => {
    try {
      setLoading(true)
      await editBackendURL(config.ip, Number(config.port), config.path)
      await loadConfigs()
      setOpenModal(null)
      Alert.alert('Erfolg', 'Backend-Konfiguration gespeichert')
    } catch (error) {
      console.error('Error updating backend:', error)
      Alert.alert('Fehler', 'Backend konnte nicht aktualisiert werden')
    } finally {
      setLoading(false)
    }
  }

  const handleDeviceConfirm = async (deviceId: string, config: ServiceConfig) => {
    // Zeige Password Modal
    setPasswordModal({ visible: true, deviceId, config })
    setOpenModal(null)
  }

  const handlePasswordSubmit = async (password: string) => {
    if (!passwordModal) return

    const { deviceId, config } = passwordModal

    try {
      setLoading(true)
      const baseUrl = buildDeviceUrl(config.ip, config.port, deviceId === 'epex')
      
      // Get current device to preserve other endpoints
      const currentDevice = devices[deviceId]
      const endpoints = currentDevice?.endpoints || {}
      
      // Update the first endpoint with new path
      const endpointKey = Object.keys(endpoints)[0] || 'default'
      const updatedEndpoints = { ...endpoints, [endpointKey]: config.path }

      await updateDeviceConfig(deviceId, password, baseUrl, updatedEndpoints)
      await loadConfigs()
      
      setPasswordModal(null)
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

  const getDeviceConfig = (deviceId: string): ServiceConfig => {
    const device = devices[deviceId]
    if (!device) return { ip: '', port: '', path: '' }

    const parsed = parseDeviceUrl({ deviceId, ...device })
    return parsed || { ip: '', port: '', path: '' }
  }

  const renderServiceItem = (
    label: string,
    deviceId: string | null,
    config: ServiceConfig,
    modalKey: 'backend' | 'epex' | 'pv' | 'wallbox'
  ) => (
    <TouchableOpacity
      style={styles.item}
      activeOpacity={0.85}
      onPress={() => setOpenModal(modalKey)}
      disabled={loading}
    >
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.right}>
          <Text style={styles.value} numberOfLines={1}>
            {config.ip || 'nicht konfiguriert'}
            {config.ip && config.port ? `:${config.port}` : ''}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#474646" />
        </View>
      </View>
    </TouchableOpacity>
  )

  const getModalConfig = (): ServiceConfig => {
    switch (openModal) {
      case 'backend':
        return {
          ip: backendConfig.backend_ip,
          port: String(backendConfig.backend_port),
          path: backendConfig.backend_path
        }
      case 'epex':
        return getDeviceConfig('epex')
      case 'pv':
        return getDeviceConfig('pv')
      case 'wallbox':
        return getDeviceConfig('wallbox')
      default:
        return { ip: '', port: '', path: '' }
    }
  }

  const handleModalConfirm = (config: ServiceConfig) => {
    if (openModal === 'backend') {
      handleBackendConfirm(config)
    } else if (openModal) {
      handleDeviceConfirm(openModal, config)
    }
  }

  if (loading && !openModal && !passwordModal) {
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
        {renderServiceItem(
          'Backend API',
          null,
          {
            ip: backendConfig.backend_ip,
            port: String(backendConfig.backend_port),
            path: backendConfig.backend_path
          },
          'backend'
        )}
        {renderServiceItem('EPEX Spot', 'epex', getDeviceConfig('epex'), 'epex')}
        {renderServiceItem('PV Anlage', 'pv', getDeviceConfig('pv'), 'pv')}
        {renderServiceItem('Wallbox', 'wallbox', getDeviceConfig('wallbox'), 'wallbox')}

        {/* Reload Button */}
        <TouchableOpacity
          style={[styles.item, styles.syncButton]}
          activeOpacity={0.85}
          onPress={loadConfigs}
          disabled={loading}
        >
          <View style={styles.row}>
            <MaterialCommunityIcons name="refresh" size={22} color="#474646" />
            <Text style={styles.label}>Konfiguration neu laden</Text>
          </View>
        </TouchableOpacity>
      </SettingsCard>

      {/* Config Modal */}
      {openModal && (
        <SIPModal
          visible={true}
          service={openModal}
          config={getModalConfig()}
          onCancel={() => setOpenModal(null)}
          onConfirm={handleModalConfirm}
        />
      )}

      {/* Password Modal für Device Updates */}
      {passwordModal && (
        <SPasswordModal
          visible={passwordModal.visible}
          onCancel={() => setPasswordModal(null)}
          onSuccess={handlePasswordSubmit}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#eeeeee',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  label: {
    fontSize: 18,
    fontWeight: '800',
    color: '#474646'
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    justifyContent: 'flex-end'
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    maxWidth: 180
  },
  syncButton: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#c3e6cb'
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center'
  }
})