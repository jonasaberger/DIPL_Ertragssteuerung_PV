import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'

type Props = {
  energyKWh: number
  isCharging: boolean
  carConnected: boolean
  ampere: number
  phases?: number
  selectedSetting: 'SETTING_1' | 'SETTING_2'
  onSelect: (setting: 'SETTING_1' | 'SETTING_2') => void
  available: boolean
}

export default function HWallbox({
  energyKWh,
  isCharging,
  carConnected,
  ampere,
  phases = 3,
  selectedSetting,
  onSelect,
  available,
}: Props) {
  return (
    <Card>
      <View style={styles.wallboxCard}>
        {!available ? (
          /* ================= NOT AVAILABLE STATE ================= */
          <View style={styles.unavailableContainer}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={36}
              color="#8E8E93"
            />
            <Text style={styles.unavailableTitle}>
              Wallbox nicht verfügbar
            </Text>
            <Text style={styles.unavailableSubtitle}>
              Verbindung zur Wallbox konnte nicht hergestellt werden
            </Text>
          </View>
        ) : (
          /* ================= NORMAL STATE ================= */
          <>
            {/* Header */}
            <View style={styles.headerSection}>
              <Text style={styles.wallboxTitle}>E-GO Wallbox</Text>

              <View
                style={[
                  styles.statusBadge,
                  isCharging
                    ? styles.statusBadgeCharging
                    : styles.statusBadgeIdle,
                ]}
              >
                <MaterialCommunityIcons
                  name={isCharging ? 'flash' : 'flash-off'}
                  size={16}
                  color={isCharging ? '#16C75C' : '#FF3B30'}
                />
                <Text
                  style={[
                    styles.statusBadgeText,
                    isCharging
                      ? styles.statusTextCharging
                      : styles.statusTextIdle,
                  ]}
                >
                  {isCharging ? 'Lädt' : 'Inaktiv'}
                </Text>
              </View>
            </View>

            {/* Energie */}
            <View style={styles.energySection}>
              <View style={styles.energyDisplay}>
                <Text style={styles.energyValue}>
                  {energyKWh.toFixed(1)}
                </Text>
                <Text style={styles.energyUnit}>kWh</Text>
              </View>
              <Text style={styles.energyLabel}>Gesamtenergie</Text>
            </View>

            {/* Status */}
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <View style={styles.statusIconContainer}>
                  <MaterialCommunityIcons
                    name="car-electric"
                    size={20}
                    color={carConnected ? '#16C75C' : '#8E8E93'}
                  />
                </View>
                <View style={styles.statusContent}>
                  <Text style={styles.statusLabel}>Fahrzeug</Text>
                  <Text
                    style={[
                      styles.statusValue,
                      { color: carConnected ? '#16C75C' : '#8E8E93' },
                    ]}
                  >
                    {carConnected ? 'Verbunden' : 'Getrennt'}
                  </Text>
                </View>
              </View>

              {isCharging && (
                <View style={styles.statusItem}>
                  <View style={styles.statusIconContainer}>
                    <MaterialCommunityIcons
                      name="lightning-bolt"
                      size={20}
                      color="#1EAFF3"
                    />
                  </View>
                  <View style={styles.statusContent}>
                    <Text style={styles.statusLabel}>Leistung</Text>
                    <Text
                      style={[
                        styles.statusValue,
                        { color: '#1EAFF3' },
                      ]}
                    >
                      {ampere}A · {phases}Ph
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Settings */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsTitle}>Lademodus</Text>

              <View style={styles.settingsButtons}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.settingButton,
                    selectedSetting === 'SETTING_1' &&
                      styles.settingButtonActive,
                  ]}
                  onPress={() => onSelect('SETTING_1')}
                >
                  <View style={styles.settingButtonContent}>
                    <View
                      style={[
                        styles.radioButton,
                        selectedSetting === 'SETTING_1' &&
                          styles.radioButtonActive,
                      ]}
                    >
                      <View style={styles.radioButtonInner} />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={styles.settingButtonText}>
                        Laden erlauben
                      </Text>
                      <Text style={styles.settingButtonSubtext}>
                        Automatisches Laden bei Verbindung
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.settingButton,
                    selectedSetting === 'SETTING_2' &&
                      styles.settingButtonActive,
                  ]}
                  onPress={() => onSelect('SETTING_2')}
                >
                  <View style={styles.settingButtonContent}>
                    <View
                      style={[
                        styles.radioButton,
                        selectedSetting === 'SETTING_2' &&
                          styles.radioButtonActive,
                      ]}
                    >
                      <View style={styles.radioButtonInner} />
                    </View>
                    <View style={styles.settingTextContainer}>
                      <Text style={styles.settingButtonText}>
                        Laden sperren
                      </Text>
                      <Text style={styles.settingButtonSubtext}>
                        Laden blockieren bei Verbindung.
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  wallboxCard: {
    padding: 14,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wallboxTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusBadgeCharging: {
    backgroundColor: '#E8F8ED',
  },
  statusBadgeIdle: {
    backgroundColor: '#FFE8E8',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextCharging: {
    color: '#16C75C',
  },
  statusTextIdle: {
    color: '#FF3B30',
  },
  energySection: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  energyDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  energyValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1EAFF3',
    letterSpacing: -1,
  },
  energyUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1EAFF3',
    opacity: 0.8,
  },
  energyLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1C1C1E',
    marginTop: 2,
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
  },
  statusIconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  statusContent: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#1C1C1E',
    marginBottom: 1,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginVertical: 12,
  },
  settingsSection: {
    gap: 8,
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  settingsButtons: {
    gap: 8,
  },
  settingButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  settingButtonActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1EAFF3',
  },
  settingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonActive: {
    borderColor: '#1EAFF3',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1EAFF3',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 1,
  },
  settingButtonTextActive: {
    color: '#1EAFF3',
  },
  settingButtonSubtext: {
    fontSize: 11,
    fontWeight: '400',
    color: '#8E8E93',
  },
unavailableContainer: {
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 32,
  gap: 6,
},

unavailableTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#1C1C1E',
},

unavailableSubtitle: {
  fontSize: 12,
  color: '#8E8E93',
  textAlign: 'center',
},
})