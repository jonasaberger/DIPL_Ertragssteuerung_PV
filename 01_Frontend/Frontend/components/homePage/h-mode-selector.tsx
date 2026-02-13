import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Mode } from '@/services/mode_service'

type Props = {
  currentMode: Mode
  onModeChange: (mode: Mode) => Promise<void>
}

export default function HModeSelector({ currentMode, onModeChange }: Props) {
  const getModeIcon = (mode: Mode) => {
    switch (mode) {
      case Mode.MANUAL:
        return 'hand-back-right'
      case Mode.TIME_CONTROLLED:
        return 'clock-outline'
      case Mode.AUTOMATIC:
        return 'auto-fix'
    }
  }

  const getModeLabel = (mode: Mode) => {
    switch (mode) {
      case Mode.MANUAL:
        return 'Manuell'
      case Mode.TIME_CONTROLLED:
        return 'Zeit'
      case Mode.AUTOMATIC:
        return 'Auto'
    }
  }

  const modes: Mode[] = [Mode.MANUAL, Mode.TIME_CONTROLLED, Mode.AUTOMATIC]

  return (
    <View style={styles.container}>
      <View style={styles.switchContainer}>
        {modes.map((mode) => {
          const isActive = currentMode === mode
          return (
            <TouchableOpacity
              key={mode}
              activeOpacity={0.7}
              style={[
                styles.switchButton,
                isActive && styles.switchButtonActive,
              ]}
              onPress={() => onModeChange(mode)}
            >
              <MaterialCommunityIcons
                name={getModeIcon(mode)}
                size={24}
                color={isActive ? '#FFFFFF' : '#8E8E93'}
              />
              <Text
                style={[
                  styles.switchText,
                  isActive && styles.switchTextActive,
                ]}
              >
                {getModeLabel(mode)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 100,
  },
  switchButtonActive: {
    backgroundColor: '#1EAFF3',
  },
  switchText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  switchTextActive: {
    color: '#FFFFFF',
  },
})