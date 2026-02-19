import React, { useState, useEffect } from 'react'
import { ScrollView, StyleSheet, Alert, View, Text, ActivityIndicator } from 'react-native'
import Toast from 'react-native-toast-message'
import { ThemedView } from '@/components/themed-view'

import HDiagram, { DiagramData } from '@/components/homePage/h-diagram'
import HPrices from '@/components/homePage/h-prices'
import HControlPanel from '@/components/homePage/mode_selection_section/h-control-panel'
import HWallbox from '@/components/homePage/h-wallbox'
import HBoiler from '@/components/homePage/h-boiler'
import HForecast from '@/components/homePage/h-forecast'

import { useUpdateDataScheduler } from '@/hooks/useUpdateDataScheduler'
import { toggleBoilerSetting } from '@/services/iot_services/boiler_service'
import { allowEGoPower } from '@/services/iot_services/e_go_service'
import { fetchModeData, setModeData, ModeData, Mode } from '@/services/mode_services/mode_service'
import { updatePriceOffset } from '@/services/ext_services/epex_service'
import { setEGoAmpere } from '@/services/iot_services/e_go_service'
import { getBackendBaseURL } from '@/services/setting_services/device-backend_configs/backend_config_service'
import {EmergencyConfigModal} from "@/components/settings/s-emergency-config"

type EGoWallboxSetting = 'MANUAL_OFF' | 'MANUAL_ON'
type BoilerSetting = 'MANUAL_OFF' | 'MANUAL_ON'

interface SystemHealthResponse {
  backend: string
  boiler: string
  epex: string
  forecast: string
  influx: string
  timestamp: string
  wallbox: string
}

//Wandelt v in eine Zahl um, falls möglich. Ansonsten 0 zurückgeben. Verhindert NaN Werte in Berechnungen
const toNum = (v: any) => {
  const n = Number(v)
  if (Number.isFinite(n)) {
    return n
  } else {
    return 0
  }
}

// Wandelt negative und ungültige Werte in 0 um.
const clamp0 = (v: number) => {
  if (!Number.isFinite(v)) {
    return 0
  }

  if (v < 0) {
    return 0
  }

  return v
}

export default function HomeScreen() {
  // KEY für Screen Remount
  const [key, setKey] = useState(0)

  const { pvData, boilerData, epexData, wallboxData, systemState, forecastData, refetchBoilerData, refetchEGoData, refetchEpexData } = useUpdateDataScheduler()

  const [healthCheckStatus, setHealthCheckStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [showEmergencyConfig, setShowEmergencyConfig] = useState(false)
  const [healthError, setHealthError] = useState<string>('')

  const available = {
    influx: systemState?.influx === 'ok',
    wallbox: systemState?.wallbox === 'ok', 
    boiler: systemState?.boiler === 'ok',
    epex: systemState?.epex === 'ok',
    forecast: systemState?.forecast === 'ok',
  }

  const [uiState, setUiState] = useState({
    selectedWallboxSetting: 'MANUAL_OFF' as EGoWallboxSetting,
    selectedBoilerSetting: 'MANUAL_OFF' as BoilerSetting,
    currentMode: 'MANUAL' as Mode,
    ampere: 0,
  })

  // Health Check beim Start
  useEffect(() => {
    checkBackendHealth()
  }, [])

  const handleConfigSaved = () => {
    setShowEmergencyConfig(false)
    setKey(prev => prev + 1) // Kompletter Screen Remount
  }

  const checkBackendHealth = async () => {
    try {
      setHealthCheckStatus('loading')
      const baseUrl = await getBackendBaseURL()

      // Manueller Timeout mit AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 Sekunden

      try {
        const response = await fetch(`${baseUrl}/state`, {
          method: 'GET',
          headers: {
            'accept': 'application/json'
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const data: SystemHealthResponse = await response.json()

        // Check if backend is ok
        if (data.backend !== 'ok') {
          setHealthError(`Backend Status: ${data.backend}`)
          setHealthCheckStatus('error')
          setShowEmergencyConfig(true)
          return
        }

        console.log('Backend health check passed:', data)
        setHealthCheckStatus('ok')
        setHealthError('')

      } catch (fetchError: any) {
        clearTimeout(timeoutId) // Timeout löschen bei Fehler
        throw fetchError
      }

    } catch (error: any) {
      let errorMsg = 'Backend nicht erreichbar'
      if (error.name === 'AbortError') {
        errorMsg = 'Verbindungs-Timeout (5s)'
      } else if (error.message) {
        errorMsg = error.message
      }
      setHealthError(errorMsg)
      setHealthCheckStatus('error')
      setShowEmergencyConfig(true)
    }
  }

  // Fetch current mode on component mount
  useEffect(() => {
    if (healthCheckStatus !== 'ok') return

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
  }, [healthCheckStatus])

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

    // Sync ampere from backend data
  useEffect(() => {
    if (wallboxData?.ampere !== undefined) {
      setUiState((prev) => {
        if (prev.ampere !== wallboxData.ampere) {
          return { ...prev, ampere: wallboxData.ampere }
        }
        return prev
      })
    }
  }, [wallboxData?.ampere])


  // --- Rohwerte
  const pvTotal = clamp0(toNum(pvData?.pv_power ?? 0))            //PV-Leistung immer positiv, ungültige Werte zu 0
  const rawLoad = toNum(pvData?.load_power ?? 0)                  // Load kann positiv (Verbrauch) oder negativ (Einspeisung) sein
  const houseDemand = clamp0(rawLoad < 0 ? -rawLoad : rawLoad)    // Hausbedarf immer positiv, ungültige Werte zu 0
  const batteryPower = toNum(pvData?.battery_power ?? 0)          // Batterie-Leistung positiv = Entladung, negativ = Ladung
  const gridPower = toNum(pvData?.grid_power ?? 0)                // Netzleistung positiv = Bezug, negativ = Einspeisung

  const gridImport = gridPower > 0 ? clamp0(gridPower) : 0              // Netzbezug immer positiv
  const gridFeedIn = gridPower < 0 ? clamp0(-gridPower) : 0             // Netzeinspeisung immer positiv, deswegen -gridPower
  const batteryCharge = batteryPower < 0 ? clamp0(-batteryPower) : 0    // Barratel immer positiv, deswegen -batteryPower
  const batteryDischarge = batteryPower > 0 ? clamp0(batteryPower) : 0  // Batterieentladung immer positiv

  // --- PV-Verteilung
  const pvToHouse = Math.min(houseDemand, pvTotal)                      //PV -> Haus; kann nicht mehr sein als Hausbedarf oder PV-Leistung, deswegen Minimum
  const pvLeftAfterHouse = clamp0(pvTotal - pvToHouse)                  //PV nach Abzug von Hausbedarf
  const pvToBattery = Math.min(batteryCharge, pvLeftAfterHouse)         //PV -> Batterie; kann nicht mehr sein als Batterieladerate oder PV-Leistung nach Haus, deswegen Minimum
  const pvLeftAfterBattery = clamp0(pvLeftAfterHouse - pvToBattery)     //PV nach Abzug von Batteriebedarf
  const pvToGrid = Math.min(gridFeedIn, pvLeftAfterBattery)             //PV -> Netz; Einspeisung passiert nur mit dem Rest 

  const houseDeficitAfterPv = clamp0(houseDemand - pvToHouse)                         //Wenn PV nicht genug war, bleibt Bedarf übrig
  const batteryToHouse = Math.min(batteryDischarge, houseDeficitAfterPv)              //Batterie kann nur so viel zum Haus beitragen wie sie entlädt und wie der verbleibende Bedarf ist
  const houseDeficitAfterPvAndBattery = clamp0(houseDeficitAfterPv - batteryToHouse)  //Restdefizit nach PV und Batterie
  const gridToHouse = Math.min(gridImport, houseDeficitAfterPvAndBattery)             //Netz -> Haus; Netz deckt Rest ab

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

  const handleAmpereChange = async (newAmpere: number) => {
    const previousAmpere = uiState.ampere
    setUiState((prev) => ({ ...prev, ampere: newAmpere }))

    const success = await setEGoAmpere(newAmpere)

    if (success) {
      await refetchEGoData()
    } else {
      console.warn('Failed to update ampere on backend - reverting UI')
      setUiState((prev) => ({ ...prev, ampere: previousAmpere }))
      Alert.alert('Fehler', 'Ladestrom konnte nicht geändert werden')
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

  const handleOffsetUpdate = async (newOffset: number) => {
    await updatePriceOffset(newOffset)
    if (refetchEpexData) {
      await refetchEpexData()
    }
  }

  const showManualControls = uiState.currentMode === 'MANUAL'

  // Loading Screen
  if (healthCheckStatus === 'loading') {
    return (
      <ThemedView style={styles.screen}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Verbinde mit Backend...</Text>
        </View>
      </ThemedView>
    )
  }

  // Error Screen mit Emergency Config
  if (healthCheckStatus === 'error') {
    return (
      <ThemedView style={styles.screen}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Backend nicht erreichbar</Text>
          <Text style={styles.errorMessage}>{healthError}</Text>
          
          <View style={styles.errorActions}>
            <Text style={styles.errorHint}>
              Bitte Backend-Konfiguration überprüfen
            </Text>
          </View>
        </View>

        {/* Emergency Config Modal */}
        <EmergencyConfigModal
        visible={showEmergencyConfig}
        errorMessage={healthError}
        onCancel={() => setShowEmergencyConfig(false)}
        onConfigSaved={() => {
            handleConfigSaved()
        }}
      />

      </ThemedView>
    )
  }

  // Normal App Content
  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <HDiagram data={diagramData} />

        <HForecast data={forecastData} available={available.forecast}/>

        <HControlPanel
          currentMode={uiState.currentMode}
          onModeChange={handleModeChange}
        />

        <HPrices
          date={epexData?.date ?? '--'}
          time={epexData?.time ?? '--'}
          priceRaw={epexData?.priceRaw ?? 0}
          priceOffset={epexData?.priceOffset ?? 0}
          pricePerKWh={epexData?.pricePerKWh ?? 0}
          available={available.epex && epexData !== null}
          onOffsetUpdate={handleOffsetUpdate}
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
          onAmpereChange={handleAmpereChange}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#474646',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorActions: {
    alignItems: 'center',
    gap: 12,
  },
  errorHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },

  configButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  configButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  retryButtonText: {
    color: '#474646',
    fontSize: 15,
    fontWeight: '600',
  },
})