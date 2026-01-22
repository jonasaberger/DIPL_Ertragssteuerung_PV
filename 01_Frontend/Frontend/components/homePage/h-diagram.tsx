import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import React, { useEffect, useMemo, useRef, useState } from 'react'
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
  house: number               // PV -> Haus (gedeckt)
  houseActual?: number        // echter Hausverbrauch
  battery: number             // PV -> Batterie (Laden)
  grid: number                // PV -> Netz (Einspeisung)

  gridImport?: number         // Netzbezug (positiv)
  gridToHouse?: number        // Netz -> Haus Flow
}

type Props = {
  data: DiagramData
}

type ParticleLineProps = {
  start?: Point
  end?: Point
  path?: Point[]
  color: string
  duration?: number
}

function ParticleLine({
  start,
  end,
  path,
  color,
  duration = 2200,
}: ParticleLineProps) {
  const moveAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0)).current

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

  const scale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [minScale, maxScale],
  })

  const translateXStraight = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [start?.x ?? 0, end?.x ?? 0],
  })

  const translateYStraight = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [start?.y ?? 0, end?.y ?? 0],
  })

  const curve = path && path.length >= 2 ? path : null

  const { inputRange, xOut, yOut } = useMemo(() => {
    if (!curve)
      return {
        inputRange: null as number[] | null,
        xOut: null as number[] | null,
        yOut: null as number[] | null,
      }
    const n = curve.length
    const ir = Array.from({ length: n }).map((_, i) => i / (n - 1))
    const xo = curve.map((p) => p.x)
    const yo = curve.map((p) => p.y)
    return { inputRange: ir, xOut: xo, yOut: yo }
  }, [curve])

  const translateX =
    curve && inputRange && xOut
      ? moveAnim.interpolate({ inputRange, outputRange: xOut })
      : translateXStraight

  const translateY =
    curve && inputRange && yOut
      ? moveAnim.interpolate({ inputRange, outputRange: yOut })
      : translateYStraight

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

function ParticlesCurveGroup({
  path,
  color,
  count = 6,
  duration = 2200,
}: {
  path: Point[]
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
            path={path}
            color={color}
            duration={duration + extra}
          />
        )
      })}
    </>
  )
}

const round1 = (v: number) => Math.round(v * 10) / 10
const formatW = (v: number) => `${round1(v)} W`

export default function HDiagram({ data }: Props) {
  const [diagramWidth, setDiagramWidth] = useState<number | null>(null)

  const handleDiagramLayout = (e: LayoutChangeEvent) => {
    setDiagramWidth(e.nativeEvent.layout.width)
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

  const pvToHouse = Math.max(0, data.house)
  const pvToBattery = Math.max(0, data.battery)
  const pvToGrid = Math.max(0, data.grid)

  const gridImport = Math.max(0, data.gridImport ?? 0)
  const gridToHouse = Math.max(0, data.gridToHouse ?? 0)

  const houseActualValue = Math.max(0, data.houseActual ?? 0)

  const showPvHouse = data.total > 0 && pvToHouse > 0
  const showPvBattery = data.total > 0 && pvToBattery > 0
  const showPvGrid = data.total > 0 && pvToGrid > 0
  const showGridHouse = gridToHouse > 0

  const gridToHousePath = useMemo(() => {
    if (!grid || !house) return null

    const start = grid
    const end = house
    const control: Point = {
      x: (start.x + end.x) / 2,
      y: Math.min(start.y, end.y) - 140,
    }

    const steps = 16
    const pts: Point[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const one = 1 - t
      pts.push({
        x: one * one * start.x + 2 * one * t * control.x + t * t * end.x,
        y: one * one * start.y + 2 * one * t * control.y + t * t * end.y,
      })
    }
    return pts
  }, [grid, house])

  return (
    <Card height={520}>
      <View style={styles.diagram} onLayout={handleDiagramLayout}>
        {diagramWidth !== null && sun && house && battery && grid && (
          <>
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {showPvHouse && (
                <ParticlesGroup
                  start={sun}
                  end={house}
                  color="#1EAFF3"
                  count={7}
                  duration={2600}
                />
              )}

              {showPvBattery && (
                <ParticlesGroup
                  start={sun}
                  end={battery}
                  color="#16c172"
                  count={9}
                  duration={2400}
                />
              )}

              {showPvGrid && (
                <ParticlesGroup
                  start={sun}
                  end={grid}
                  color="#ff7f3f"
                  count={6}
                  duration={2800}
                />
              )}

              {showGridHouse && gridToHousePath && (
                <ParticlesCurveGroup
                  path={gridToHousePath}
                  color="#ff7f3f"
                  count={6}
                  duration={2400}
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
                  left: sun.x - 70,
                  width: 140,
                },
              ]}
            >
              {formatW(Math.max(0, data.total))}
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
            <Text
              style={[
                styles.valueText,
                {
                  position: 'absolute',
                  top: house.y + CIRCLE_SIZE / 2 + 8,
                  left: house.x - 60,
                  width: 120,
                  textAlign: 'center',
                },
              ]}
            >
              {formatW(houseActualValue)}
            </Text>

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
                pvToBattery > 0 ? styles.valueText : styles.valueTextMuted,
                {
                  position: 'absolute',
                  top: battery.y + CIRCLE_SIZE / 2 + 8,
                  left: battery.x - 60,
                  width: 120,
                },
              ]}
            >
              {formatW(pvToBattery)}
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

            <View
              style={{
                position: 'absolute',
                top: grid.y + CIRCLE_SIZE / 2 + 8,
                left: grid.x - 70,
                width: 140,
                alignItems: 'center',
              }}
            >
              <Text
                style={[
                  pvToGrid > 0 || gridImport > 0
                    ? styles.valueText
                    : styles.valueTextMuted,
                ]}
              >
                {pvToGrid > 0 ? formatW(pvToGrid) : formatW(gridImport)}
              </Text>

              {gridImport > 0 && pvToGrid <= 0 && (
                <Text style={styles.subValueText}>(Bezug)</Text>
              )}

              {pvToGrid > 0 && (
                <Text style={styles.subValueText}>(Einspeisung)</Text>
              )}
            </View>
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

  valueTextMuted: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9A9898',
    textAlign: 'center',
  },

  subValueText: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
    color: '#6E6C6C',
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
  sunCircle: { backgroundColor: '#FFFF2E' },
  houseCircle: { backgroundColor: '#6CD3ED' },
  batteryCircle: { backgroundColor: '#2EFF74' },
  gridCircle: { backgroundColor: '#FF702E' },

  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
})
