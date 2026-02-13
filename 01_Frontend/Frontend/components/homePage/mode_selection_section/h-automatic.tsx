// components/homePage/h-automatic-settings.tsx
import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Switch } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import Toast from 'react-native-toast-message'
import {timeStringToDate, dateToTimeString} from '@/services/helper'
import {
  fetchAutomaticConfig,
  updateAutomaticConfig,
  resetAutomaticConfig,
  AutomaticConfig,
} from '@/services/mode_services/automatic_mode_service'

export default function HAutomaticSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState<{
    device: 'boiler' | 'wallbox' | null
  }>({ device: null })

  const [config, setConfig] = useState<AutomaticConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<AutomaticConfig | null>(null)

  // Load configuration on mount
  useEffect(() => {
    loadAutomaticConfig()
  }, [])

  const loadAutomaticConfig = async () => {
    setLoading(true)
    const data = await fetchAutomaticConfig()
    if (data) {
      setConfig(data)
      setOriginalConfig(JSON.parse(JSON.stringify(data)))
    } else {
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Automatik-Konfiguration konnte nicht geladen werden',
        position: 'bottom',
      })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!config || !originalConfig) return

    setSaving(true)
    const success = await updateAutomaticConfig(config, originalConfig)
    setSaving(false)

    if (success) {
      setOriginalConfig(JSON.parse(JSON.stringify(config)))
      Toast.show({
        type: 'success',
        text1: 'Erfolg',
        text2: 'Automatik-Konfiguration erfolgreich gespeichert',
        position: 'bottom',
      })
    } else {
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Automatik-Konfiguration konnte nicht gespeichert werden',
        position: 'bottom',
      })
    }
  }

  const handleCancel = () => {
    if (!originalConfig) return

    setConfig(JSON.parse(JSON.stringify(originalConfig)))
    Toast.show({
      type: 'info',
      text1: 'Abgebrochen',
      text2: 'Änderungen verworfen',
      position: 'bottom',
      visibilityTime: 1500,
    })
  }

  const handleReset = async () => {
    setSaving(true)
    const success = await resetAutomaticConfig()
    setSaving(false)

    if (success) {
      await loadAutomaticConfig()
      Toast.show({
        type: 'success',
        text1: 'Erfolg',
        text2: 'Automatik-Konfiguration auf Standard zurückgesetzt',
        position: 'bottom',
      })
    } else {
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Automatik-Konfiguration konnte nicht zurückgesetzt werden',
        position: 'bottom',
      })
    }
  }

  // Toggle device enabled/disabled
  const toggleDevice = (device: 'boiler' | 'wallbox') => {
    if (!config) return

    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [device]: {
          ...prev[device],
          enabled: !prev[device].enabled,
        },
      }
    })
  }

  // Update target time
  const updateTargetTime = (device: 'boiler' | 'wallbox', time: Date) => {
    if (!config) return

    const timeString = dateToTimeString(time)
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [device]: {
          ...prev[device],
          target_time: timeString,
        },
      }
    })
    setShowTimePicker({ device: null })
  }

  // Update energy
  const updateEnergy = (device: 'boiler' | 'wallbox', delta: number) => {
    if (!config) return

    setConfig((prev) => {
      if (!prev) return prev
      const currentValue = prev[device].energy_kwh
      const newValue = Math.max(0, currentValue + delta)
      return {
        ...prev,
        [device]: {
          ...prev[device],
          energy_kwh: parseFloat(newValue.toFixed(1)),
        },
      }
    })
  }

  // Update runtime (boiler only)
  const updateRuntime = (delta: number) => {
    if (!config) return

    setConfig((prev) => {
      if (!prev) return prev
      const currentValue = prev.boiler.min_runtime_min
      const newValue = Math.max(0, currentValue + delta)
      return {
        ...prev,
        boiler: {
          ...prev.boiler,
          min_runtime_min: newValue,
        },
      }
    })
  }

  // Toggle night grid (wallbox only)
  const toggleNightGrid = () => {
    if (!config) return

    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        wallbox: {
          ...prev.wallbox,
          allow_night_grid: !prev.wallbox.allow_night_grid,
        },
      }
    })
  }

  // Check if specific field has changed
  const isFieldChanged = (
    device: 'boiler' | 'wallbox',
    field: keyof AutomaticConfig['boiler'] | keyof AutomaticConfig['wallbox']
  ): boolean => {
    if (!config || !originalConfig) return false
    return config[device][field as keyof typeof config[typeof device]] !== 
           originalConfig[device][field as keyof typeof originalConfig[typeof device]]
  }

  // Check if any value has changed
  const hasAnyChanges = (): boolean => {
    if (!config || !originalConfig) return false

    return (
      config.boiler.enabled !== originalConfig.boiler.enabled ||
      config.boiler.target_time !== originalConfig.boiler.target_time ||
      config.boiler.energy_kwh !== originalConfig.boiler.energy_kwh ||
      config.boiler.min_runtime_min !== originalConfig.boiler.min_runtime_min ||
      config.wallbox.enabled !== originalConfig.wallbox.enabled ||
      config.wallbox.target_time !== originalConfig.wallbox.target_time ||
      config.wallbox.energy_kwh !== originalConfig.wallbox.energy_kwh ||
      config.wallbox.allow_night_grid !== originalConfig.wallbox.allow_night_grid
    )
  }

  if (loading || !config || !originalConfig) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1EAFF3" />
        <Text style={styles.loadingText}>Lade Automatik-Konfiguration...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header with Reset Button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Automatik-Einstellungen</Text>
        <TouchableOpacity style={styles.iconButton} onPress={handleReset} disabled={saving}>
          <MaterialCommunityIcons name="restore" size={24} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Boiler Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="water-boiler" size={24} color="#1EAFF3" />
              <Text style={styles.sectionTitle}>Boiler</Text>
            </View>
            <Switch
              value={config.boiler.enabled}
              onValueChange={() => toggleDevice('boiler')}
              trackColor={{ false: '#D1D1D6', true: '#1EAFF3' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {config.boiler.enabled && (
            <View style={styles.settingsContainer}>
              {/* Target Time */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowTimePicker({ device: 'boiler' })}
              >
                <View style={styles.settingLabel}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
                  <Text style={styles.settingLabelText}>Zielzeit</Text>
                </View>
                <View style={styles.settingValue}>
                  <Text 
                    style={[
                      styles.settingValueText,
                      isFieldChanged('boiler', 'target_time') && styles.settingValueTextChanged
                    ]}
                  >
                    {config.boiler.target_time}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" />
                </View>
              </TouchableOpacity>

              {/* Energy */}
              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color="#666" />
                  <Text style={styles.settingLabelText}>Energie</Text>
                </View>
                <View style={styles.counterControl}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateEnergy('boiler', -0.5)}
                  >
                    <MaterialCommunityIcons name="minus" size={20} color="#1EAFF3" />
                  </TouchableOpacity>
                  <Text 
                    style={[
                      styles.counterValue,
                      isFieldChanged('boiler', 'energy_kwh') && styles.counterValueChanged
                    ]}
                  >
                    {config.boiler.energy_kwh} kWh
                  </Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateEnergy('boiler', 0.5)}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color="#1EAFF3" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Min Runtime */}
              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <MaterialCommunityIcons name="timer-outline" size={20} color="#666" />
                  <Text style={styles.settingLabelText}>Min. Laufzeit</Text>
                </View>
                <View style={styles.counterControl}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateRuntime(-15)}
                  >
                    <MaterialCommunityIcons name="minus" size={20} color="#1EAFF3" />
                  </TouchableOpacity>
                  <Text 
                    style={[
                      styles.counterValue,
                      isFieldChanged('boiler', 'min_runtime_min') && styles.counterValueChanged
                    ]}
                  >
                    {config.boiler.min_runtime_min} min
                  </Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateRuntime(15)}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color="#1EAFF3" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Wallbox Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="ev-station" size={24} color="#1EAFF3" />
              <Text style={styles.sectionTitle}>Wallbox</Text>
            </View>
            <Switch
              value={config.wallbox.enabled}
              onValueChange={() => toggleDevice('wallbox')}
              trackColor={{ false: '#D1D1D6', true: '#1EAFF3' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {config.wallbox.enabled && (
            <View style={styles.settingsContainer}>
              {/* Target Time */}
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setShowTimePicker({ device: 'wallbox' })}
              >
                <View style={styles.settingLabel}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color="#666" />
                  <Text style={styles.settingLabelText}>Zielzeit</Text>
                </View>
                <View style={styles.settingValue}>
                  <Text 
                    style={[
                      styles.settingValueText,
                      isFieldChanged('wallbox', 'target_time') && styles.settingValueTextChanged
                    ]}
                  >
                    {config.wallbox.target_time}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" />
                </View>
              </TouchableOpacity>

              {/* Energy */}
              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <MaterialCommunityIcons name="lightning-bolt" size={20} color="#666" />
                  <Text style={styles.settingLabelText}>Energie</Text>
                </View>
                <View style={styles.counterControl}>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateEnergy('wallbox', -1)}
                  >
                    <MaterialCommunityIcons name="minus" size={20} color="#1EAFF3" />
                  </TouchableOpacity>
                  <Text 
                    style={[
                      styles.counterValue,
                      isFieldChanged('wallbox', 'energy_kwh') && styles.counterValueChanged
                    ]}
                  >
                    {config.wallbox.energy_kwh} kWh
                  </Text>
                  <TouchableOpacity
                    style={styles.counterButton}
                    onPress={() => updateEnergy('wallbox', 1)}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color="#1EAFF3" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Night Grid */}
              <View style={styles.settingRow}>
                <View style={styles.settingLabel}>
                  <MaterialCommunityIcons name="weather-night" size={20} color="#666" />
                  <Text style={styles.settingLabelText}>Nachtladung (Netz)</Text>
                </View>
                <Switch
                  value={config.wallbox.allow_night_grid}
                  onValueChange={toggleNightGrid}
                  trackColor={{ false: '#D1D1D6', true: '#1EAFF3' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          )}
        </View>

        {/* Save/Cancel Buttons */}
        {hasAnyChanges() && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Speichern</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={saving}>
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Time Picker Modal */}
      {showTimePicker.device && (
        <View style={styles.timePickerContainer}>
          <DateTimePicker
            value={timeStringToDate(config[showTimePicker.device].target_time)}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              if (selectedDate && showTimePicker.device) {
                updateTargetTime(showTimePicker.device, selectedDate)
              } else {
                setShowTimePicker({ device: null })
              }
            }}
          />
        </View>
      )}
    </View>
  )
}

// Styles created with ChatGPT
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  settingsContainer: {
    gap: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingLabelText: {
    fontSize: 15,
    color: '#333',
  },
  settingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingValueText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1EAFF3',
  },
  settingValueTextChanged: {
    color: '#FF3B30',
  },
  counterControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    minWidth: 80,
    textAlign: 'center',
  },
  counterValueChanged: {
    color: '#FF3B30',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1EAFF3',
    borderRadius: 12,
    paddingVertical: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8E8E93',
  },
  timePickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
})