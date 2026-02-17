import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import Toast from 'react-native-toast-message'
import { timeStringToDate, dateToTimeString } from '@/services/helper'
import {
  fetchAutomaticConfig,
  updateAutomaticConfig,
  resetAutomaticConfig,
  AutomaticConfig,
} from '@/services/mode_services/automatic_mode_service'

// Import Components
import SeasonToggle from './components/SeasonToggle'
import DeviceCard from './components/DeviceCard'
import SettingRow from './components/SettingRow'
import CounterControl from './components/CounterControl'

type Season = 'summer' | 'winter'

export default function HAutomaticSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<Season>('summer')
  const [showTimePicker, setShowTimePicker] = useState<{ device: 'boiler' | 'wallbox' | null }>({ device: null })

  const [config, setConfig] = useState<AutomaticConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<AutomaticConfig | null>(null)

  useEffect(() => {
    loadAutomaticConfig()
  }, [])

  const loadAutomaticConfig = async () => {
    setLoading(true)
    try {
      const data = await fetchAutomaticConfig()
      if (data) {
        const validatedConfig: AutomaticConfig = {
          boiler: {
            summer: {
              target_time: data.boiler?.summer?.target_time ?? '14:00',
              target_temp_c: data.boiler?.summer?.target_temp_c ?? 68,
              min_runtime_min: data.boiler?.summer?.min_runtime_min ?? 60,
            },
            winter: {
              target_time: data.boiler?.winter?.target_time ?? '16:00',
              target_temp_c: data.boiler?.winter?.target_temp_c ?? 68,
              min_runtime_min: data.boiler?.winter?.min_runtime_min ?? 90,
            },
          },
          wallbox: {
            summer: {
              target_time: data.wallbox?.summer?.target_time ?? '17:00',
              energy_kwh: data.wallbox?.summer?.energy_kwh ?? 10,
              allow_night_grid: data.wallbox?.summer?.allow_night_grid ?? false,
            },
            winter: {
              target_time: data.wallbox?.winter?.target_time ?? '18:00',
              energy_kwh: data.wallbox?.winter?.energy_kwh ?? 12,
              allow_night_grid: data.wallbox?.winter?.allow_night_grid ?? true,
            },
          },
        }
        setConfig(validatedConfig)
        setOriginalConfig(JSON.parse(JSON.stringify(validatedConfig)))
      } else {
        Toast.show({
          type: 'error',
          text1: 'Fehler',
          text2: 'Automatik-Konfiguration konnte nicht geladen werden',
          position: 'bottom',
        })
      }
    } catch (error) {
      console.error('Error loading config:', error)
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Automatik-Konfiguration konnte nicht geladen werden',
        position: 'bottom',
      })
    } finally {
      setLoading(false)
    }
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

  const updateTargetTime = (device: 'boiler' | 'wallbox', time: Date) => {
    if (!config) return
    const timeString = dateToTimeString(time)
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [device]: {
          ...prev[device],
          [selectedSeason]: {
            ...prev[device][selectedSeason],
            target_time: timeString,
          },
        },
      }
    })
    setShowTimePicker({ device: null })
  }

  const updateTemperature = (delta: number) => {
    if (!config) return
    setConfig((prev) => {
      if (!prev) return prev
      const currentValue = prev.boiler[selectedSeason].target_temp_c ?? 60
      const newValue = Math.max(0, Math.min(100, currentValue + delta))
      return {
        ...prev,
        boiler: {
          ...prev.boiler,
          [selectedSeason]: {
            ...prev.boiler[selectedSeason],
            target_temp_c: newValue,
          },
        },
      }
    })
  }

  const updateEnergy = (delta: number) => {
    if (!config) return
    setConfig((prev) => {
      if (!prev) return prev
      const currentValue = prev.wallbox[selectedSeason].energy_kwh ?? 0
      const newValue = Math.max(0, currentValue + delta)
      return {
        ...prev,
        wallbox: {
          ...prev.wallbox,
          [selectedSeason]: {
            ...prev.wallbox[selectedSeason],
            energy_kwh: parseFloat(newValue.toFixed(1)),
          },
        },
      }
    })
  }

  const updateRuntime = (delta: number) => {
    if (!config) return
    setConfig((prev) => {
      if (!prev) return prev
      const currentValue = prev.boiler[selectedSeason].min_runtime_min ?? 0
      const newValue = Math.max(0, currentValue + delta)
      return {
        ...prev,
        boiler: {
          ...prev.boiler,
          [selectedSeason]: {
            ...prev.boiler[selectedSeason],
            min_runtime_min: newValue,
          },
        },
      }
    })
  }

  const toggleNightGrid = () => {
    if (!config) return
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        wallbox: {
          ...prev.wallbox,
          [selectedSeason]: {
            ...prev.wallbox[selectedSeason],
            allow_night_grid: !prev.wallbox[selectedSeason].allow_night_grid,
          },
        },
      }
    })
  }

  // Prüft, ob ein Feld verändert wurde
  const isFieldChanged = (device: 'boiler' | 'wallbox', field: string) => {
    if (!config || !originalConfig) return false
    return (config[device][selectedSeason] as any)[field] !==
           (originalConfig[device][selectedSeason] as any)[field]
  }

  const hasAnyChanges = (): boolean => {
    if (!config || !originalConfig) return false
    return JSON.stringify(config) !== JSON.stringify(originalConfig)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1EAFF3" />
        <Text style={styles.loadingText}>Lade Automatik-Konfiguration...</Text>
      </View>
    )
  }

  if (!config || !originalConfig) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#FF3B30" />
        <Text style={styles.loadingText}>Konfiguration konnte nicht geladen werden</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadAutomaticConfig}>
          <Text style={styles.retryButtonText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Automatik-Einstellungen</Text>
        <TouchableOpacity style={styles.iconButton} onPress={handleReset} disabled={saving}>
          <MaterialCommunityIcons name="restore" size={24} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Season Toggle */}
      <SeasonToggle selectedSeason={selectedSeason} onSeasonChange={setSelectedSeason} />

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Boiler Card */}
        <DeviceCard icon="water-boiler" title="Boiler">
          <View style={styles.settingsContainer}>
            <SettingRow
              icon="clock-outline"
              label="Zielzeit"
              value={config.boiler[selectedSeason].target_time}
              onPress={() => setShowTimePicker({ device: 'boiler' })}
              changed={isFieldChanged('boiler', 'target_time')}
            />
            <SettingRow icon="thermometer" label="Zieltemperatur">
              <CounterControl
                value={config.boiler[selectedSeason].target_temp_c}
                unit="°C"
                onIncrement={() => updateTemperature(5)}
                onDecrement={() => updateTemperature(-5)}
                changed={isFieldChanged('boiler', 'target_temp_c')}
              />
            </SettingRow>
            <SettingRow icon="timer-outline" label="Min. Laufzeit">
              <CounterControl
                value={config.boiler[selectedSeason].min_runtime_min}
                unit="min"
                onIncrement={() => updateRuntime(15)}
                onDecrement={() => updateRuntime(-15)}
                changed={isFieldChanged('boiler', 'min_runtime_min')}
              />
            </SettingRow>
          </View>
        </DeviceCard>

        {/* Wallbox Card */}
        <DeviceCard icon="ev-station" title="Wallbox">
          <View style={styles.settingsContainer}>
            <SettingRow
              icon="clock-outline"
              label="Zielzeit"
              value={config.wallbox[selectedSeason].target_time}
              onPress={() => setShowTimePicker({ device: 'wallbox' })}
              changed={isFieldChanged('wallbox', 'target_time')}
            />
            <SettingRow icon="lightning-bolt" label="Energie">
              <CounterControl
                value={config.wallbox[selectedSeason].energy_kwh}
                unit="kWh"
                onIncrement={() => updateEnergy(1)}
                onDecrement={() => updateEnergy(-1)}
                changed={isFieldChanged('wallbox', 'energy_kwh')}
              />
            </SettingRow>
            <SettingRow icon="weather-night" label="Nachtladung (Netz)">
              <Switch
                value={config.wallbox[selectedSeason].allow_night_grid}
                onValueChange={toggleNightGrid}
                trackColor={{ false: '#D1D1D6', true: '#1EAFF3' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D1D6"
              />
            </SettingRow>
          </View>
        </DeviceCard>

        {/* Save/Cancel Buttons */}
        {hasAnyChanges() && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Speichern</Text>}
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
            value={timeStringToDate(config[showTimePicker.device][selectedSeason].target_time)}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#666', textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#1EAFF3', borderRadius: 8 },
  retryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  iconButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { flex: 1 },
  settingsContainer: { gap: 8 },
  buttonContainer: { gap: 12, marginTop: 8, marginBottom: 24 },
  saveButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1EAFF3', borderRadius: 12, paddingVertical: 16 },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  cancelButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F0', borderRadius: 12, paddingVertical: 16 },
  cancelButtonText: { fontSize: 16, fontWeight: '700', color: '#8E8E93' },
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
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
})
