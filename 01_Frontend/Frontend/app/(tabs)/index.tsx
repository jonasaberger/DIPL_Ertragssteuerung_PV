import React, { useState } from 'react'
import { ScrollView, StyleSheet, Alert } from 'react-native'
import { ThemedView } from '@/components/themed-view'

import HDiagram, { DiagramData } from '@/components/homePage/h-diagram'
import HPrices from '@/components/homePage/h-prices'
import HPriority, { PriorityItem } from '@/components/homePage/h-priority'
import HWallbox from '@/components/homePage/h-wallbox'
import HBoiler from '@/components/homePage/h-boiler'

import { useUpdateDataScheduler } from '@/hooks/useUpdateDataScheduler'
import { toggleBoilerSetting } from '@/services/iot_services/boiler_service'
import {allowEGoPower} from '@/services/iot_services/e_go_service'

/*const INITIAL_PRIORITIES: PriorityItem[] = [
  { id: 'boiler', label: 'Boiler' },
  { id: 'wallbox', label: 'e-Go Wallbox' },
  { id: 'speicher', label: 'Speicher' },
]*/

type EGoWallboxSetting = 'MANUAL_OFF' | 'MANUAL_ON'
type BoilerSetting = 'MANUAL_OFF' | 'MANUAL_ON'
let currentEGoWallboxSetting: EGoWallboxSetting = 'MANUAL_OFF'
let currentBoilerSetting: BoilerSetting = 'MANUAL_OFF'


const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const clamp0 = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0)

export default function HomeScreen() {
  const { pvData, boilerData, epexData, wallboxData, systemState, refetchBoilerData, refetchEGoData } = useUpdateDataScheduler()

  const available = {
    influx: systemState?.influx === 'ok',
    wallbox: systemState?.wallbox === 'ok',
    boiler: systemState?.boiler === 'ok',
    epex: systemState?.epex === 'ok',
  }

  const [uiState, setUiState] = useState({
    selectedWallboxSetting: 'MANUAL_OFF' as EGoWallboxSetting,
    selectedBoilerSetting: 'MANUAL_OFF' as BoilerSetting,
    // priorities: INITIAL_PRIORITIES as PriorityItem[],
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

        {/* <HPriority
          priorities={uiState.priorities}
          onDragEnd={handlePriorityDragEnd}
        /> */}

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
