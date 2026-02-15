import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface SettingRowProps {
  icon: string
  label: string
  value?: string
  onPress?: () => void
  changed?: boolean
  children?: React.ReactNode
}

export default function SettingRow({
  icon,
  label,
  value,
  onPress,
  changed = false,
  children,
}: SettingRowProps) {
  const content = (
    <View style={styles.container}>
      <View style={styles.leftContent}>
        <MaterialCommunityIcons name={icon as any} size={20} color="#666" />
        <Text style={styles.label}>{label}</Text>
      </View>
      {children || (
        <View style={styles.rightContent}>
          {value && (
            <Text style={[styles.value, changed && styles.valueChanged]}>{value}</Text>
          )}
          {onPress && <MaterialCommunityIcons name="chevron-right" size={20} color="#C7C7CC" />}
        </View>
      )}
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    )
  }

  return content
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 15,
    color: '#333',
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1EAFF3',
  },
  valueChanged: {
    color: '#FF3B30',
  },
})