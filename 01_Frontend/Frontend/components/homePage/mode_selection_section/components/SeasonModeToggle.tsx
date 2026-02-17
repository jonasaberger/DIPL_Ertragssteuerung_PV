import React from 'react'
import { View, Text, StyleSheet, Switch } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

type Season = 'summer' | 'winter'

interface SeasonModeToggleProps {
  season: Season
  enabled: boolean
  onToggle: () => void
}

export default function SeasonModeToggle({ season, enabled, onToggle }: SeasonModeToggleProps) {
  const isSummer = season === 'summer'
  const backgroundColor = isSummer ? '#FFF5E6' : '#E6F2F9'
  const iconColor = isSummer ? '#FF9500' : '#5BA3D0'
  const icon = isSummer ? 'white-balance-sunny' : 'snowflake'
  const seasonText = isSummer ? 'Sommer' : 'Winter'

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.leftContent}>
        <View style={[styles.iconCircle, { backgroundColor: iconColor + '20' }]}>
          <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
        </View>
        <View>
          <Text style={styles.seasonText}>{seasonText}-Modus</Text>
          <Text style={styles.statusText}>{enabled ? 'Aktiv' : 'Deaktiviert'}</Text>
        </View>
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: '#D1D1D6', true: iconColor }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#D1D1D6"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  statusText: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
})