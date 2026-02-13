import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import Card from '@/components/card'
import HModeSelector from './h-mode-selector'
import { Mode } from '@/services/mode_service'
import HTimeSchedule from './h-time-schedule'
import HAutomaticSettings from './h-automatic'

type Props = {
  currentMode: Mode
  onModeChange: (mode: Mode) => Promise<void>
}

export default function HControlPanel({ currentMode, onModeChange }: Props) {
  const [isTimeScheduleExpanded, setIsTimeScheduleExpanded] = useState(false)
  const [isAutomaticExpanded, setIsAutomaticExpanded] = useState(false)

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
          <View style={styles.expandableSection}>
            <TouchableOpacity
              style={styles.dividerButton}
              onPress={() => setIsTimeScheduleExpanded(!isTimeScheduleExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.dividerLine} />
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name={isTimeScheduleExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#1EAFF3"
                />
              </View>
              <View style={styles.dividerLine} />
            </TouchableOpacity>

            {isTimeScheduleExpanded && (
              <View style={styles.expandedContent}>
                <HTimeSchedule />
              </View>
            )}
          </View>
        )}

        {/* Automatic Settings - nur anzeigen wenn AUTOMATIC aktiv ist */}
        {currentMode === Mode.AUTOMATIC && (
          <View style={styles.expandableSection}>
            <TouchableOpacity
              style={styles.dividerButton}
              onPress={() => setIsAutomaticExpanded(!isAutomaticExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.dividerLine} />
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name={isAutomaticExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#1EAFF3"
                />
              </View>
              <View style={styles.dividerLine} />
            </TouchableOpacity>

            {isAutomaticExpanded && (
              <View style={styles.expandedContent}>
                <HAutomaticSettings />
              </View>
            )}
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
  expandableSection: {
    marginTop: 16,
  },
  dividerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5EA',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    marginTop: 16,
  },
})