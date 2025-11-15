import { View, Text, StyleSheet } from 'react-native'
import { ThemedView } from '@/components/themed-view'
import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const CIRCLE_SIZE = 72

export default function HomeScreen() {
  return (
    <ThemedView style={styles.screen}>
      <Card height={520}>
        <View style={styles.header}>
          <Text style={styles.temp}>14°C</Text>
          <Text style={styles.icon}>☁️</Text>
        </View>

        <View style={styles.diagram}>
          <View style={styles.sunContainer}>
            <Text style={styles.valueText}>400 W</Text>
            <View style={[styles.circle, styles.sunCircle]}>
              <MaterialCommunityIcons
                name="weather-sunny"
                size={44}
                color="#474646"
              />
            </View>
          </View>

          <View style={[styles.nodeContainer, styles.houseContainer]}>
            <View style={[styles.circle, styles.houseCircle]}>
              <MaterialCommunityIcons
                name="home"
                size={42}
                color="#474646"
              />
            </View>
            <Text style={styles.valueText}>150 W</Text>
          </View>

          <View style={[styles.nodeContainer, styles.batteryContainer]}>
            <View style={[styles.circle, styles.batteryCircle]}>
              <MaterialCommunityIcons
                name="battery-charging"
                size={42}
                color="#474646"
              />
            </View>
            <Text style={styles.valueText}>200 W</Text>
          </View>

          <View style={[styles.nodeContainer, styles.gridContainer]}>
            <View style={[styles.circle, styles.gridCircle]}>
              <MaterialCommunityIcons
                name="sitemap"
                size={42}
                color="#474646"
              />
            </View>
            <Text style={styles.valueText}>50 W</Text>
          </View>
        </View>
      </Card>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EDE9E9',
    padding: 16,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },

  temp: {
    fontSize: 16,
    fontWeight: '500',
    color: '#474646',
  },

  icon: {
    fontSize: 18,
  },

  diagram: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },

  valueText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#474646',
    textAlign: 'center',
    marginVertical: 8,
  },

  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sunCircle: {
    backgroundColor: '#FFFF2E',
  },

  houseCircle: {
    backgroundColor: '#6CD3ED',
  },

  batteryCircle: {
    backgroundColor: '#2EFF74',
  },

  gridCircle: {
    backgroundColor: '#FF702E',
  },

  sunContainer: {
    position: 'absolute',
    top: 24,
    left: '50%',
    transform: [{ translateX: -(CIRCLE_SIZE + 40) / 2 }],
    width: CIRCLE_SIZE + 40,
    alignItems: 'center',
  },

  nodeContainer: {
    position: 'absolute',
    width: CIRCLE_SIZE + 40,
    alignItems: 'center',
  },

  houseContainer: {
    bottom: 120,
    left: 24,
  },

  batteryContainer: {
    bottom: 60,
    left: '50%',
    transform: [{ translateX: -(CIRCLE_SIZE + 40) / 2 }],
  },

  gridContainer: {
    bottom: 120,
    right: 24,
  },
})
