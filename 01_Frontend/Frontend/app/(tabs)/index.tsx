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

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const clamp0 = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0)

export default function HomeScreen() {
  const { pvData, boilerData, epexData, wallboxData, systemState } =
    useUpdateDataScheduler()

  const available = {
    wallbox: systemState?.wallbox === 'ok',
    boiler: systemState?.boiler === 'ok',
  }

  const [uiState, setUiState] = useState({
    selectedWallboxSetting: 'SETTING_1' as EGoWallboxSetting,
    selectedBoilerSetting: 'MANUAL_OFF' as BoilerSetting,
    priorities: INITIAL_PRIORITIES as PriorityItem[],
  })

  // --- Rohwerte (SIGNED wie vom Backend)
  const pvTotal = clamp0(toNum(pvData?.pv_power ?? 0))

  // Hausverbrauch: laut Fronius oft negativ geliefert -> Betrag
  const rawLoad = toNum(pvData?.load_power ?? 0)
  const houseDemand = clamp0(rawLoad < 0 ? -rawLoad : rawLoad)

  // Batterie: DEINE Konvention:
  // battery_power < 0 => LADEN
  // battery_power > 0 => ENTLADEN
  const batteryPower = toNum(pvData?.battery_power ?? 0)

  // Netz: DEINE Konvention:
  // grid_power < 0 => Einspeisung
  // grid_power > 0 => Bezug
  const gridPower = toNum(pvData?.grid_power ?? 0)

  const gridImport = gridPower > 0 ? clamp0(gridPower) : 0
  const gridFeedIn = gridPower < 0 ? clamp0(-gridPower) : 0

  const batteryCharge = batteryPower < 0 ? clamp0(-batteryPower) : 0
  const batteryDischarge = batteryPower > 0 ? clamp0(batteryPower) : 0

  // --- PV-Verteilung (nur PV!)
  // 1) PV -> Haus
  const pvToHouse = Math.min(houseDemand, pvTotal)
  const pvLeftAfterHouse = clamp0(pvTotal - pvToHouse)

  // 2) PV -> Batterie (nur wenn Batterie lädt)
  const pvToBattery = Math.min(batteryCharge, pvLeftAfterHouse)
  const pvLeftAfterBattery = clamp0(pvLeftAfterHouse - pvToBattery)

  // 3) PV -> Netz (wenn Einspeisung stattfindet)
  const pvToGrid = Math.min(gridFeedIn, pvLeftAfterBattery)

  // --- Batterie -> Haus (wenn entladen wird)
  const houseDeficitAfterPv = clamp0(houseDemand - pvToHouse)
  const batteryToHouse = Math.min(batteryDischarge, houseDeficitAfterPv)

  // --- Netz -> Haus (wenn PV + Batterie nicht reichen)
  const houseDeficitAfterPvAndBattery = clamp0(houseDeficitAfterPv - batteryToHouse)
  const gridToHouse = Math.min(gridImport, houseDeficitAfterPvAndBattery)

  const diagramData: DiagramData = {
    total: pvTotal,

    pvToHouse,
    pvToBattery,
    pvToGrid,

    gridToHouse,
    batteryToHouse,

    houseActual: houseDemand,
    batteryPower, // SIGNED
    gridPower, // SIGNED
  }

  // Handlers
  const handleWallboxSelect = (setting: EGoWallboxSetting) => {
    currentEGoWallboxSetting = setting
    setUiState((prev) => ({ ...prev, selectedWallboxSetting: setting }))
  }

  const handleBoilerSelect = (setting: BoilerSetting) => {
    currentBoilerSetting = setting
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

        <HPriority
          priorities={uiState.priorities}
          onDragEnd={handlePriorityDragEnd}
        />

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
          energyKWh={wallboxData?.energy ?? 0}
          isCharging={wallboxData?.isCharging ?? false}
          selectedSetting={uiState.selectedWallboxSetting}
          onSelect={handleWallboxSelect}
          carConnected={wallboxData?.carConnected ?? false}
          ampere={wallboxData?.ampere ?? 0}
          available={available.wallbox}
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
