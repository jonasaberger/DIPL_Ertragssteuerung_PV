import HDiagram, { DiagramData } from '@/components/homePage/h-diagram'
import HPrices from '@/components/homePage/h-prices'
import HPriority, { PriorityItem } from '@/components/homePage/h-priority'
import HWallbox from '@/components/homePage/h-wallbox'
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
let currentEGoWallboxSetting: EGoWallboxSetting = 'SETTING_1'

export function getCurrentEGoWallboxSetting() {
  return currentEGoWallboxSetting
}

const MOCK_ENERGY = 9
const MOCK_IS_CHARGING = true

export default function HomeScreen() {
  const [selectedSetting, setSelectedSetting] = useState<EGoWallboxSetting>(
    currentEGoWallboxSetting
  )
  const [priorities, setPriorities] = useState<PriorityItem[]>(INITIAL_PRIORITIES)
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