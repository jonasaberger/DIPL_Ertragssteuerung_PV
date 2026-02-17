import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

type Season = 'summer' | 'winter'

interface SeasonToggleProps {
  selectedSeason: Season
  onSeasonChange: (season: Season) => void
}

export default function SeasonToggle({ selectedSeason, onSeasonChange }: SeasonToggleProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.seasonButton,
          selectedSeason === 'summer' && styles.seasonButtonActiveSummer,
        ]}
        onPress={() => onSeasonChange('summer')}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="white-balance-sunny"
          size={20}
          color={selectedSeason === 'summer' ? '#FFFFFF' : '#8E8E93'}
        />
        <Text
          style={[
            styles.seasonButtonText,
            selectedSeason === 'summer' && styles.seasonButtonTextActive,
          ]}
        >
          Sommer
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.seasonButton,
          selectedSeason === 'winter' && styles.seasonButtonActiveWinter,
        ]}
        onPress={() => onSeasonChange('winter')}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="snowflake"
          size={20}
          color={selectedSeason === 'winter' ? '#FFFFFF' : '#8E8E93'}
        />
        <Text
          style={[
            styles.seasonButtonText,
            selectedSeason === 'winter' && styles.seasonButtonTextActive,
          ]}
        >
          Winter
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  seasonButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  seasonButtonActiveSummer: {
    backgroundColor: '#FF9500',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  seasonButtonActiveWinter: {
    backgroundColor: '#5BA3D0',
    shadowColor: '#5BA3D0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  seasonButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
  seasonButtonTextActive: {
    color: '#FFFFFF',
  },
})