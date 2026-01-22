import HDiagram, { DiagramData } from '@/components/homePage/h-diagram'
import HPrices from '@/components/homePage/h-prices'
import HPriority, { PriorityItem } from '@/components/homePage/h-priority'
import HWallbox from '@/components/homePage/h-wallbox'
import HBoiler from '@/components/homePage/h-boiler'
import { ThemedView } from '@/components/themed-view'
import { useUpdateDataScheduler } from '@/hooks/useUpdateDataScheduler'
import React, { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

const INITIAL_PRIORITIES: PriorityItem[] = [
  { id: 'boiler', label: 'Boiler' },
  { id: 'wallbox', label: 'e-Go Wallbox' },
  { id: 'speicher', label: 'Speicher' },
]

type EGoWallboxSetting = 'SETTING_1' | 'SETTING_2'
type BoilerSetting = 'MANUAL_OFF' | 'MANUAL_ON'

export default function HomeScreen() {
  const { pvData, boilerData, epexData, wallboxData, systemState } = useUpdateDataScheduler()

  // Availability Flags
  const available = {
    wallbox: systemState?.wallbox === 'ok',
    boiler: systemState?.boiler === 'ok',
  }

  // UI States grouped
  const [uiState, setUiState] = useState({
    selectedWallboxSetting: 'SETTING_1' as EGoWallboxSetting,
    selectedBoilerSetting: 'MANUAL_OFF' as BoilerSetting,
    priorities: INITIAL_PRIORITIES as PriorityItem[],
  })

  // Diagram Data
  const diagramData: DiagramData = {
    total: pvData?.pv_power ?? 0,
    house: pvData?.load_power ?? 0,
    battery: pvData?.battery_power ?? 0,
    grid: pvData?.grid_power ?? 0,
  }

  // Handlers
  const handleWallboxSelect = (setting: EGoWallboxSetting) => {
    setUiState((prev) => ({ ...prev, selectedWallboxSetting: setting }))
  }

  const handleBoilerSelect = (setting: BoilerSetting) => {
    setUiState((prev) => ({ ...prev, selectedBoilerSetting: setting }))
  }

  const handlePriorityDragEnd = (data: PriorityItem[]) => {
    setUiState((prev) => ({ ...prev, priorities: data }))
    console.log('Ladeprioritäten:', data.map((item) => item.id))
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <HDiagram data={diagramData} />
        <HPriority priorities={uiState.priorities} onDragEnd={handlePriorityDragEnd} />
        <HPrices
          date={epexData?.date ?? ''}
          time={epexData?.time ?? 'Loading...'}
          location="Österreich"
          pricePerKWh={epexData?.pricePerKWh ?? 0}
        />
        <HBoiler
          temperatureC={boilerData?.temp ?? 0}
          isHeating={boilerData?.heating ?? false}
          selectedSetting={uiState.selectedBoilerSetting}
          onSelect={handleBoilerSelect}
          available={available.boiler}
          
        />

        <HWallbox
          energyKWh={wallboxData?.energy ?? 0}         // Fallback 0
          isCharging={wallboxData?.isCharging ?? false}
          selectedSetting={uiState.selectedWallboxSetting}
          onSelect={handleWallboxSelect}
          carConnected={wallboxData?.carConnected ?? false}
          ampere={wallboxData?.ampere ?? 0}
          available={systemState?.wallbox === 'ok'}     // Availability dynamisch geregelt
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