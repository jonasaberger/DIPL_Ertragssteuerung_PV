import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native'

const CIRCLE_SIZE = 72

type Point = { x: number; y: number }

export type DiagramData = {
  total: number
  house: number              // PV -> Haus (gedeckter Anteil)
  houseActual?: number       // echter Hausverbrauch (für Klammern)
  battery: number
  grid: number
  houseOverPv?: boolean
}

type Props = {
  data: DiagramData
}

type ParticleLineProps = {
  start: Point
  end: Point
  color: string
  duration?: number
}

function ParticleLine({ start, end, color, duration = 2200 }: ParticleLineProps) {
  const moveAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0)).current

  // Zufall pro Partikel (aber stabil, nicht pro Render neu)
  const minScale = useRef(0.6 + Math.random() * 0.3).current
  const maxScale = useRef(1.0 + Math.random() * 0.5).current
  const scaleDuration = useRef(800 + Math.random() * 700).current

  useEffect(() => {
    const moveLoop = Animated.loop(
      Animated.timing(moveAnim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )

    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: scaleDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: scaleDuration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    )

    moveLoop.start()
    scaleLoop.start()

    return () => {
      moveLoop.stop()
      scaleLoop.stop()
    }
  }, [moveAnim, scaleAnim, duration, scaleDuration])

  const translateX = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [start.x, end.x],
  })

  const translateY = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [start.y, end.y],
  })

  const scale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [minScale, maxScale],
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          backgroundColor: color,
          transform: [{ translateX }, { translateY }, { scale }],
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

const formatW = (v: number, showZero = false) => {
  if (!Number.isFinite(v)) return ''
  if (v <= 0) return showZero ? '0 W' : ''
  return `${v} W`
}

export default function HDiagram({ data }: Props) {
  const [diagramWidth, setDiagramWidth] = useState<number | null>(null)

  const handleDiagramLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout
    setDiagramWidth(width)
  }

  let sun: Point | null = null
  let house: Point | null = null
  let battery: Point | null = null
  let grid: Point | null = null

  if (diagramWidth !== null) {
    const w = diagramWidth
    const SUN_Y = 120
    const BOTTOM_CENTER_Y = 360
    const SIDE_Y = BOTTOM_CENTER_Y - 40

    sun = { x: w / 2, y: SUN_Y }
    battery = { x: w / 2, y: BOTTOM_CENTER_Y }
    house = { x: w * 0.23, y: SIDE_Y }
    grid = { x: w * 0.77, y: SIDE_Y }
  }

  const showHouseFlow = data.total > 0 && data.house > 0
  const showBatteryFlow = data.total > 0 && data.battery > 0
  const showGridFlow = data.total > 0 && data.grid > 0

  const isHouseWarning = !!data.houseOverPv
  const showHouseActual =
    isHouseWarning &&
    typeof data.houseActual === 'number' &&
    Number.isFinite(data.houseActual) &&
    data.houseActual > 0

  return (
    <Card height={520}>
      <View style={styles.header}>
        <Text style={styles.temp}>14°C</Text>
        <Text style={styles.icon}>☁️️</Text>
      </View>

      <View style={styles.diagram} onLayout={handleDiagramLayout}>
        {diagramWidth !== null && sun && house && battery && grid && (
          <>
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {showHouseFlow && (
                <ParticlesGroup
                  start={sun}
                  end={house}
                  color="#1EAFF3"
                  count={7}
                  duration={2600}
                />
              )}

              {showBatteryFlow && (
                <ParticlesGroup
                  start={sun}
                  end={battery}
                  color="#16c172"
                  count={9}
                  duration={2400}
                />
              )}

              {showGridFlow && (
                <ParticlesGroup
                  start={sun}
                  end={grid}
                  color="#ff7f3f"
                  count={6}
                  duration={2800}
                />
              )}
            </View>

            {/* Sonne */}
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
                  top: sun.y - CIRCLE_SIZE / 2 - 28,
                  left: sun.x - 60,
                  width: 120,
                  zIndex: 2,
                },
              ]}
            >
              {formatW(data.total, true)}
            </Text>

            {/* Haus */}
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
              <MaterialCommunityIcons name="home" size={42} color="#474646" />
            </View>

            {/* Haus-Text: Hauptwert + optional echter Verbrauch drunter */}
            <View
              style={{
                position: 'absolute',
                top: house.y + CIRCLE_SIZE / 2 + 8,
                left: house.x - 70,
                width: 140,
                alignItems: 'center',
              }}
            >
              <Text
                style={[
                  styles.valueText,
                  isHouseWarning ? styles.valueTextWarning : null,
                ]}
              >
                {formatW(data.house, true)}
              </Text>

              {showHouseActual && (
                <Text style={styles.subValueText}>
                  ({formatW(data.houseActual!, true)})
                </Text>
              )}
            </View>

            {/* Batterie */}
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
              {formatW(data.battery)}
            </Text>

            {/* Netz */}
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
              <MaterialCommunityIcons name="sitemap" size={42} color="#474646" />
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
              {formatW(data.grid)}
            </Text>
          </>
        )}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  temp: {
    fontSize: 20,
    fontWeight: '600',
    color: '#474646',
  },
  icon: {
    fontSize: 22,
  },

  diagram: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },

  valueText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#474646',
    textAlign: 'center',
  },

  subValueText: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
    color: '#474646',
    textAlign: 'center',
  },

  valueTextWarning: {
    color: '#C1121F',
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
})
