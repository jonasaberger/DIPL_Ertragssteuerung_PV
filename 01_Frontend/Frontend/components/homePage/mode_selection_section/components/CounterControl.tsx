import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'

interface CounterControlProps {
  value: number
  unit: string
  onIncrement: () => void
  onDecrement: () => void
  changed?: boolean
}

export default function CounterControl({
  value,
  unit,
  onIncrement,
  onDecrement,
  changed = false,
}: CounterControlProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onDecrement} activeOpacity={0.7}>
        <MaterialCommunityIcons name="minus" size={20} color="#1EAFF3" />
      </TouchableOpacity>
      <Text style={[styles.value, changed && styles.valueChanged]}>
        {value} {unit}
      </Text>
      <TouchableOpacity style={styles.button} onPress={onIncrement} activeOpacity={0.7}>
        <MaterialCommunityIcons name="plus" size={20} color="#1EAFF3" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    minWidth: 60,
    textAlign: 'center',
  },
  valueChanged: {
    color: '#FF3B30',
  },
})
