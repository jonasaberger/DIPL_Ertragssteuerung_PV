import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, View, TouchableOpacity, Alert } from 'react-native'
import { getBackendConfig, setBackendConfigLocal } from '@/services/setting_services/device-backend_configs/backend_config_service'
import { resetAPIBase } from '@/services/helper'
import * as Updates from 'expo-updates'
import AppModal from '@/components/modal'

type Props = {
  visible: boolean
  errorMessage?: string
  onCancel: () => void
  onConfigSaved: () => void
}

export function EmergencyConfigModal ({ 
  visible, 
  errorMessage = 'Backend nicht erreichbar',
  onCancel, 
  onConfigSaved 
}: Props) {
  const [emergencyIP, setEmergencyIP] = useState('')
  const [emergencyPort, setEmergencyPort] = useState('')
  const [emergencyPath, setEmergencyPath] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    
    // Reset state when modal opens
    setError('')
    loadCurrentConfig()
  }, [visible])

  const loadCurrentConfig = async () => {
    const config = await getBackendConfig()
    setEmergencyIP(config.backend_ip)
    setEmergencyPort(config.backend_port.toString())
    setEmergencyPath(config.backend_path)
  }

  const handleSave = async () => {
    try {
      // Validierung
      if (!emergencyIP.trim()) {
        setError('IP-Adresse erforderlich')
        return
      }

      const port = parseInt(emergencyPort)
      if (isNaN(port) || port < 1 || port > 65535) {
        setError('Ungültiger Port (1-65535)')
        return
      }

      if (!emergencyPath.trim()) {
        setError('Pfad erforderlich')
        return
      }

      // Speichern
      await setBackendConfigLocal(emergencyIP.trim(), port, emergencyPath.trim())
      resetAPIBase()
      setError('')

      // Modal schließen
      onCancel()

      // Alert mit App-Neustart
      Alert.alert(
        '🔄 App Neustart',
        'Backend-Konfiguration wurde gespeichert.\n\nDie App wird jetzt neu gestartet um die Verbindung herzustellen.',
        [
          {
            text: 'Jetzt neu starten',
            onPress: async () => {
              try {
                await Updates.reloadAsync()
              } catch (reloadError) {
                console.warn('Automatischer Reload fehlgeschlagen:', reloadError)
                Alert.alert(
                  'Manueller Neustart nötig',
                  'Die App konnte nicht automatisch neu gestartet werden.\nBitte manuell neu laden (R in Expo Go drücken oder App neu starten).'
                )
                // Optional: Callback, um State in App neu zu setzen
                onConfigSaved()
              }
            }
          }
        ],
        { cancelable: false }
      )
    } catch (err) {
      console.error('Fehler beim Speichern der Notfallkonfiguration:', err)
      setError('Fehler beim Speichern der Konfiguration')
    }
  }

  const handleResetToDefault = () => {
    setEmergencyIP('100.120.107.71')
    setEmergencyPort('5050')
    setEmergencyPath('/api')
    setError('')
  }

  return (
    <AppModal
      visible={visible}
      title="Backend-Konfiguration"
      onCancel={onCancel}
      onConfirm={handleSave}
      confirmDisabled={false}
      cancelText="Abbrechen"
      confirmText="Speichern & Neu starten"
    >
      <View style={styles.content}>
        {/* Error Message from Parent */}
        {errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>⚠️</Text>
            <Text style={styles.errorBoxText}>{errorMessage}</Text>
          </View>
        )}

        <Text style={styles.description}>
          Die Verbindung zum Backend konnte nicht hergestellt werden. 
          Bitte überprüfen Sie die Backend-Konfiguration.
        </Text>

        {/* IP Address Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Backend IP-Adresse</Text>
          <TextInput
            value={emergencyIP}
            onChangeText={(text) => {
              setEmergencyIP(text)
              if (error) setError('')
            }}
            placeholder="z.B. 192.168.1.100"
            placeholderTextColor="#8a8a8a"
            style={styles.input}
            selectionColor="#474646"
            keyboardType="numeric"
            autoFocus
          />
        </View>

        {/* Port Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Port</Text>
          <TextInput
            value={emergencyPort}
            onChangeText={(text) => {
              setEmergencyPort(text)
              if (error) setError('')
            }}
            placeholder="z.B. 5050"
            placeholderTextColor="#8a8a8a"
            style={styles.input}
            selectionColor="#474646"
            keyboardType="number-pad"
          />
        </View>

        {/* Path Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>API-Pfad</Text>
          <TextInput
            value={emergencyPath}
            onChangeText={(text) => {
              setEmergencyPath(text)
              if (error) setError('')
            }}
            placeholder="/api"
            placeholderTextColor="#8a8a8a"
            style={styles.input}
            selectionColor="#474646"
          />
        </View>

        {/* Validation Error */}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {/* Reset to Default Button */}
        <TouchableOpacity 
          style={styles.resetButton}
          onPress={handleResetToDefault}
        >
          <Text style={styles.resetButtonText}>
            🔄 Standard-Werte wiederherstellen
          </Text>
          <Text style={styles.resetButtonSubtext}>
            100.120.107.71:5050/api
          </Text>
        </TouchableOpacity>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ℹ️ Nach dem Speichern wird die App automatisch neu gestartet um die neue Backend-Verbindung herzustellen.
          </Text>
        </View>
      </View>
    </AppModal>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fcc',
    gap: 8,
  },
  errorBoxIcon: {
    fontSize: 20,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#c0392b',
    fontWeight: '600',
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: '#474646',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#efefef',
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#474646',
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    fontWeight: '700',
    marginTop: -8,
  },
  resetButton: {
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '700',
  },
  resetButtonSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  infoText: {
    color: '#1565c0',
    fontSize: 12,
    lineHeight: 18,
  },
})