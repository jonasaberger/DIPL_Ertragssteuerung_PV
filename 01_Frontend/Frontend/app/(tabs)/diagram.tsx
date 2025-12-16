 import React, { useState } from 'react'
import { StyleSheet } from 'react-native'

import { ThemedView } from '@/components/themed-view'
import Card from '@/components/card'
import { DDates, DateSelection } from '@/components/diagram/d-dates'

export default function DiagramScreen() {
  const now = new Date()

  const [selection, setSelection] = useState<DateSelection>({
    // Start: heute als Tag
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(), 
  })

  return (
    <ThemedView style={styles.container}>
      <Card>
        <DDates selection={selection} onChangeSelection={setSelection} />
      </Card>

    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#EDE9E9',
  },
})
