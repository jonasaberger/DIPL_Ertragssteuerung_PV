import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'

type Props = {
  temperatureC: number
  isHeating: boolean
  selectedSetting: 'SETTING_1' | 'SETTING_2'
  onSelect: (setting: 'SETTING_1' | 'SETTING_2') => void
}

export default function HBoiler({
  temperatureC,
  isHeating,
  selectedSetting,
  onSelect,
}: Props) {
  return (
    <Card>
      <View style={styles.boilerCard}>
        <View style={styles.boilerHeaderRow}>
          <View>
            <Text style={styles.boilerTitle}>Warmwasserboiler</Text>
            <Text style={styles.boilerTempText}>
              Temperatur:{' '}
              <Text style={styles.boilerTempValue}>{temperatureC}°C</Text>
            </Text>
          </View>

          {/* Status oben rechts („Wärmt…“ / „Aus“) */}
          <View
            pointerEvents="none"
            style={[styles.boilerStatusContainer, { overflow: 'hidden' }]}
          >
            <MaterialCommunityIcons
              name={isHeating ? 'thermometer' : 'close'}
              size={18}
              color={isHeating ? '#d01212ff' : '#d01212ff'}
            />
            <Text
              style={[
                styles.boilerStatusText,
                isHeating
                  ? styles.boilerStatusTextHeating
                  : styles.boilerStatusTextIdle,
              ]}
            >
              {isHeating ? 'Wärmt…' : 'Aus'}
            </Text>
          </View>
        </View>

        {/* Die zwei Settings-Buttons */}
        <View style={styles.boilerSettingsContainer}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.boilerSettingButton,
              selectedSetting === 'SETTING_1' &&
                styles.boilerSettingButtonActive,
            ]}
            onPress={() => onSelect('SETTING_1')}
          >
            <Text
              style={[
                styles.boilerSettingText,
                selectedSetting === 'SETTING_1' &&
                  styles.boilerSettingTextActive,
              ]}
            >
              Setting 1
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.boilerSettingButton,
              selectedSetting === 'SETTING_2' &&
                styles.boilerSettingButtonActive,
            ]}
            onPress={() => onSelect('SETTING_2')}
          >
            <Text
              style={[
                styles.boilerSettingText,
                selectedSetting === 'SETTING_2' &&
                  styles.boilerSettingTextActive,
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
  boilerCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  boilerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  boilerTitle: {
    fontSize: 30,
    fontWeight: '600',
    color: '#474646',
    marginBottom: 2,
  },
  boilerTempText: {
    fontSize: 18,
    color: '#474646',
  },
  boilerTempValue: {
    color: '#1EAFF3',
    fontWeight: '600',
  },
  boilerStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
  boilerStatusText: {
    fontSize: 17,
    fontWeight: '500',
  },
  boilerStatusTextHeating: {
    color: '#d01212ff',
  },
  boilerStatusTextIdle: {
    color: '#474646',
  },
  boilerSettingsContainer: {
    gap: 8,
  },
  boilerSettingButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#E7E7E7',
  },
  boilerSettingButtonActive: {
    backgroundColor: '#D9ECFF',
    borderWidth: 1,
    borderColor: '#1EAFF3',
  },
  boilerSettingText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#474646',
  },
  boilerSettingTextActive: {
    color: '#1EAFF3',
    fontWeight: '600',
  },
})
