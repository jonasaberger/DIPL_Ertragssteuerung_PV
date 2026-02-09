import React from 'react'
import { View, StyleSheet } from 'react-native'
import Card from '@/components/card'
import HModeSelector from './h-mode-selector'

type Mode = 'MANUAL' | 'TIME_CONTROLLED' | 'AUTOMATIC'

type Props = {
  currentMode: Mode
  onModeChange: (mode: Mode) => void
}

export default function HControlPanel({ currentMode, onModeChange }: Props) {
  return (
    <Card>
      <View style={styles.container}>
        {/* Mode Selector Bar */}
        <HModeSelector
          currentMode={currentMode}
          onModeChange={onModeChange}
        />

        {/* Time Schedule Settings - nur anzeigen wenn TIME_CONTROLLED aktiv ist */}
        {currentMode === 'TIME_CONTROLLED' && (
          <View style={styles.timeScheduleContainer}>
            {/* TODO: HTimeSchedule Component hier einfügen */}
            {/* <HTimeSchedule /> */}
          </View>
        )}

        {/* Optional: Automatic Settings - nur anzeigen wenn AUTOMATIC aktiv ist */}
        {currentMode === 'AUTOMATIC' && (
          <View style={styles.automaticSettingsContainer}>
            {/* TODO: Automatic Settings Component hier einfügen falls benötigt */}
            {/* <HAutomaticSettings /> */}
          </View>
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
  },
  timeScheduleContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  automaticSettingsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
})