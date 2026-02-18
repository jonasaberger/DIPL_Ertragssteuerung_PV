import Card from '@/components/card'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import React, { useState, useEffect, useMemo, useRef } from 'react'
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

// Farben = Ursprungskreise
const PV_COLOR = '#FFFF2E'
const HOUSE_COLOR = '#6CD3ED'
const BATTERY_COLOR = '#2EFF74'
const GRID_COLOR = '#FF702E'

export type DiagramData = {
  // PV Erzeugung
  total: number

  // Flows 
  pvToHouse: number
  pvToBattery: number
  pvToGrid: number

  gridToHouse: number
  batteryToHouse: number

  // Zusatzinfos für Anzeige/Icons
  houseActual: number   // Hausverbrauch
  batteryPower: number  // <0 Laden        >0 Entladen
  gridPower: number     // <0 Einspeisung  >0 Bezug
}

type Props = {
  data: DiagramData
  available?: boolean  // NEU
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

  //useRef bedeutet dass die Animationswerte nicht neu bei jedem Rendern initialisiert werden müssen
  //current greift auf den aktuellen Wert zu
  //moveAnim steuert die Bewegung entlang der Linie
  const moveAnim = useRef(new Animated.Value(0)).current
  //scaleAnim steuert die Größenveränderung der Partikel
  const scaleAnim = useRef(new Animated.Value(0)).current

  //minScale und maxScale legen den Bereich fest in dem die Partikel skalieren
  const minScale = useRef(0.6 + Math.random() * 0.3).current
  const maxScale = useRef(1.0 + Math.random() * 0.5).current
  //scaleDuration legt die Dauer der Skalierungsanimation fest
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
      // sequence führt mehrere Animationen nacheinander aus
      Animated.sequence([
        // Skalierung von min auf max 
        Animated.timing(scaleAnim, {
          toValue: 1,                             //Zielwert
          duration: scaleDuration,                //Dauer der Animation
          easing: Easing.inOut(Easing.ease),      //Easing-Funktion für sanfte Animation
          useNativeDriver: true,                  //Verwendung des nativen Treibers für bessere Performance
        }),
        // Skalierung von max auf min
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

    // Aufräumen der Animationen beim Unmounten des Partikels, um Speicherlecks zu vermeiden
    return () => {
      moveLoop.stop()
      scaleLoop.stop()
    }
  }, [moveAnim, scaleAnim, duration, scaleDuration])

  // Wandel die Werte der Animation in die tatsächlichen Transformationswerte für Bewegung und Skalierung um
  const scale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [minScale, maxScale],
  })

  // Animation: 0; translateX: Startpunkt
  // Animation: 1; translateX: Endpunkt
  const translateXStraight = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [start?.x ?? 0, end?.x ?? 0],
  })

  // Gleich wie bei translateX, aber für die Y-Achse
  const translateYStraight = moveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [start?.y ?? 0, end?.y ?? 0],
  })

  // Ob ein Pfad vorliegt der aus mindestens 2 Punkten besteht
  const curve = path && path.length >= 2 ? path : null

  // Ziel ist, Animationswerte so zu transformieren, dass sie entlang einer Kurve anstatt einer geraden Linie verlaufen
  // useMemo berechnet nur die Werte neu, wenn sich curve ändert
  const { inputRange, xOut, yOut } = useMemo(() => {
    if (!curve) {
      return {
        inputRange: null as number[] | null,
        xOut: null as number[] | null,
        yOut: null as number[] | null,
      }
    }

    // Anzahl der Punkte in der Kurve
    const n = curve.length

    // inputRange ist ein Array von Werten zwischen 0 und 1, das die Position jedes Punkts auf der Kurve repräsentiert
    // Beispiel: Bei 5 Punkten wäre inputRange [0, 0.25, 0.5, 0.75, 1]
    const inputRange = Array.from({ length: n }, (_, i) => i / (n - 1))

    // xOut extrahiert alle x-Koordinaten
    const xOut = curve.map(p => p.x)
    // yOut extrahiert alle y-Koordinaten
    const yOut = curve.map(p => p.y)
    // Werte werden getrennt, da Animate.interpolate nur 1D-Arrays verwendet

    return { inputRange, xOut, yOut }
  }, [curve])


  const translateX =
  // Wenn eine Kurve da ist, folge dieser. Ansonsten gerade Linie
    curve && inputRange && xOut
      ? moveAnim.interpolate({ inputRange, outputRange: xOut })
      : translateXStraight

  const translateY =
  // Wenn eine Kurve da ist, folge dieser. Ansonsten gerade Linie
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
  const items = []

  for (let i = 0; i < count; i++) {
    const extra = (duration / count) * i
    items.push(
      <ParticleLine
        key={i}
        start={start}
        end={end}
        color={color}
        duration={duration + extra}
      />
    )
  }

  // Eine Gruppe von Partikel entlang der gleichen Linie aber mit leicht unterschiedlichen Startzeiten
  return <>{items}</>
}

// Diese Version von ParticleGroup folgt einem vorgegebenen Pfad (Kurve) anstatt einer geraden Linie
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
  const items = []
  const step = duration / count

  for (let i = 0; i < count; i++) {
    const extra = step * i
    items.push(
      <ParticleLine
        key={i}
        path={path}
        color={color}
        duration={duration + extra}
      />
    )
  }

  // Eine Gruppe von Partikeln entlang des gleichen Pfades aber mit leicht unterschiedlichen Startzeiten
  return <>{items}</>
}

// Rundet Zahl auf eine Nachkommastelle (Multiplizieren, runden dann wieder dividieren)
const round1 = (v: number) => Math.round(v * 10) / 10
// Hängt bei einer Zahl die Einheit "W" an
const formatW = (v: number) => `${round1(v)} W`

// Erzeugt geschwungene Kurve zwischen Start und Ende, die durch die Kontrollpunkte c1 und c2 definiert wird (glattere Kurve) (Cubic Bezier Kurve)
// Bezier Kurve:
//    - Kurve geht immer durch Start
//    - Kurve geht immer durch Ende
//    - Kurve geht nicht durch c1 oder c2, sondern wird nur von ihnen "angezogen"
function makeCubicCurve(
  start: Point,
  end: Point,
  c1: Point,
  c2: Point,
  steps = 20
) {
  // Leeres Array für die Punkte
  const pts: Point[] = []

  // Steps 20 bedeutet, die Kurve wird in 20 Abschnitte unterteilt
  // Es entstehen 21 Punkte (0 bis 20)
  for (let i = 0; i <= steps; i++) {

    // t beschreibt den Fortschritt entlang der Kurve von 0 (Start) bis 1 (Ende)
    const t = i / steps
    // Hilfsvariable; Bezier-Formel rechnet mit (1-t)
    const one = 1 - t

    // Quadrierte Versionen der obigen Variablen
    const one2 = one * one
    const t2 = t * t

    // Die b-Werte sind Gewichte. Sie bestimmen, wie stark jeder Punkt (Start, c1, c2, Ende) die Gerade beeinflusst
    const b0 = one2 * one
    const b1 = 3 * one2 * t
    const b2 = 3 * one * t2
    const b3 = t2 * t

    pts.push({
      // Berechnung der x- und y-Koordinaten des Punktes auf der Kurve basierend auf den Gewichten und den Positionen der Punkte
      x: b0 * start.x + b1 * c1.x + b2 * c2.x + b3 * end.x,
      y: b0 * start.y + b1 * c1.y + b2 * c2.y + b3 * end.y,
    })
  }

  return pts
}

export default function HDiagram({ data, available = true }: Props) {
  const [diagramWidth, setDiagramWidth] = useState<number | null>(null)

  const handleDiagramLayout = (e: LayoutChangeEvent) => {
    setDiagramWidth(e.nativeEvent.layout.width)
  }

  // Berechnung der Positionen der Kreise basierend auf der Breite des Diagramms
  const points = useMemo(() => {
    if (diagramWidth === null) return null
    const SUN_Y = 120
    const BOTTOM_CENTER_Y = 360
    const SIDE_Y = BOTTOM_CENTER_Y - 40

    const sun: Point = { x: diagramWidth / 2, y: SUN_Y }
    const battery: Point = { x: diagramWidth / 2, y: BOTTOM_CENTER_Y }
    const house: Point = { x: diagramWidth * 0.23, y: SIDE_Y }
    const grid: Point = { x: diagramWidth * 0.77, y: SIDE_Y }

    return { sun, house, battery, grid }
  }, [diagramWidth])

  
  const pvPower = Math.max(0, Number(data.total ?? 0))          // Aktuelle PV-Leistung, immer positiv

  const batteryAbs = Math.max(0, Math.abs(Number(data.batteryPower ?? 0)))    // Batterie-Leistung absolut, immer positiv
  const batteryIsCharging = Number(data.batteryPower ?? 0) < 0                // Batterie lädt, wenn Leistung negativ ist
  const batteryIsDischarging = Number(data.batteryPower ?? 0) > 0             // Batterie entlädt, wenn Leistung positiv ist

  const gridAbs = Math.max(0, Math.abs(Number(data.gridPower ?? 0)))        // Netzleistung absolut, immer positiv
  const gridIsImporting = Number(data.gridPower ?? 0) > 0                   // Netzbezug, wenn Leistung positiv ist   
  const gridIsExporting = Number(data.gridPower ?? 0) < 0                   // Netzeinspeisung, wenn Leistung negativ ist

  // Animationen — available && verhindert Partikel wenn keine Daten vorhanden
  const showPvHouse = available && pvPower > 0 && Number(data.pvToHouse ?? 0) > 0
  const showPvBattery = available && pvPower > 0 && Number(data.pvToBattery ?? 0) > 0
  const showPvGrid = available && pvPower > 0 && (Number(data.pvToGrid ?? 0) > 0 || gridIsExporting)
  const showGridHouse = available && (gridIsImporting || Number(data.gridToHouse ?? 0) > 0)
  const showBatteryHouse = available && Number(data.batteryToHouse ?? 0) > 0

  // Gibt eine Liste von Punkten zurück, für die Kurvenanimation von Grid auf Haus
  const gridToHousePath = useMemo(() => {
    if (!points) return null

    // Start ist immer das Netz, Ende immer das Haus
    const start = points.grid
    const end = points.house

    // Horizontale Distanz (Vertikal nicht, weil sie auf der gleichen Höhe sind)
    const dx = end.x - start.x
    // Macht aus links / rechts eine positive Länge welche nicht 0 sein kann
    const dist = Math.max(1, Math.abs(dx))
    // Wie stark die Kurve nach oben gezogen wird
    const lift = Math.max(110, Math.min(190, dist * 0.55))

    // Kurve geht zwar hoch, bleibt aber immer mindestens 30 Pixel von der Sonne entfernt
    const topY = Math.max(points.sun.y + 30, Math.min(start.y, end.y) - lift)

    // Kontrollpunkte für die Bezier-Kurve. Je weiter sie von der geraden Linie entfernt sind, desto stärker wird die Kurve
    // 0.25 und 0.75 damit die Kurve auf beiden Seiten symmetrisch ist.
    const c1: Point = {
      x: start.x + dx * 0.25,
      y: topY,
    }
    const c2: Point = {
      x: start.x + dx * 0.75,
      y: topY,
    }

    return makeCubicCurve(start, end, c1, c2, 22)
  }, [points])

  // Prinzipiell gleiche Logik wie bei gridToHousePath, aber da die Batterie unter dem Haus liegt, wird die Kurve nach unten gezogen
  const batteryToHousePath = useMemo(() => {
    if (!points) return null
    const start = points.battery
    const end = points.house

    // Wieder nur X-Distanz, da Kurvenform eher von horizontaler Distanz abhängt
    const dx = end.x - start.x
    const dist = Math.max(1, Math.abs(dx))
    const lift = Math.max(80, Math.min(150, dist * 0.45))

    // Mehr Abstand zur Sonne als gridToHouse
    const topY = Math.max(points.sun.y + 70, Math.min(start.y, end.y) - lift)

    // Kontrollpunkte, die die Kurve nach unten ziehen
    // 0.35 und 0.7 damit die Kurve etwas stärker nach unten gezogen wird als bei gridToHouse
    const c1: Point = { x: start.x + dx * 0.35, y: topY }
    const c2: Point = { x: start.x + dx * 0.7, y: topY + 10 }

    return makeCubicCurve(start, end, c1, c2, 20)
  }, [points])

  return (
    <Card height={520}>
      {!available && (
        <View style={styles.noDataBadge}>
          <MaterialCommunityIcons name="wifi-off" size={13} color="#8E8E93" />
          <Text style={styles.noDataText}>Keine Daten</Text>
        </View>
      )}

      <View style={styles.diagram} onLayout={handleDiagramLayout}>
        {points && (
          <>
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {/* PV -> ... (gerade) — Farbe PV */}
              {showPvHouse && (
                <ParticlesGroup
                  start={points.sun}
                  end={points.house}
                  color={PV_COLOR}
                  count={7}
                  duration={2600}
                />
              )}

              {showPvBattery && (
                <ParticlesGroup
                  start={points.sun}
                  end={points.battery}
                  color={PV_COLOR}
                  count={9}
                  duration={2400}
                />
              )}

              {showPvGrid && (
                <ParticlesGroup
                  start={points.sun}
                  end={points.grid}
                  color={PV_COLOR}
                  count={6}
                  duration={2800}
                />
              )}

              {/* Netz -> Haus (Kurve) — Farbe Netz */}
              {showGridHouse && gridToHousePath && (
                <ParticlesCurveGroup
                  path={gridToHousePath}
                  color={GRID_COLOR}
                  count={6}
                  duration={2400}
                />
              )}

              {/* Batterie -> Haus (Kurve) — Farbe Batterie */}
              {showBatteryHouse && batteryToHousePath && (
                <ParticlesCurveGroup
                  path={batteryToHousePath}
                  color={BATTERY_COLOR}
                  count={7}
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
                  left: points.sun.x - CIRCLE_SIZE / 2,
                  top: points.sun.y - CIRCLE_SIZE / 2,
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
                  top: points.sun.y - CIRCLE_SIZE / 2 - 28,
                  left: points.sun.x - 70,
                  width: 140,
                },
              ]}
            >
              {formatW(pvPower)}
            </Text>

            {/* Haus */}
            <View
              style={[
                styles.circle,
                styles.houseCircle,
                {
                  left: points.house.x - CIRCLE_SIZE / 2,
                  top: points.house.y - CIRCLE_SIZE / 2,
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
                  top: points.house.y + CIRCLE_SIZE / 2 + 8,
                  left: points.house.x - 60,
                  width: 120,
                  textAlign: 'center',
                },
              ]}
            >
              {formatW(Math.max(0, Number(data.houseActual ?? 0)))}
            </Text>

            {/* Batterie */}
            <View
              style={[
                styles.circle,
                styles.batteryCircle,
                {
                  left: points.battery.x - CIRCLE_SIZE / 2,
                  top: points.battery.y - CIRCLE_SIZE / 2,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  batteryIsDischarging
                    ? 'battery-minus'
                    : batteryIsCharging
                      ? 'battery-charging'
                      : 'battery'
                }
                size={42}
                color="#474646"
              />
            </View>

            <View
              style={{
                position: 'absolute',
                top: points.battery.y + CIRCLE_SIZE / 2 + 8,
                left: points.battery.x - 70,
                width: 140,
                alignItems: 'center',
              }}
            >
              <Text
                style={[
                  batteryAbs > 0 ? styles.valueText : styles.valueTextMuted,
                ]}
              >
                {formatW(batteryAbs)}
              </Text>

              {batteryIsDischarging && (
                <Text style={styles.subValueText}>(Entladung)</Text>
              )}
              {batteryIsCharging && (
                <Text style={styles.subValueText}>(Laden)</Text>
              )}
            </View>

            {/* Netz */}
            <View
              style={[
                styles.circle,
                styles.gridCircle,
                {
                  left: points.grid.x - CIRCLE_SIZE / 2,
                  top: points.grid.y - CIRCLE_SIZE / 2,
                },
              ]}
            >
              <MaterialCommunityIcons name="sitemap" size={42} color="#474646" />
            </View>

            <View
              style={{
                position: 'absolute',
                top: points.grid.y + CIRCLE_SIZE / 2 + 8,
                left: points.grid.x - 70,
                width: 140,
                alignItems: 'center',
              }}
            >
              <Text style={[gridAbs > 0 ? styles.valueText : styles.valueTextMuted]}>
                {formatW(gridAbs)}
              </Text>

              {gridIsImporting && <Text style={styles.subValueText}>(Bezug)</Text>}
              {gridIsExporting && (
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
  diagram: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },

  noDataBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 10,
  },
  noDataText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
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
  sunCircle: { backgroundColor: PV_COLOR },
  houseCircle: { backgroundColor: HOUSE_COLOR },
  batteryCircle: { backgroundColor: BATTERY_COLOR },
  gridCircle: { backgroundColor: GRID_COLOR },

  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
})