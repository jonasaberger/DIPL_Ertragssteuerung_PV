import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'

// Props kommen aus index.tsx (damit das Datenhandling dort bleibt)
type Props = {
  date: string
  time: string
  location: string
  pricePerKWh: number
}

export default function HPrices({
  date,
  time,
  location,
  pricePerKWh,
}: Props) {
  return (
    // Die Card mit dem Strompreis
    <Card>
      <View style={styles.priceCard}>
        <View>
          <Text style={styles.priceTitle}>Strompreis aktuell</Text>

          <View style={styles.priceMetaRow}>
            <Text style={styles.priceMetaText}>{date}</Text>
            <Text style={styles.priceMetaText}>{time}</Text>
          </View>
        </View>

        <View style={styles.priceBottomRow}>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={18}
              color="#1EAFF3"
            />
            <Text style={styles.locationText}>{location}</Text>
          </View>

          <Text style={styles.priceValue}>{pricePerKWh}€ / kWh</Text>
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  priceCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
    gap: 12,
  },
  priceTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E1E1E',
    marginBottom: 2,
  },
  priceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  priceMetaText: {
    fontSize: 14,
    color: '#7A7A7A',
  },
  priceBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1EAFF3',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1EAFF3',
  },
})
