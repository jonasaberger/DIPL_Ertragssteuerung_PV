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
type BoilerSetting = 'SETTING_1' | 'SETTING_2'
let currentEGoWallboxSetting: EGoWallboxSetting = 'SETTING_1'
let currentBoilerSetting: BoilerSetting = 'SETTING_1'

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

const toNum = (v: any) => (Number.isFinite(v) ? Number(v) : 0)
const clamp0 = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0)

export default function HomeScreen() {
  const [selectedSetting, setSelectedSetting] = useState<EGoWallboxSetting>(
    currentEGoWallboxSetting
  )

  const [selectedBoilerSetting, setSelectedBoilerSetting] =
    useState<BoilerSetting>(currentBoilerSetting)

  const [priorities, setPriorities] =
    useState<PriorityItem[]>(INITIAL_PRIORITIES)

  const { pvData, boilerData, epexData } = useUpdateDataScheduler()

  // --- Rohwerte
  const pvTotal = clamp0(toNum(pvData?.pv_power ?? 0))

  // Hausverbrauch: oft negativ geliefert -> Betrag
  const rawLoad = toNum(pvData?.load_power ?? 0)
  const houseDemand = clamp0(rawLoad < 0 ? -rawLoad : rawLoad)

  // Batterie: im PV-Verteilbild nur "Laden"
  const rawBattery = toNum(pvData?.battery_power ?? 0)
  const batteryChargeDemand = clamp0(rawBattery)

  // Netz: positiv = Bezug, negativ = Einspeisung
  const rawGrid = toNum(pvData?.grid_power ?? 0)
  const gridImport = rawGrid > 0 ? clamp0(rawGrid) : 0
  const gridFeedInDemand = rawGrid < 0 ? clamp0(-rawGrid) : 0

  // --- PV-Verteilung (House -> Battery -> Grid)
  const pvToHouse = Math.min(houseDemand, pvTotal)
  const remaining1 = pvTotal - pvToHouse

  const pvToBattery = Math.min(batteryChargeDemand, remaining1)
  const remaining2 = remaining1 - pvToBattery

  const pvToGrid = Math.min(gridFeedInDemand, remaining2)

  // --- Netz -> Haus (wenn Haus mehr will als PV liefert UND Netzbezug da ist)
  const houseDeficitAfterPv = clamp0(houseDemand - pvToHouse)
  const gridToHouse = Math.min(gridImport, houseDeficitAfterPv)

  const diagramData: DiagramData = {
    total: pvTotal,
    house: pvToHouse,           // PV -> Haus (gedeckt)
    houseActual: houseDemand,   // echter Hausverbrauch
    battery: pvToBattery,       // PV -> Batterie (Laden)
    grid: pvToGrid,             // PV -> Netz (Einspeisung)
    gridImport,                 // Netzbezug (Anzeige/Label)
    gridToHouse,                // Netz -> Haus Partikel
  }

  function handleSelect(setting: EGoWallboxSetting) {
    setSelectedSetting(setting)
    currentEGoWallboxSetting = setting
  }

  function handleBoilerSelect(setting: BoilerSetting) {
    setSelectedBoilerSetting(setting)
    currentBoilerSetting = setting
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
