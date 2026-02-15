import React from 'react'
import { View, Text, StyleSheet, Switch } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface DeviceCardProps {
  icon: string
  title: string
  children?: React.ReactNode
  showToggle?: boolean
  enabled?: boolean
  onToggle?: () => void
}

export default function DeviceCard({
  icon,
  title,
  children,
  showToggle = false, // Default auf false, da wir bei Automatik keine Toggle brauchen
  enabled = true,     // Default true
  onToggle,
}: DeviceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name={icon as any} size={24} color="#1EAFF3" />
          <Text style={styles.title}>{title}</Text>
        </View>
        {showToggle && onToggle && (
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: '#D1D1D6', true: '#1EAFF3' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D1D6"
          />
        )}
      </View>
      {/* Kinder immer rendern, wenn keine Toggle */}
      {(!showToggle || enabled) && children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
})
