import HDiagram, { DiagramData } from '@/components/homePage/h-diagram'
import HPrices from '@/components/homePage/h-prices'
import HPriority, { PriorityItem } from '@/components/homePage/h-priority'
import HWallbox from '@/components/homePage/h-wallbox'
import HBoiler from '@/components/homePage/h-boiler'
import { ThemedView } from '@/components/themed-view'
import { EpexData, fetchEpexData } from '@/services/epex_service'
import {BoilerData, fetchBoilerData} from '@/services/boiler_service'
import {PV_Data, fetchLatestPVData} from '@/services/pv_services'
import { useUpdateDataScheduler } from '@/hooks/useUpdateDataScheduler'
import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

const INITIAL_PRIORITIES: PriorityItem[] = [
  { id: 'boiler', label: 'Boiler' },
  { id: 'wallbox', label: 'e-Go Wallbox' },
  { id: 'speicher', label: 'Speicher' },
]

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

  const { pvData, boilerData, epexData } = useUpdateDataScheduler()

  const diagramData: DiagramData = {
    total: pvData?.pv_power ?? 0,       // gesamte PV-Leistung
    house: pvData?.load_power ?? 0,     // Hausverbrauch
    battery: pvData?.battery_power ?? 0,// ins Batterie gespeist
    grid: pvData?.grid_power ?? 0,      // ins Netz eingespeist
  }


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
    const orderIds = data.map((item) => item.id)
    console.log('Ladeprioritäten:', orderIds)
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <HDiagram data={diagramData} />
        <HPriority priorities={priorities} onDragEnd={handlePriorityDragEnd} />

        {/* HPrices with updated EPEX data */}
        <HPrices
          date={epexData?.date ?? ''}
          time={epexData?.time ?? 'Loading...'}
          location="Österreich"
          pricePerKWh={epexData?.pricePerKWh ?? 0}
        />

        <HWallbox
          energyKWh={MOCK_ENERGY}
          isCharging={MOCK_IS_CHARGING}
          selectedSetting={selectedSetting}
          onSelect={handleSelect}
        />

        {/* Die Card mit dem Warmwasserboiler – ausgelagert */}
        <HBoiler
          temperatureC={boilerData?.temp}
          isHeating={boilerData?.heating}
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