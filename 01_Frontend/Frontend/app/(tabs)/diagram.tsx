/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react'
import { StyleSheet } from 'react-native'

import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import Card from '@/components/card'
import { DDates } from '@/components/diagram/d-dates'

export default function DiagramScreen() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Diagramm
      </ThemedText>

      <Card>
        <DDates selectedDate={selectedDate} onChangeDate={setSelectedDate} />
      </Card>

      {/* später hier Card mit Diagramm, das selectedDate nutzt */}
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#EDE9E9',
  },
  title: {
    marginBottom: 8,
  },
})
