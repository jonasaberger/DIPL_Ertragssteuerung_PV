import React, { useState } from 'react'
import { ScrollView, StyleSheet, Alert } from 'react-native'
import { ThemedView } from '@/components/themed-view'

import HDiagram, { DiagramData } from '@/components/homePage/h-diagram'
import HPrices from '@/components/homePage/h-prices'
import HPriority, { PriorityItem } from '@/components/homePage/h-priority'
import HWallbox from '@/components/homePage/h-wallbox'
import HBoiler from '@/components/homePage/h-boiler'

import { useUpdateDataScheduler } from '@/hooks/useUpdateDataScheduler'
import { toggleBoilerSetting } from '@/services/boiler_service'
import {allowEGoPower} from '@/services/e_go_service'

const INITIAL_PRIORITIES: PriorityItem[] = [
  { id: 'boiler', label: 'Boiler' },
  { id: 'wallbox', label: 'e-Go Wallbox' },
  { id: 'speicher', label: 'Speicher' },
]

type EGoWallboxSetting = 'MANUAL_OFF' | 'MANUAL_ON'
type BoilerSetting = 'MANUAL_OFF' | 'MANUAL_ON'
let currentEGoWallboxSetting: EGoWallboxSetting = 'MANUAL_OFF'
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
  const { pvData, boilerData, epexData, wallboxData, systemState, refetchBoilerData, refetchEGoData } = useUpdateDataScheduler()

  // Availability Flags
  const available = {
    influx: systemState?.influx === 'ok',
    wallbox: systemState?.wallbox === 'ok',
    boiler: systemState?.boiler === 'ok',
    epex: systemState?.epex === 'ok',
  }

  // UI States grouped
  const [uiState, setUiState] = useState({
    selectedWallboxSetting: 'MANUAL_OFF' as EGoWallboxSetting,
    selectedBoilerSetting: 'MANUAL_OFF' as BoilerSetting,
    priorities: INITIAL_PRIORITIES as PriorityItem[],
  })

  React.useEffect(() => {
    if (boilerData?.heating !== undefined) {
      const initialSetting: BoilerSetting = boilerData.heating ? 'MANUAL_ON' : 'MANUAL_OFF'
      setUiState((prev) => {
        // Nur setzen wenn unterschiedlich, um Loop zu vermeiden
        if (prev.selectedBoilerSetting !== initialSetting) {
          currentBoilerSetting = initialSetting
          return { ...prev, selectedBoilerSetting: initialSetting }
        }
        return prev
      })
    }
  }, [boilerData?.heating])

    React.useEffect(() => {
        if (wallboxData?.isCharging !== undefined) {
          const initialSetting: EGoWallboxSetting = wallboxData.isCharging ? 'MANUAL_ON' : 'MANUAL_OFF'
          setUiState((prev) => {
            // Nur setzen wenn unterschiedlich, um Loop zu vermeiden
            if (prev.selectedWallboxSetting !== initialSetting) {
              currentEGoWallboxSetting = initialSetting
              return { ...prev, selectedWallboxSetting: initialSetting }
            }
            return prev
          })
        }
      }, [wallboxData?.isCharging])


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

  // Handlers
  const handleWallboxSelect = async (setting: EGoWallboxSetting) => {
    // Save Old Setting for potential Rollback
    const previousSetting = uiState.selectedWallboxSetting

    // Optimistic Update
    setUiState((prev) => ({...prev, selectedWallboxSetting: setting}))
    currentEGoWallboxSetting = setting

    const success = await allowEGoPower(setting)
    if(success) {
        await refetchEGoData() // Instant Update
    }
    else {
      // Reset UI State
      console.warn('Failed to update wallbox setting on backend - reverting UI')
      setUiState((prev) => ({ ...prev, selectedBoilerSetting: previousSetting }))
      currentBoilerSetting = previousSetting

      // User-Feedback (Toast/Alert)
      Alert.alert('Fehler', 'Boiler-Einstellung konnte nicht geändert werden')
    }

  }
  const handleBoilerSelect = async (setting: BoilerSetting) => {
    // Save Old Setting for potential Rollback
    const previousSetting = uiState.selectedBoilerSetting

    // Optimistic Update
    setUiState((prev) => ({ ...prev, selectedBoilerSetting: setting }))
    currentBoilerSetting = setting

    const success = await toggleBoilerSetting(setting)

    if (success) {
      await refetchBoilerData() // Instant Update
    }
    else {
      // Reset UI State
      console.warn('Failed to update boiler setting on backend - reverting UI')
      setUiState((prev) => ({ ...prev, selectedBoilerSetting: previousSetting }))
      currentBoilerSetting = previousSetting

      // User-Feedback (Toast/Alert)
      Alert.alert('Fehler', 'Boiler-Einstellung konnte nicht geändert werden')
    }
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
          available={available.epex}
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
