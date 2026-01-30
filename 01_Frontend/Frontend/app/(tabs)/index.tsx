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
let currentEGoWallboxSetting: EGoWallboxSetting = 'SETTING_1'
let currentBoilerSetting: BoilerSetting = 'MANUAL_OFF'

// Variable, damit ich die Einstellung auch dann einfach fürs Backend habe
export function getCurrentEGoWallboxSetting() {
  return currentEGoWallboxSetting
}

export function getCurrentBoilerSetting() {
  return currentBoilerSetting
}

const toNum = (v: any) => (Number.isFinite(v) ? Number(v) : 0)
const clamp0 = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0)

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

  // --- Rohwerte
const pvTotal = clamp0(toNum(pvData?.pv_power ?? 0))

// Hausverbrauch: negativ geliefert -> Betrag
const rawLoad = toNum(pvData?.load_power ?? 0)
const houseDemand = clamp0(rawLoad < 0 ? -rawLoad : rawLoad)

// Batterie: SIGNED weiterreichen (positiv = Laden, negativ = Entladen)
const batteryPower = toNum(pvData?.battery_power ?? 0)

// Netz: positiv = Bezug, negativ = Einspeisung
const rawGrid = toNum(pvData?.grid_power ?? 0)
const gridImport = rawGrid > 0 ? clamp0(rawGrid) : 0
const gridFeedIn = rawGrid < 0 ? clamp0(-rawGrid) : 0

// --- PV-Verteilung (nur PV!)
const pvToHouse = Math.min(houseDemand, pvTotal)
const remaining1 = pvTotal - pvToHouse

const pvToBattery = Math.min(Math.max(0, batteryPower), remaining1)
const remaining2 = remaining1 - pvToBattery

const pvToGrid = Math.min(gridFeedIn, remaining2)

// --- Netz -> Haus (nur wenn PV nicht reicht)
const houseDeficitAfterPv = clamp0(houseDemand - pvToHouse)
const gridToHouse = Math.min(gridImport, houseDeficitAfterPv)

const diagramData: DiagramData = {
  total: pvTotal,
  house: pvToHouse,
  houseActual: houseDemand,
  battery: pvToBattery,
  grid: pvToGrid,
  gridImport,
  gridToHouse,
  batteryPower, // <<< DAS ist der entscheidende Fix
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
