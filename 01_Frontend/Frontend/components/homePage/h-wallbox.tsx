import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'

type Props = {
  // Wieviel Energie bisher zugeführt wurde (kommt vom Home-Screen)
  energyKWh: number
  // Ob die Wallbox gerade lädt oder nicht (kommt vom Home-Screen / Backend)
  isCharging: boolean
  // Speichert die aktuell ausgewählte Einstellung der e-Go Wallbox
  selectedSetting: 'SETTING_1' | 'SETTING_2'
  // Wird aufgerufen, wenn eine Einstellung ausgewählt wird
  onSelect: (setting: 'SETTING_1' | 'SETTING_2') => void
}

export default function HWallbox({
  energyKWh,
  isCharging,
  selectedSetting,
  onSelect,
}: Props) {
  return (
    // Die Card mit der E-GO Wallbox
    <Card>
      <View style={styles.wallboxCard}>
        <View style={styles.wallboxHeaderRow}>
          <View>
            <Text style={styles.wallboxTitle}>E-GO Wallbox</Text>
            <Text style={styles.wallboxEnergyText}>
              <Text style={styles.wallboxEnergyValue}>{energyKWh} kWh</Text>{' '}
              zugeführt
            </Text>
          </View>

          {/* Status oben rechts („Laden…“ / „Lädt nicht“) */}
          <View
            pointerEvents="none"
            style={[
              styles.wallboxStatusContainer,
              { overflow: 'hidden' },
            ]}
          >
            <MaterialCommunityIcons
              name={isCharging ? 'flash' : 'close'}
              size={16}
              color={isCharging ? '#16C75C' : '#d01212ff'}
            />
            <Text
              style={[
                styles.wallboxStatusText,
                isCharging
                  ? styles.wallboxStatusTextCharging
                  : styles.wallboxStatusTextIdle,
              ]}
            >
              {isCharging ? 'Laden…' : 'Lädt nicht'}
            </Text>
          </View>
        </View>

        {/* Die zwei Settings-Buttons */}
        <View style={styles.wallboxSettingsContainer}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.wallboxSettingButton,
              selectedSetting === 'SETTING_1' &&
                styles.wallboxSettingButtonActive,
            ]}
            onPress={() => onSelect('SETTING_1')}
          >
            <Text
              style={[
                styles.wallboxSettingText,
                selectedSetting === 'SETTING_1' &&
                  styles.wallboxSettingTextActive,
              ]}
            >
              Setting 1
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.wallboxSettingButton,
              selectedSetting === 'SETTING_2' &&
                styles.wallboxSettingButtonActive,
            ]}
            onPress={() => onSelect('SETTING_2')}
          >
            <Text
              style={[
                styles.wallboxSettingText,
                selectedSetting === 'SETTING_2' &&
                  styles.wallboxSettingTextActive,
              ]}
            >
              Setting 2
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  wallboxCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  wallboxHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  wallboxTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E1E1E',
    marginBottom: 2,
  },
  wallboxEnergyText: {
    fontSize: 14,
    color: '#7A7A7A',
  },
  wallboxEnergyValue: {
    color: '#1EAFF3',
    fontWeight: '600',
  },
  wallboxStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
  wallboxStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  wallboxStatusTextCharging: {
    color: '#16C75C',
  },
  wallboxStatusTextIdle: {
    color: '#d01212ff',
  },
  wallboxSettingsContainer: {
    gap: 8,
  },
  wallboxSettingButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#E7E7E7',
  },
  wallboxSettingButtonActive: {
    backgroundColor: '#D9ECFF',
    borderWidth: 1,
    borderColor: '#1EAFF3',
  },
  wallboxSettingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555555',
  },
  wallboxSettingTextActive: {
    color: '#1EAFF3',
    fontWeight: '600',
  },
})
