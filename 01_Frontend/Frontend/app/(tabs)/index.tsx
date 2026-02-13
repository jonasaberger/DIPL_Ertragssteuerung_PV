import React, { useState, useEffect } from 'react'
import { ScrollView, StyleSheet, Alert } from 'react-native'
import Toast from 'react-native-toast-message'
import { ThemedView } from '@/components/themed-view'

import HDiagram, { DiagramData } from '@/components/homePage/h-diagram'
import HPrices from '@/components/homePage/h-prices'
import HPriority, { PriorityItem } from '@/components/homePage/h-priority'
import HControlPanel from '@/components/homePage/mode_selection_section/h-control-panel'
import HWallbox from '@/components/homePage/h-wallbox'
import HBoiler from '@/components/homePage/h-boiler'

import { useUpdateDataScheduler } from '@/hooks/useUpdateDataScheduler'
import { toggleBoilerSetting } from '@/services/iot_services/boiler_service'
import { allowEGoPower } from '@/services/iot_services/e_go_service'
import { fetchModeData, setModeData, ModeData, Mode } from '@/services/mode_service'

type EGoWallboxSetting = 'MANUAL_OFF' | 'MANUAL_ON'
type BoilerSetting = 'MANUAL_OFF' | 'MANUAL_ON'

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
    currentMode: 'MANUAL' as Mode,
  })

  // Fetch current mode on component mount
  useEffect(() => {
    const initializeMode = async () => {
      const modeData = await fetchModeData()
      if (modeData) {
        setUiState((prev) => ({
          ...prev,
          currentMode: modeData.mode,
        }))
        console.log('Initialized mode:', modeData.mode)
      } else {
        console.warn('Failed to fetch initial mode, defaulting to MANUAL')
      }
    }

    initializeMode()
  }, [])

  // Sync boiler setting from backend data
  useEffect(() => {
    if (boilerData?.heating !== undefined) {
      const initialSetting: BoilerSetting = boilerData.heating ? 'MANUAL_ON' : 'MANUAL_OFF'
      setUiState((prev) => {
        if (prev.selectedBoilerSetting !== initialSetting) {
          return { ...prev, selectedBoilerSetting: initialSetting }
        }
        return prev
      })
    }
  }, [boilerData?.heating])

  // Sync wallbox setting from backend data
  useEffect(() => {
    if (wallboxData?.isCharging !== undefined) {
      const initialSetting: EGoWallboxSetting = wallboxData.isCharging ? 'MANUAL_ON' : 'MANUAL_OFF'
      setUiState((prev) => {
        if (prev.selectedWallboxSetting !== initialSetting) {
          return { ...prev, selectedWallboxSetting: initialSetting }
        }
        return prev
      })
    }
  }, [wallboxData?.isCharging])

  // --- Rohwerte
  const pvTotal = clamp0(toNum(pvData?.pv_power ?? 0))
  const rawLoad = toNum(pvData?.load_power ?? 0)
  const houseDemand = clamp0(rawLoad < 0 ? -rawLoad : rawLoad)
  const batteryPower = toNum(pvData?.battery_power ?? 0)
  const gridPower = toNum(pvData?.grid_power ?? 0)

  const gridImport = gridPower > 0 ? clamp0(gridPower) : 0
  const gridFeedIn = gridPower < 0 ? clamp0(-gridPower) : 0
  const batteryCharge = batteryPower < 0 ? clamp0(-batteryPower) : 0
  const batteryDischarge = batteryPower > 0 ? clamp0(batteryPower) : 0

  // --- PV-Verteilung
  const pvToHouse = Math.min(houseDemand, pvTotal)
  const pvLeftAfterHouse = clamp0(pvTotal - pvToHouse)
  const pvToBattery = Math.min(batteryCharge, pvLeftAfterHouse)
  const pvLeftAfterBattery = clamp0(pvLeftAfterHouse - pvToBattery)
  const pvToGrid = Math.min(gridFeedIn, pvLeftAfterBattery)

  const houseDeficitAfterPv = clamp0(houseDemand - pvToHouse)
  const batteryToHouse = Math.min(batteryDischarge, houseDeficitAfterPv)
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
    batteryPower,
    gridPower,
  }

  // Handlers
  const handleWallboxSelect = async (setting: EGoWallboxSetting) => {
    const previousSetting = uiState.selectedWallboxSetting

    setUiState((prev) => ({ ...prev, selectedWallboxSetting: setting }))

    const success = await allowEGoPower(setting)
    if (success) {
      await refetchEGoData()
    } else {
      console.warn('Failed to update wallbox setting on backend - reverting UI')
      setUiState((prev) => ({ ...prev, selectedWallboxSetting: previousSetting }))
      Alert.alert('Fehler', 'Wallbox-Einstellung konnte nicht geändert werden')
    }
  }

  const handleBoilerSelect = async (setting: BoilerSetting) => {
    const previousSetting = uiState.selectedBoilerSetting

    setUiState((prev) => ({ ...prev, selectedBoilerSetting: setting }))

    const success = await toggleBoilerSetting(setting)

    if (success) {
      await refetchBoilerData()
    } else {
      console.warn('Failed to update boiler setting on backend - reverting UI')
      setUiState((prev) => ({ ...prev, selectedBoilerSetting: previousSetting }))
      Alert.alert('Fehler', 'Boiler-Einstellung konnte nicht geändert werden')
    }
  }

  const handleModeChange = async (newMode: Mode) => {
    const previousMode = uiState.currentMode

    setUiState((prev) => ({ ...prev, currentMode: newMode }))

    const success = await setModeData({ mode: newMode })

    if (success) {
      console.log('Mode successfully changed to:', newMode)
      showToastMessage(`Modus geändert zu ${newMode}`, true)

    } else {
      console.warn('Failed to update mode on backend - reverting UI')
      showToastMessage('Modus konnte nicht geändert werden', false)
      setUiState((prev) => ({ ...prev, currentMode: previousMode }))
      Alert.alert('Fehler', 'Modus konnte nicht geändert werden')
    }
  }

  const handlePriorityDragEnd = (data: PriorityItem[]) => {
    setUiState((prev) => ({ ...prev, priorities: data }))
    console.log('Ladeprioritäten:', data.map((item) => item.id))
  }

  // Check if manual controls should be shown
  const showManualControls = uiState.currentMode === 'MANUAL'

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <HDiagram data={diagramData} />

        <HControlPanel
          currentMode={uiState.currentMode}
          onModeChange={handleModeChange}
        />

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
          showControls={showManualControls}
        />

        <HWallbox
          energyKWh={wallboxData?.energy ?? 0}
          isCharging={wallboxData?.isCharging ?? false}
          selectedSetting={uiState.selectedWallboxSetting}
          onSelect={handleWallboxSelect}
          carConnected={wallboxData?.carConnected ?? false}
          ampere={wallboxData?.ampere ?? 0}
          available={available.wallbox}
          showControls={showManualControls}
        />
      </ScrollView>
    </ThemedView>
  )
}

const showToastMessage = (message: string, success: boolean) => {
  if (success) {
    Toast.show({
            type: 'success',
            text1: 'Erfolg',
            text2: `${message}`,
            position: 'bottom',
            visibilityTime: 2000,
    })
  } else {
    Toast.show({
            type: 'error',
            text1: 'Error',
            text2: `${message}`,
            position: 'bottom',
            visibilityTime: 2000,
    })
  }
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