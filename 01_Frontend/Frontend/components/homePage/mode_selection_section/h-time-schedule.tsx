import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, ActivityIndicator } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import Toast from 'react-native-toast-message'
import {timeStringToDate, dateToTimeString} from '@/services/helper'
import {fetchScheduleConfig, updateScheduleConfig, resetScheduleConfig, ScheduleConfig, Season,} from '@/services/mode_services/time_schedule_mode_service'

export default function HTimeSchedule() {
  const [activeSeason, setActiveSeason] = useState<Season>('winter')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState<{
    device: 'boiler' | 'wallbox' | null
    timeType: 'start' | 'end' | null
    season: Season | null
  }>({ device: null, timeType: null, season: null })

  const [config, setConfig] = useState<ScheduleConfig | null>(null)
  const [originalConfig, setOriginalConfig] = useState<ScheduleConfig | null>(null)

  // Load configuration on mount
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
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Zeitplan konnte nicht geladen werden',
        position: 'bottom',
      })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!config) return

    setSaving(true)
    const success = await updateScheduleConfig(config)
    setSaving(false)

    if (success) {
      setOriginalConfig(config)
      Toast.show({
        type: 'success',
        text1: 'Erfolg',
        text2: 'Zeitplan erfolgreich gespeichert',
        position: 'bottom',
      })
    } else {
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Zeitplan konnte nicht gespeichert werden',
        position: 'bottom',
      })
    }
  }

  const handleCancel = () => {
    if (!originalConfig) return

    setConfig(originalConfig)
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
    const success = await resetScheduleConfig()
    setSaving(false)

    if (success) {
      await loadScheduleConfig()
      Toast.show({
        type: 'success',
        text1: 'Erfolg',
        text2: 'Zeitplan auf Standard zurückgesetzt',
        position: 'bottom',
      })
    } else {
      Toast.show({
        type: 'error',
        text1: 'Fehler',
        text2: 'Zeitplan konnte nicht zurückgesetzt werden',
        position: 'bottom',
      })
    }
  }

  // Update time
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

  // Check if value has changed
  const isChanged = (
    device: 'boiler' | 'wallbox',
    season: Season,
    timeType: 'start' | 'end'
  ): boolean => {
    if (!config || !originalConfig) return false
    return config[device][season][timeType] !== originalConfig[device][season][timeType]
  }

  // Check if any value has changed
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
      {/* Header with Season Selector & Reset Button */}
      <View style={styles.header}>
        {/* Season Selector */}
        <View style={styles.seasonSelector}>
          <TouchableOpacity
            style={[
              styles.seasonButton,
              activeSeason === 'winter' && styles.seasonButtonActiveWinter,
            ]}
            onPress={() => setActiveSeason('winter')}
          >
            <MaterialCommunityIcons
              name="snowflake"
              size={20}
              color={activeSeason === 'winter' ? '#FFFFFF' : '#8E8E93'}
            />
            <Text
              style={[
                styles.seasonText,
                activeSeason === 'winter' && styles.seasonTextActive,
              ]}
            >
              Winter
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.seasonButton,
              activeSeason === 'summer' && styles.seasonButtonActiveSummer,
            ]}
            onPress={() => setActiveSeason('summer')}
          >
            <MaterialCommunityIcons
              name="white-balance-sunny"
              size={20}
              color={activeSeason === 'summer' ? '#FFFFFF' : '#8E8E93'}
            />
            <Text
              style={[
                styles.seasonText,
                activeSeason === 'summer' && styles.seasonTextActive,
              ]}
            >
              Sommer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Reset Button - always Visible */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleReset}
          disabled={saving}
        >
          <MaterialCommunityIcons name="restore" size={24} color="#8E8E93" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Boiler Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="water-boiler" size={24} color="#1EAFF3" />
            <Text style={styles.sectionTitle}>Boiler</Text>
          </View>

          <View style={styles.settingsContainer}>
            {/* Start Time */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() =>
                setShowTimePicker({ device: 'boiler', timeType: 'start', season: activeSeason })
              }
            >
              <View style={styles.settingLabel}>
                <MaterialCommunityIcons name="clock-start" size={20} color="#666" />
                <Text style={styles.settingLabelText}>Startzeit</Text>
              </View>
              <View style={styles.settingValue}>
                <Text
                  style={[
                    styles.settingValueText,
                    isChanged('boiler', activeSeason, 'start') && styles.settingValueTextChanged,
                  ]}
                >
                  {config.boiler[activeSeason].start}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" />
              </View>
            </TouchableOpacity>

            {/* End Time */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() =>
                setShowTimePicker({ device: 'boiler', timeType: 'end', season: activeSeason })
              }
            >
              <View style={styles.settingLabel}>
                <MaterialCommunityIcons name="clock-end" size={20} color="#666" />
                <Text style={styles.settingLabelText}>Endzeit</Text>
              </View>
              <View style={styles.settingValue}>
                <Text
                  style={[
                    styles.settingValueText,
                    isChanged('boiler', activeSeason, 'end') && styles.settingValueTextChanged,
                  ]}
                >
                  {config.boiler[activeSeason].end}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Wallbox Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="ev-station" size={24} color="#1EAFF3" />
            <Text style={styles.sectionTitle}>Wallbox</Text>
          </View>

          <View style={styles.settingsContainer}>
            {/* Start Time */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() =>
                setShowTimePicker({ device: 'wallbox', timeType: 'start', season: activeSeason })
              }
            >
              <View style={styles.settingLabel}>
                <MaterialCommunityIcons name="clock-start" size={20} color="#666" />
                <Text style={styles.settingLabelText}>Startzeit</Text>
              </View>
              <View style={styles.settingValue}>
                <Text
                  style={[
                    styles.settingValueText,
                    isChanged('wallbox', activeSeason, 'start') && styles.settingValueTextChanged,
                  ]}
                >
                  {config.wallbox[activeSeason].start}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" />
              </View>
            </TouchableOpacity>

            {/* End Time */}
            <TouchableOpacity
              style={styles.settingRow}
              onPress={() =>
                setShowTimePicker({ device: 'wallbox', timeType: 'end', season: activeSeason })
              }
            >
              <View style={styles.settingLabel}>
                <MaterialCommunityIcons name="clock-end" size={20} color="#666" />
                <Text style={styles.settingLabelText}>Endzeit</Text>
              </View>
              <View style={styles.settingValue}>
                <Text
                  style={[
                    styles.settingValueText,
                    isChanged('wallbox', activeSeason, 'end') && styles.settingValueTextChanged,
                  ]}
                >
                  {config.wallbox[activeSeason].end}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save/Cancel Buttons - only show for Changes */}
        {hasAnyChanges() && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Speichern</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={saving}
            >
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

// Styles created with help from ChatGPT
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
    gap: 12,
    marginBottom: 16,
  },
  seasonSelector: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  seasonButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  seasonButtonActiveWinter: {
    backgroundColor: '#5BA3D0', // Eisblau für Winter
  },
  seasonButtonActiveSummer: {
    backgroundColor: '#FF9500', // Orange für Sommer
  },
  seasonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  seasonTextActive: {
    color: '#FFFFFF',
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
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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