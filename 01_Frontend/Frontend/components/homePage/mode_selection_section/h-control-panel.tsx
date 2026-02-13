import React from 'react'
import { View, StyleSheet } from 'react-native'
import Card from '@/components/card'
import HModeSelector from './h-mode-selector'
import { Mode } from '@/services/mode_service'
import HTimeSchedule from './h-time-schedule'

type Props = {
  currentMode: Mode
  onModeChange: (mode: Mode) => Promise<void>
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
        {currentMode === Mode.TIME_CONTROLLED && (
          <View style={styles.timeScheduleContainer}>
            <HTimeSchedule />
          </View>
        )}

        {/* Optional: Automatic Settings - nur anzeigen wenn AUTOMATIC aktiv ist */}
        {currentMode === Mode.AUTOMATIC && (
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