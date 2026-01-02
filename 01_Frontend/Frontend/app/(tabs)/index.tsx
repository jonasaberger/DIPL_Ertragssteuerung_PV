import HDiagram, { DiagramData } from '@/components/homePage/h-diagram'
import HPrices from '@/components/homePage/h-prices'
import HPriority, { PriorityItem } from '@/components/homePage/h-priority'
import HWallbox from '@/components/homePage/h-wallbox'
import { ThemedView } from '@/components/themed-view'
import { EpexData, fetchEpexData } from '@/services/epex_service'
import {BoilerData, fetchBoilerData} from '@/services/boiler_service'
import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

const data: DiagramData = {
  total: 400,
  house: 150,
  battery: 200,
  grid: 50,
}

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

  // EPEX data state
  const [epexData, setEpexData] = useState<EpexData | null>(null)

  // Boiler data state
  const [boilerData, setBoilerData] = useState<BoilerData | null>(null)


  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    let intervalId: ReturnType<typeof setInterval>
    let isMounted = true

    const fetchData = async () => {
      try {
        const [epex, boiler] = await Promise.all([
          fetchEpexData(),
          fetchBoilerData(),
        ])
        console.log('Fetched data:', { epex, boiler });

        if (isMounted) {
          if (epex) setEpexData(epex)
          if (boiler) setBoilerData(boiler)
        }
      } catch (error) {
        console.error('Fehler beim Laden der Daten:', error)
      }
    }

    const scheduleNextFetch = () => {
      const now = new Date()

      const msUntilNextHour =
        (60 - now.getMinutes()) * 60 * 1000 -
        now.getSeconds() * 1000 -
        now.getMilliseconds()

      timeoutId = setTimeout(() => {
        fetchData()
        intervalId = setInterval(fetchData, 60 * 60 * 1000)
      }, msUntilNextHour)
    }

    // Initial load
    fetchData()

    scheduleNextFetch()

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [])



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
        <HDiagram data={data} />
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
