import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Platform, ActivityIndicator, Text, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { showToastMessage } from '@/services/helper'
import { timeStringToDate, dateToTimeString } from '@/services/helper'
import {
  fetchScheduleConfig,
  updateScheduleConfig,
  resetScheduleConfig,
  ScheduleConfig,
  Season,
} from '@/services/mode_services/time_schedule_mode_service'

// Import Components
import SeasonToggle from './components/SeasonToggle'
import DeviceCard from './components/DeviceCard'
import SettingRow from './components/SettingRow'

export default function HTimeSchedule() {
  const [activeSeason, setActiveSeason] = useState<Season>('summer')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState<{
    device: 'boiler' | 'wallbox' | null
    timeType: 'start' | 'end' | null
    season: Season | null
  }>({ device: null, timeType: null, season: null })

  const [config, setConfig] = useState<ScheduleConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<ScheduleConfig | null>(null)

  useEffect(() => {
    loadScheduleConfig()
  }, [])

  const loadScheduleConfig = async () => {
    setLoading(true)
    const data = await fetchScheduleConfig()
    if (data) {
      setConfig(data)
      setOriginalConfig(data)
    } else {
      showToastMessage('Schedule-Error', 'Zeitplan konnte nicht geladen werden.', 0)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!config || !originalConfig) return

    setSaving(true)
    const success = await updateScheduleConfig(config, originalConfig)
    setSaving(false)

    if (success) {
      setOriginalConfig(config)
      showToastMessage('Schedule-Success', 'Zeitplan erfolgreich gespeichert.', 1)
    } else {
      showToastMessage('Schedule-Error', 'Zeitplan konnte nicht gespeichert werden.', 0)
    }
  }

  const handleCancel = () => {
    if (!originalConfig) return

    setConfig(originalConfig)
    showToastMessage('Abgebrochen', 'Änderungen verworfen', 2)
  }

  const handleReset = async () => {
    setSaving(true)
    const success = await resetScheduleConfig()
    setSaving(false)

    if (success) {
      await loadScheduleConfig()
      showToastMessage('Erfolg', 'Zeitplan auf Standard zurückgesetzt', 1)

    } else {
      showToastMessage('Fehler', 'Zeitplan konnte nicht zurückgesetzt werden', 0)
    }
  }

  const updateTime = (
    device: 'boiler' | 'wallbox',
    season: Season,
    timeType: 'start' | 'end',
    time: Date
  ) => {
    if (!config) return

    const timeString = dateToTimeString(time)
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [device]: {
          ...prev[device],
          [season]: {
            ...prev[device][season],
            [timeType]: timeString,
          },
        },
      }
    })
    setShowTimePicker({ device: null, timeType: null, season: null })
  }

  const isChanged = (
    device: 'boiler' | 'wallbox',
    season: Season,
    timeType: 'start' | 'end'
  ): boolean => {
    if (!config || !originalConfig) return false
    return config[device][season][timeType] !== originalConfig[device][season][timeType]
  }

  const hasAnyChanges = (): boolean => {
    if (!config || !originalConfig) return false
    return JSON.stringify(config) !== JSON.stringify(originalConfig)
  }

  if (loading || !config || !originalConfig) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1EAFF3" />
        <Text style={styles.loadingText}>Lade Zeitplan...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Zeitplan</Text>
        <TouchableOpacity style={styles.iconButton} onPress={handleReset} disabled={saving}>
          <MaterialCommunityIcons name="restore" size={24} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      {/* Season Toggle */}
      <SeasonToggle selectedSeason={activeSeason} onSeasonChange={setActiveSeason} />

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Boiler Card */}
        <DeviceCard
          icon="water-boiler"
          title="Boiler"
          enabled={true}
          onToggle={() => {}}
          showToggle={false}
        >
          <View style={styles.settingsContainer}>
            <SettingRow
              icon="clock-start"
              label="Startzeit"
              value={config.boiler[activeSeason].start}
              onPress={() =>
                setShowTimePicker({ device: 'boiler', timeType: 'start', season: activeSeason })
              }
              changed={isChanged('boiler', activeSeason, 'start')}
            />

            <SettingRow
              icon="clock-end"
              label="Endzeit"
              value={config.boiler[activeSeason].end}
              onPress={() =>
                setShowTimePicker({ device: 'boiler', timeType: 'end', season: activeSeason })
              }
              changed={isChanged('boiler', activeSeason, 'end')}
            />
          </View>
        </DeviceCard>

        {/* Wallbox Card */}
        <DeviceCard
          icon="ev-station"
          title="Wallbox"
          enabled={true}
          onToggle={() => {}}
          showToggle={false}
        >
          <View style={styles.settingsContainer}>
            <SettingRow
              icon="clock-start"
              label="Startzeit"
              value={config.wallbox[activeSeason].start}
              onPress={() =>
                setShowTimePicker({ device: 'wallbox', timeType: 'start', season: activeSeason })
              }
              changed={isChanged('wallbox', activeSeason, 'start')}
            />

            <SettingRow
              icon="clock-end"
              label="Endzeit"
              value={config.wallbox[activeSeason].end}
              onPress={() =>
                setShowTimePicker({ device: 'wallbox', timeType: 'end', season: activeSeason })
              }
              changed={isChanged('wallbox', activeSeason, 'end')}
            />
          </View>
        </DeviceCard>

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
      {showTimePicker.device && showTimePicker.timeType && showTimePicker.season && (
        <View style={styles.timePickerContainer}>
          <DateTimePicker
            value={timeStringToDate(
              config[showTimePicker.device][showTimePicker.season][showTimePicker.timeType]
            )}
            mode="time"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              if (
                selectedDate &&
                showTimePicker.device &&
                showTimePicker.timeType &&
                showTimePicker.season
              ) {
                updateTime(
                  showTimePicker.device,
                  showTimePicker.season,
                  showTimePicker.timeType,
                  selectedDate
                )
              } else {
                setShowTimePicker({ device: null, timeType: null, season: null })
              }
            }}
          />
        </View>
      )}
    </View>
  )
}

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
  settingsContainer: {
    gap: 8,
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