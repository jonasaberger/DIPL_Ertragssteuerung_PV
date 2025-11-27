import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  LayoutChangeEvent,
  TouchableOpacity,
  ScrollView,
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

type PriorityItem = {
  id: string
  label: string
}

const INITIAL_PRIORITIES: PriorityItem[] = [
  { id: 'boiler', label: 'Boiler' },
  { id: 'wallbox', label: 'e-Go Wallbox' },
  { id: 'speicher', label: 'Speicher' },
]

const CURRENT_DATE = '05.02.2026'
const LAST_UPDATE_TIME = '14:15'
const LOCATION = 'Salzburg'
const PRICE_EUR_PER_KWH = 0.015

type EGoWallboxSetting = 'SETTING_1' | 'SETTING_2'

let currentEGoWallboxSetting: EGoWallboxSetting = 'SETTING_1'

//Variable, damit ich die Einstellung auch dann einfach fürs Backend habe
export function getCurrentEGoWallboxSetting() {
  return currentEGoWallboxSetting
}

const MOCK_ENERGY = 9
const MOCK_IS_CHARGING = true

function ParticleLine({ start, end, color, duration = 2200 }: ParticleLineProps) {
  //useREF damit der Animationswert über renders hinweg erhalten bleibt
  const anim = useRef(new Animated.Value(0)).current

  //Erstellt eine endlose Animation die den Wert von 0 auf 1 ändert
  //duration ist in millisekunden
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
    //Startet die endlosschleife
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
    //styles.particle macht den partikel einfach zu nem kleinen Kreis
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
          //ParticleLine mit leicht versetzter Dauer damit die Partikel nicht alle gleichzeitig ankommen
          //Es werden einfach mehrfache Partikel erstellt
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

export default function HomeScreen() {
  //Wird genutzt um die Breite des Diagrammbereichs zu speichern
  //Auf unterschiedlichen Bildschirmgrößen kann die Breite variieren
  const [diagramWidth, setDiagramWidth] = useState<number | null>(null)

  //Speichert die aktuell ausgewählte Einstellung der e-Go Wallbox
  const [selectedSetting, setSelectedSetting] = useState<EGoWallboxSetting>(
    currentEGoWallboxSetting
  )

  //Speichert die aktuelle Reihenfolge der Prioritäten
  const [priorities, setPriorities] =
    useState<PriorityItem[]>(INITIAL_PRIORITIES)

  //Wird aufgerufen wenn eine Einstellung der e-Go Wallbox ausgewählt wird
  function handleSelect(setting: EGoWallboxSetting) {
    setSelectedSetting(setting)
    currentEGoWallboxSetting = setting
  }

  //Wenn sich das Layout des Diagrammbereichs ändert (z.B. durch Bildschirmdrehung), wird die Breite aktualisiert
  const handleDiagramLayout = (e: LayoutChangeEvent) => {
    const { width } = e.nativeEvent.layout
    setDiagramWidth(width)
  }

  //Wird aufgerufen wenn die Prioritäten neu angeordnet wurden
  //Data ist die neu geordnete Liste
  const handlePriorityDragEnd = ({ data }: { data: PriorityItem[] }) => {
    setPriorities(data)
    //orderIds wird dann später verwendet (Backend etc.)
    const orderIds = data.map((item) => item.id)
    console.log('Ladeprioritäten:', orderIds)
  }

  //braucht man damit die Nummern in der UI richtig angezeigt werden
  const renderPriorityItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<PriorityItem>) => {
    //Sucht den aktuellen Index des Items in der Prioritätenliste
    const currentIndex = priorities.findIndex((p) => p.id === item.id)

    return (
      //Hier passiert das eigentliche draggen
      <TouchableOpacity
        onLongPress={drag}
        delayLongPress={120}
        activeOpacity={0.9}
        style={[
          //Style ändert sich wenn es gerade gezogen wird
          styles.priorityRow,
          isActive && styles.priorityRowActive,
        ]}
      >
        <View style={styles.priorityNumber}>
          <Text style={styles.priorityNumberText}>{currentIndex + 1}</Text>
        </View>
        <Text style={styles.priorityLabel}>{item.label}</Text>
      </TouchableOpacity>
    )
  }

  //Die Positionen der verschiedenen Elemente im Diagramm vom Typ Point
  let sun: Point | null = null
  let house: Point | null = null
  let battery: Point | null = null
  let grid: Point | null = null

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
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Die Card mit der Animation und dem Diagramm*/}
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

        {/* Die Card mit den Ladeprioritäten */}
        <Card>
          <Text style={styles.priorityTitle}>Ladeprioritäten</Text>
          <DraggableFlatList
            data={priorities}
            keyExtractor={(item) => item.id}
            renderItem={renderPriorityItem}
            onDragEnd={handlePriorityDragEnd}
            scrollEnabled={false}
            activationDistance={4}
          />
        </Card>

        {/* Die Card mit dem Strompreis */}
        <Card>
          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceTitle}>Strompreis aktuell</Text>

              <View style={styles.priceMetaRow}>
                <Text style={styles.priceMetaText}>{CURRENT_DATE}</Text>
                <Text style={styles.priceMetaText}>{LAST_UPDATE_TIME}</Text>
              </View>
            </View>

            <View style={styles.priceBottomRow}>
              <View style={styles.locationRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={18}
                  color="#1EAFF3"
                />
                <Text style={styles.locationText}>{LOCATION}</Text>
              </View>

              <Text style={styles.priceValue}>{PRICE_EUR_PER_KWH}€ / kWh</Text>
            </View>
          </View>
        </Card>

        {/* Die Card mit der E-GO Wallbox */}
        <Card>
          <View style={styles.wallboxCard}>
            <View style={styles.wallboxHeaderRow}>
              <View>
                <Text style={styles.wallboxTitle}>E-GO Wallbox</Text>
                <Text style={styles.wallboxEnergyText}>
                  <Text style={styles.wallboxEnergyValue}>{MOCK_ENERGY} kWh</Text>{' '}
                  zugeführt
                </Text>
              </View>

              <View
                pointerEvents="none"
                style={[
                  styles.wallboxStatusContainer,
                  { overflow: 'hidden' }, 
                ]}
              >
                <MaterialCommunityIcons
                  name={MOCK_IS_CHARGING ? 'flash' : 'close'}
                  size={16}
                  color={MOCK_IS_CHARGING ? '#16C75C' : '#d01212ff'}
                />
                <Text
                  style={[
                    styles.wallboxStatusText,
                    MOCK_IS_CHARGING
                      ? styles.wallboxStatusTextCharging
                      : styles.wallboxStatusTextIdle,
                  ]}
                >
                  {MOCK_IS_CHARGING ? 'Laden…' : 'Lädt nicht'}
                </Text>
              </View>
            </View>

            <View style={styles.wallboxSettingsContainer}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.wallboxSettingButton,
                  selectedSetting === 'SETTING_1' &&
                    styles.wallboxSettingButtonActive,
                ]}
                onPress={() => handleSelect('SETTING_1')}
              >
                <Text
                  style={[
                    styles.wallboxSettingText,
                    selectedSetting === 'SETTING_1' &&
                      styles.wallboxSettingTextActive,
                  ]}
                >
                  Setting 1
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.wallboxSettingButton,
                  selectedSetting === 'SETTING_2' &&
                    styles.wallboxSettingButtonActive,
                ]}
                onPress={() => handleSelect('SETTING_2')}
              >
                <Text
                  style={[
                    styles.wallboxSettingText,
                    selectedSetting === 'SETTING_2' &&
                      styles.wallboxSettingTextActive,
                  ]}
                >
                  Setting 2
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>
      </ScrollView>
    </ThemedView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#EDE9E9',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  scrollContent: {
    paddingBottom: 56,
  },

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

  priorityTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
    color: '#474646',
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5E5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  priorityRowActive: {
    opacity: 0.9,
  },
  priorityNumber: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 30,
  },
  priorityNumberText: {
    fontSize: 22,
    fontWeight: '700',
  },
  priorityLabel: {
    fontSize: 22,
    fontWeight: '900',
    color: '#474646',
  },
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

  wallboxCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  wallboxHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  wallboxTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E1E1E',
    marginBottom: 2,
  },
  wallboxEnergyText: {
    fontSize: 14,
    color: '#7A7A7A',
  },
  wallboxEnergyValue: {
    color: '#1EAFF3',
    fontWeight: '600',
  },
  wallboxStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    padding: 0,
    margin: 0,
    backgroundColor: 'transparent',
  },
  wallboxStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  wallboxStatusTextCharging: {
    color: '#16C75C',
  },
  wallboxStatusTextIdle: {
    color: '#d01212ff',
  },
  wallboxSettingsContainer: {
    gap: 8,
  },
  wallboxSettingButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#E7E7E7',
  },
  wallboxSettingButtonActive: {
    backgroundColor: '#D9ECFF',
    borderWidth: 1,
    borderColor: '#1EAFF3',
  },
  wallboxSettingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555555',
  },
  wallboxSettingTextActive: {
    color: '#1EAFF3',
    fontWeight: '600',
  },
})
