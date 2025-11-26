import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
} from 'react-native'
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist'
import { ThemedView } from '@/components/themed-view'
import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'

const CIRCLE_SIZE = 72

const data = {
  total: 400,
  house: 150,
  battery: 200,
  grid: 50,
}

type Point = { x: number; y: number }

type ParticleLineProps = {
  start: Point
  end: Point
  color: string
  duration?: number
}

function ParticleLine({ start, end, color, duration = 2200 }: ParticleLineProps) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    loop.start()
    return () => loop.stop()
  }, [anim, duration])

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [start.x, end.x],
  })

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [start.y, end.y],
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          backgroundColor: color,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    />
  )
}

function ParticlesGroup({
  start,
  end,
  color,
  count = 6,
  duration = 2200,
}: {
  start: Point
  end: Point
  color: string
  count?: number
  duration?: number
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const extra = (duration / count) * i
        return (
          <ParticleLine
            key={i}
            start={start}
            end={end}
            color={color}
            duration={duration + extra}
          />
        )
      })}
    </>
  )
}

// ----- Ladeprioritäten -----

type PriorityItem = {
  id: string
  label: string
}

const INITIAL_PRIORITIES: PriorityItem[] = [
  { id: 'boiler', label: 'Boiler' },
  { id: 'wallbox', label: 'e-Go Wallbox' },
  { id: 'speicher', label: 'Speicher' },
]

export default function HomeScreen() {
  const [diagramWidth, setDiagramWidth] = useState<number | null>(null)
  const [priorities, setPriorities] =
    useState<PriorityItem[]>(INITIAL_PRIORITIES)

  const handleDiagramLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout
    setDiagramWidth(width)
  }

  const handlePriorityDragEnd = ({ data }: { data: PriorityItem[] }) => {
    setPriorities(data)

    // Reihenfolge fürs Backend:
    const orderIds = data.map((item) => item.id)
    console.log('Ladeprioritäten:', orderIds)
    // hier später API-Call / speichern
  }

  const renderPriorityItem = ({
    item,
    drag,
    isActive,
    index,
  }: RenderItemParams<PriorityItem>) => {
    return (
      <Pressable
        onLongPress={drag}
        disabled={isActive}
        style={({ pressed }) => [
          styles.priorityRow,
          (pressed || isActive) && styles.priorityRowActive,
        ]}
      >
        <View style={styles.priorityNumber}>
          <Text style={styles.priorityNumberText}>{index + 1}</Text>
        </View>
        <Text style={styles.priorityLabel}>{item.label}</Text>
      </Pressable>
    )
  }

  let sun: Point | null = null
  let house: Point | null = null
  let battery: Point | null = null
  let grid: Point | null = null

  if (diagramWidth !== null) {
    const w = diagramWidth

    const SUN_Y = 120
    const BOTTOM_CENTER_Y = 360 // grün
    const SIDE_Y = BOTTOM_CENTER_Y - 40 // blau/orange etwas höher

    sun = { x: w / 2, y: SUN_Y }
    battery = { x: w / 2, y: BOTTOM_CENTER_Y }
    house = { x: w * 0.23, y: SIDE_Y }
    grid = { x: w * 0.77, y: SIDE_Y }
  }

  return (
    <ThemedView style={styles.screen}>
      {/* Card 1: Diagramm */}
      <Card height={520}>
        <View style={styles.header}>
          <Text style={styles.temp}>14°C</Text>
          <Text style={styles.icon}>☁️</Text>
        </View>

        <View style={styles.diagram} onLayout={handleDiagramLayout}>
          {diagramWidth !== null && sun && house && battery && grid && (
            <>
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <ParticlesGroup
                  start={sun}
                  end={house}
                  color="#1EAFF3"
                  count={7}
                  duration={2600}
                />
                <ParticlesGroup
                  start={sun}
                  end={battery}
                  color="#16c172"
                  count={9}
                  duration={2400}
                />
                <ParticlesGroup
                  start={sun}
                  end={grid}
                  color="#ff7f3f"
                  count={6}
                  duration={2800}
                />
              </View>

              <View
                style={[
                  styles.circle,
                  styles.sunCircle,
                  {
                    left: sun.x - CIRCLE_SIZE / 2,
                    top: sun.y - CIRCLE_SIZE / 2,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="weather-sunny"
                  size={44}
                  color="#474646"
                />
              </View>
              <Text
                style={[
                  styles.valueText,
                  {
                    position: 'absolute',
                    top: sun.y + CIRCLE_SIZE / 2 + 8,
                    left: sun.x - 60,
                    width: 120,
                  },
                ]}
              >
                {data.total} W
              </Text>

              <View
                style={[
                  styles.circle,
                  styles.houseCircle,
                  {
                    left: house.x - CIRCLE_SIZE / 2,
                    top: house.y - CIRCLE_SIZE / 2,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="home"
                  size={42}
                  color="#474646"
                />
              </View>
              <Text
                style={[
                  styles.valueText,
                  {
                    position: 'absolute',
                    top: house.y + CIRCLE_SIZE / 2 + 8,
                    left: house.x - 60,
                    width: 120,
                  },
                ]}
              >
                {data.house} W
              </Text>

              <View
                style={[
                  styles.circle,
                  styles.batteryCircle,
                  {
                    left: battery.x - CIRCLE_SIZE / 2,
                    top: battery.y - CIRCLE_SIZE / 2,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="battery-charging"
                  size={42}
                  color="#474646"
                />
              </View>
              <Text
                style={[
                  styles.valueText,
                  {
                    position: 'absolute',
                    top: battery.y + CIRCLE_SIZE / 2 + 8,
                    left: battery.x - 60,
                    width: 120,
                  },
                ]}
              >
                {data.battery} W
              </Text>

              <View
                style={[
                  styles.circle,
                  styles.gridCircle,
                  {
                    left: grid.x - CIRCLE_SIZE / 2,
                    top: grid.y - CIRCLE_SIZE / 2,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="sitemap"
                  size={42}
                  color="#474646"
                />
              </View>
              <Text
                style={[
                  styles.valueText,
                  {
                    position: 'absolute',
                    top: grid.y + CIRCLE_SIZE / 2 + 8,
                    left: grid.x - 60,
                    width: 120,
                  },
                ]}
              >
                {data.grid} W
              </Text>
            </>
          )}
        </View>
      </Card>

      {/* Card 2: Ladeprioritäten */}
      <Card>
        <Text style={styles.priorityTitle}>Ladeprioritäten</Text>
        <DraggableFlatList
          data={priorities}
          keyExtractor={(item) => item.id}
          renderItem={renderPriorityItem}
          onDragEnd={handlePriorityDragEnd}
          scrollEnabled={false}
        />
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
    fontSize: 18,
    fontWeight: '700',
    color: '#474646',
    textAlign: 'center',
  },
  circle: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
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
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  // ----- Ladeprioritäten Styles -----
  priorityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#474646',
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  priorityRowActive: {
    opacity: 0.8,
  },
  priorityNumber: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#D7D7D7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  priorityNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#474646',
  },
  priorityLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#474646',
  },
})
