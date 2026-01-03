import React, { useState } from 'react'
import { StyleSheet, ScrollView } from 'react-native'
import { ThemedView } from '@/components/themed-view'
import HDiagram, { DiagramData } from '@/components/homePage/h-diagram'
import HPriority, { PriorityItem } from '@/components/homePage/h-priority'
import HPrices from '@/components/homePage/h-prices'
import HWallbox from '@/components/homePage/h-wallbox'
import HBoiler from '@/components/homePage/h-boiler'

const data: DiagramData = {
  total: 400,
  house: 150,
  battery: 200,
  grid: 50,
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
type BoilerSetting = 'SETTING_1' | 'SETTING_2'

let currentEGoWallboxSetting: EGoWallboxSetting = 'SETTING_1'
let currentBoilerSetting: BoilerSetting = 'SETTING_1'

// Variable, damit ich die Einstellung auch dann einfach fürs Backend habe
export function getCurrentEGoWallboxSetting() {
  return currentEGoWallboxSetting
}

export function getCurrentBoilerSetting() {
  return currentBoilerSetting
}

const MOCK_ENERGY = 9
const MOCK_IS_CHARGING = true

const MOCK_BOILER_TEMP = 58
const MOCK_IS_HEATING = true

export default function HomeScreen() {
  // Speichert die aktuell ausgewählte Einstellung der e-Go Wallbox
  const [selectedSetting, setSelectedSetting] = useState<EGoWallboxSetting>(
    currentEGoWallboxSetting
  )

  // Speichert die aktuell ausgewählte Einstellung des Boilers
  const [selectedBoilerSetting, setSelectedBoilerSetting] =
    useState<BoilerSetting>(currentBoilerSetting)

  // Speichert die aktuelle Reihenfolge der Prioritäten
  const [priorities, setPriorities] =
    useState<PriorityItem[]>(INITIAL_PRIORITIES)

  // Wird aufgerufen wenn eine Einstellung der e-Go Wallbox ausgewählt wird
  function handleSelect(setting: EGoWallboxSetting) {
    setSelectedSetting(setting)
    currentEGoWallboxSetting = setting
  }

  // Wird aufgerufen wenn eine Boiler-Einstellung ausgewählt wird
  function handleBoilerSelect(setting: BoilerSetting) {
    setSelectedBoilerSetting(setting)
    currentBoilerSetting = setting
  }

  // Wird aufgerufen wenn die Prioritäten neu angeordnet wurden
  // Data ist die neu geordnete Liste
  const handlePriorityDragEnd = (data: PriorityItem[]) => {
    setPriorities(data)
    // orderIds wird dann später verwendet (Backend etc.)
    const orderIds = data.map((item) => item.id)
    console.log('Ladeprioritäten:', orderIds)
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Die Card mit der Animation und dem Diagramm – ausgelagert */}
        <HDiagram data={data} />

        {/* Die Card mit den Ladeprioritäten – ausgelagert */}
        <HPriority priorities={priorities} onDragEnd={handlePriorityDragEnd} />

        {/* Die Card mit dem Strompreis – ausgelagert */}
        <HPrices
          date={CURRENT_DATE}
          time={LAST_UPDATE_TIME}
          location={LOCATION}
          pricePerKWh={PRICE_EUR_PER_KWH}
        />

        {/* Die Card mit der E-GO Wallbox – ausgelagert */}
        <HWallbox
          energyKWh={MOCK_ENERGY}
          isCharging={MOCK_IS_CHARGING}
          selectedSetting={selectedSetting}
          onSelect={handleSelect}
        />

        {/* Die Card mit dem Warmwasserboiler – ausgelagert */}
        <HBoiler
          temperatureC={MOCK_BOILER_TEMP}
          isHeating={MOCK_IS_HEATING}
          selectedSetting={selectedBoilerSetting}
          onSelect={handleBoilerSelect}
        />
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
})
