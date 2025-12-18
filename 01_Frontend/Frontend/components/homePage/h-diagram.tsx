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

//Typ für x/y Positionen
type Point = { x: number; y: number }

//Typ für die Daten, die vom Home-Screen kommen
export type DiagramData = {
  total: number
  house: number
  battery: number
  grid: number
}

//Props von index.tsx
type Props = {
  data: DiagramData
}

//Props für die Partikel-Animation
type ParticleLineProps = {
  start: Point
  end: Point
  color: string
  duration?: number
}

//Eine einzelne Partikel-Linie
function ParticleLine({ start, end, color, duration = 2200 }: ParticleLineProps) {
  //useREF damit der Animationswert über renders hinweg erhalten bleibt
  const anim = useRef(new Animated.Value(0)).current

  //Erstellt eine endlose Animation die den Wert von 0 auf 1 ändert
  //duration ist in Millisekunden
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        //Wichtigster Teil für Performance
        useNativeDriver: true,
      })
    )
    //Startet die Endlosschleife
    loop.start()
    return () => loop.stop()
  }, [anim, duration])

  //anim ist ein Wert zwischen 0 und 1
  //interpolate() wandelt diesen Wert in einen Wert zwischen start.x und end.x um
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [start.x, end.x],
  })

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [start.y, end.y],
  })

  return (
    //Animated.View ist wie ein normales View, kann aber animierte Styles haben
    //styles.particle macht den Partikel einfach zu einem kleinen Kreis
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

//Eine Gruppe mehrerer Partikel-Linien
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
        //jede Linie etwas versetzt, damit sie nicht gleichzeitig ankommen
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

export default function HDiagram({ data }: Props) {
  //Wird genutzt um die Breite des Diagrammbereichs zu speichern
  //Auf unterschiedlichen Bildschirmgrößen kann die Breite variieren
  const [diagramWidth, setDiagramWidth] = useState<number | null>(null)

  //Layout-Callback
  //Wenn sich das Layout des Diagrammbereichs ändert (z.B. durch Bildschirmdrehung), wird die Breite aktualisiert
  const handleDiagramLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout
    setDiagramWidth(width)
  }

  //Positionen der Diagramm-Elemente
  let sun: Point | null = null
  let house: Point | null = null
  let battery: Point | null = null
  let grid: Point | null = null

  //Wenn die Breite vorhanden ist, können wir Positionen berechnen
  if (diagramWidth !== null) {
    const w = diagramWidth

    //Vordefinierte Y-Positionen für die Elemente
    const SUN_Y = 120
    const BOTTOM_CENTER_Y = 360
    const SIDE_Y = BOTTOM_CENTER_Y - 40

    //Setzt die Positionen basierend auf der Diagrammbreite
    sun = { x: w / 2, y: SUN_Y }
    battery = { x: w / 2, y: BOTTOM_CENTER_Y }
    house = { x: w * 0.23, y: SIDE_Y }
    grid = { x: w * 0.77, y: SIDE_Y }
  }

  return (
    //Die komplette Card wird hier drin gekapselt
    <Card height={520}>
      <View style={styles.header}>
        <Text style={styles.temp}>14°C</Text>
        <Text style={styles.icon}>☁️️</Text>
      </View>

      <View style={styles.diagram} onLayout={handleDiagramLayout}>
        {diagramWidth !== null && sun && house && battery && grid && (
          <>
            {/* Partikel-Ebene */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
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
                  // Text über dem Sonnen-Kreis
                  top: sun.y - CIRCLE_SIZE / 2 - 28,
                  left: sun.x - 60,
                  width: 120,
                  zIndex: 2,
                },
              ]}
            >
              {data.total} W
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
                },
              ]}
            >
              {data.house} W
            </Text>

            {/* Batterie */}
            <View
              style={[
                styles.circle,
                styles.batteryCircle,
                {
                  // /2 damit der Kreis zentriert ist
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
                  // + 8 damit der Text etwas Abstand zum Kreis hat
                  top: battery.y + CIRCLE_SIZE / 2 + 8,
                  left: battery.x - 60,
                  width: 120,
                },
              ]}
            >
              {data.battery} W
            </Text>

            {/* Einspeisenetz */}
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
              {data.grid} W
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

  //Diagramm Container
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
