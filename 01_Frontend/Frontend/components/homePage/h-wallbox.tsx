import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import UnavailableState from '@/components/unavailable-state'

type Props = {
  energyKWh: number
  isCharging: boolean
  carConnected: boolean
  ampere: number
  phases?: number
  selectedSetting: 'MANUAL_OFF' | 'MANUAL_ON'
  onSelect: (setting: 'MANUAL_OFF' | 'MANUAL_ON') => void
  onAmpereChange: (ampere: number) => void
  available: boolean
  showControls?: boolean
}

export default function HWallbox({
  energyKWh,
  isCharging,
  carConnected,
  ampere,
  phases = 3,
  selectedSetting,
  onSelect,
  onAmpereChange,
  available,
  showControls = true,
}: Props) {
  const [showAmpereModal, setShowAmpereModal] = useState(false)
  const [tempAmpere, setTempAmpere] = useState(ampere)

  const amperePresets = [6, 10, 12, 14, 16]

  const handleAmpereSubmit = () => {
    if (amperePresets.includes(tempAmpere)) {
      onAmpereChange(tempAmpere)
      setShowAmpereModal(false)
    }
  }

  return (
    <Card>
      <View style={styles.wallboxCard}>
        {!available ? (
          <UnavailableState title="Wallbox nicht verfügbar" />
        ) : (
          <>
            {/* Header */}
            <View style={styles.headerSection}>
              <Text style={styles.wallboxTitle}>E-GO Wallbox</Text>

              <View
                style={[
                  styles.statusBadge,
                  isCharging ? styles.statusBadgeCharging : styles.statusBadgeIdle,
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
                    isCharging ? styles.statusTextCharging : styles.statusTextIdle,
                  ]}
                >
                  {isCharging ? 'Lädt' : 'Inaktiv'}
                </Text>
              </View>
            </View>

            {/* Energie */}
            <View style={styles.energySection}>
              <View style={styles.energyDisplay}>
                <Text style={styles.energyValue}>{energyKWh.toFixed(1)}</Text>
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
                  <Text style={[styles.statusValue, { color: carConnected ? '#16C75C' : '#8E8E93' }]}>
                    {carConnected ? 'Verbunden' : 'Getrennt'}
                  </Text>
                </View>
              </View>

              {isCharging && (
                <View style={styles.statusItem}>
                  <View style={styles.statusIconContainer}>
                    <MaterialCommunityIcons name="lightning-bolt" size={20} color="#1EAFF3" />
                  </View>
                  <View style={styles.statusContent}>
                    <Text style={styles.statusLabel}>Leistung</Text>
                    <Text style={[styles.statusValue, { color: '#1EAFF3' }]}>
                      {ampere}A · {phases}Ph
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {showControls && (
              <>
                <View style={styles.divider} />

                {carConnected ? (
                  <>
                    <View style={styles.settingsSection}>
                      <Text style={styles.settingsTitle}>Lademodus</Text>

                      <View style={styles.settingsButtons}>
                        {(['MANUAL_ON', 'MANUAL_OFF'] as const).map((mode) => (
                          <TouchableOpacity
                            key={mode}
                            activeOpacity={0.7}
                            style={[
                              styles.settingButton,
                              selectedSetting === mode && styles.settingButtonActive,
                            ]}
                            onPress={() => onSelect(mode)}
                          >
                            <View style={styles.settingButtonContent}>
                              <View
                                style={[
                                  styles.radioButton,
                                  selectedSetting === mode && styles.radioButtonActive,
                                ]}
                              >
                                {selectedSetting === mode && <View style={styles.radioButtonInner} />}
                              </View>
                              <Text style={styles.settingButtonText}>
                                {mode === 'MANUAL_ON' ? 'Manuell EIN' : 'Manuell AUS'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={[styles.settingsSection, { marginTop: 12 }]}>
                      <Text style={styles.settingsTitle}>Ladestrom</Text>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.ampereControl}
                        onPress={() => {
                          setTempAmpere(ampere)
                          setShowAmpereModal(true)
                        }}
                      >
                        <View style={styles.ampereControlContent}>
                          <MaterialCommunityIcons name="speedometer" size={20} color="#1EAFF3" />
                          <View style={styles.ampereTextContainer}>
                            <Text style={styles.ampereValue}>{ampere} A</Text>
                            <Text style={styles.ampereSubtext}>Passe den Ladestrom an (6-16A)</Text>
                          </View>
                          <MaterialCommunityIcons name="chevron-right" size={20} color="#8E8E93" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <Text style={styles.settingsHint}>
                    Fahrzeug nicht verbunden – Einstellungen nicht verfügbar
                  </Text>
                )}
              </>
            )}
          </>
        )}
      </View>

      {/* Modal */}
      <Modal
        visible={showAmpereModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAmpereModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ladestrom einstellen</Text>

            <View style={styles.presetsGrid}>
              {amperePresets.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.presetButton, tempAmpere === preset && styles.presetButtonActive]}
                  onPress={() => setTempAmpere(preset)}
                >
                  <Text style={[styles.presetButtonText, tempAmpere === preset && styles.presetButtonTextActive]}>
                    {preset}A
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowAmpereModal(false)}>
                <Text style={styles.modalButtonSecondaryText}>Abbrechen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButtonPrimary, !amperePresets.includes(tempAmpere) && { opacity: 0.5 }]}
                disabled={!amperePresets.includes(tempAmpere)}
                onPress={handleAmpereSubmit}
              >
                <Text style={styles.modalButtonPrimaryText}>Übernehmen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Card>
  )
}

const styles = StyleSheet.create({
  wallboxCard: { padding: 14 },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wallboxTitle: { fontSize: 22, fontWeight: '700', color: '#1C1C1E' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusBadgeCharging: { backgroundColor: '#E8F8ED' },
  statusBadgeIdle: { backgroundColor: '#FFE8E8' },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },
  statusTextCharging: { color: '#16C75C' },
  statusTextIdle: { color: '#FF3B30' },
  energySection: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  energyDisplay: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  energyValue: { fontSize: 32, fontWeight: '700', color: '#1EAFF3' },
  energyUnit: { fontSize: 18, fontWeight: '600', color: '#1EAFF3' },
  energyLabel: { fontSize: 12, fontWeight: '500', color: '#1C1C1E' },
  statusGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
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
  statusContent: { flex: 1 },
  statusLabel: { fontSize: 10, color: '#1C1C1E' },
  statusValue: { fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 12 },
  settingsSection: { gap: 8 },
  settingsButtons: { gap: 8 },
  settingsTitle: { fontSize: 14, fontWeight: '600' },
  settingButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  settingButtonActive: { backgroundColor: '#E3F2FD', borderColor: '#1EAFF3' },
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
  radioButtonActive: { borderColor: '#1EAFF3' },
  radioButtonInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1EAFF3' },
  settingButtonText: { fontSize: 15, fontWeight: '600' },
  settingsHint: { fontSize: 12, color: '#8E8E93', textAlign: 'center' },
  ampereControl: { backgroundColor: '#F8F9FA', borderRadius: 10 },
  ampereControlContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  ampereTextContainer: { flex: 1 },
  ampereValue: { fontSize: 15, fontWeight: '600' },
  ampereSubtext: { fontSize: 11, color: '#8E8E93' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 20 },
  presetsGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  presetButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  presetButtonActive: { backgroundColor: '#E3F2FD', borderColor: '#1EAFF3', borderWidth: 2 },
  presetButtonText: { fontSize: 15, fontWeight: '600' },
  presetButtonTextActive: { color: '#1EAFF3' },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonSecondaryText: { fontSize: 15, fontWeight: '600' },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: '#1EAFF3',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonPrimaryText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
})