import React from 'react'
import { View, StyleSheet, Dimensions, Platform, ViewStyle } from 'react-native'

interface CardProps {
  children: React.ReactNode
  height?: number
  style?: ViewStyle
}

export default function Card({ children, height, style }: CardProps) {
  const width = Dimensions.get('window').width
  const clamp = Math.min(380, width - 24)

  return (
    <View style={[styles.card, { width: clamp }, height ? { height } : {}, style]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 18,
    marginTop: 40,
    marginVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
    }),
  },
})
