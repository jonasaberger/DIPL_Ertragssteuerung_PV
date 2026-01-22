import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
  ViewStyle,
} from 'react-native'

// Android braucht das explizit
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface SettingsCardProps {
  title: string
  children: React.ReactNode
  style?: ViewStyle
  defaultOpen?: boolean
}

export default function SettingsCard({
  title,
  children,
  style,
  defaultOpen = false,
}: SettingsCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  const width = Dimensions.get('window').width
  const clamp = Math.min(380, width - 24)

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen(prev => !prev)
  }

  return (
    <View style={[styles.card, { width: clamp }, style]}>
      <TouchableOpacity activeOpacity={0.8} onPress={toggle}>
        <Text style={styles.title}>{title}</Text>
      </TouchableOpacity>

      {open && <View style={styles.content}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 18,
    marginTop: 20,
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
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    marginTop: 14,
  },
})
