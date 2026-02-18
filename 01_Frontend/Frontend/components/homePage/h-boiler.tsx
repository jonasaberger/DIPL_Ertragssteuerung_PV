import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import UnavailableState from '@/components/unavailable-state'

type Props = {
  temperatureC: number
  isHeating: boolean
  selectedSetting: 'MANUAL_OFF' | 'MANUAL_ON'
  onSelect: (setting: 'MANUAL_OFF' | 'MANUAL_ON') => void
  available: boolean
  showControls?: boolean
}

export default function HBoiler({
  temperatureC,
  isHeating,
  selectedSetting,
  onSelect,
  available,
  showControls = true,
}: Props) {

  const getTempColor = (temp: number) => {
    if (temp < 40) return '#1EAFF3'
    if (temp < 55) return '#FFA500'
    return '#d01212'
  }

  return (
    <Card>
      <View style={styles.boilerCard}>
        {!available ? (
          <UnavailableState title="Boiler nicht verfügbar" />
        ) : (
          <>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.boilerTitle}>Warmwasserboiler</Text>

              <View
                style={[
                  styles.statusBadge,
                  isHeating ? styles.statusBadgeHeating : styles.statusBadgeIdle,
                ]}
              >
                <MaterialCommunityIcons
                  name={isHeating ? 'thermometer' : 'close'}
                  size={16}
                  color={isHeating ? '#d01212' : '#8E8E93'}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    isHeating ? styles.statusTextHeating : styles.statusTextIdle,
                  ]}
                >
                  {isHeating ? 'Wärmt…' : 'Aus'}
                </Text>
              </View>
            </View>

            {/* Temperatur */}
            <View style={styles.tempSection}>
              <Text style={[styles.tempValue, { color: getTempColor(temperatureC) }]}>
                {temperatureC}°C
              </Text>
              <Text style={styles.tempLabel}>Aktuelle Temperatur</Text>
            </View>

            {/* Einstellungen */}
            {showControls && (
              <View style={styles.settingsSection}>
                <Text style={styles.settingsTitle}>Heizmodus</Text>

                <View style={styles.settingsButtons}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.settingButton,
                      selectedSetting === 'MANUAL_ON' && styles.settingButtonActive,
                    ]}
                    onPress={() => onSelect('MANUAL_ON')}
                  >
                    <View style={styles.settingContent}>
                      <View style={[styles.radio, selectedSetting === 'MANUAL_ON' && styles.radioActive]}>
                        {selectedSetting === 'MANUAL_ON' && <View style={styles.radioInner} />}
                      </View>
                      <View>
                        <Text style={styles.settingText}>Manuell Heizen</Text>
                        <Text style={styles.settingSubtext}>Boiler startet sofort</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[
                      styles.settingButton,
                      selectedSetting === 'MANUAL_OFF' && styles.settingButtonActive,
                    ]}
                    onPress={() => onSelect('MANUAL_OFF')}
                  >
                    <View style={styles.settingContent}>
                      <View style={[styles.radio, selectedSetting === 'MANUAL_OFF' && styles.radioActive]}>
                        {selectedSetting === 'MANUAL_OFF' && <View style={styles.radioInner} />}
                      </View>
                      <View>
                        <Text style={styles.settingText}>Manuell Aus</Text>
                        <Text style={styles.settingSubtext}>Boiler deaktiviert</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  boilerCard: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  boilerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusBadgeHeating: { backgroundColor: '#FFE8E8' },
  statusBadgeIdle: { backgroundColor: '#F0F0F0' },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  statusTextHeating: { color: '#d01212' },
  statusTextIdle: { color: '#8E8E93' },

  tempSection: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  tempValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  tempLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1C1C1E',
    marginTop: 2,
  },

  settingsSection: { gap: 8 },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  settingsButtons: { gap: 8 },
  settingButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 12,
  },
  settingButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1EAFF3',
  },
  settingContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: '#1EAFF3' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1EAFF3' },
  settingText: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  settingSubtext: { fontSize: 11, color: '#8E8E93' },
})