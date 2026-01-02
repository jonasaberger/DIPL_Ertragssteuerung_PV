// services/epex_service.ts

export interface EpexData {
  date: string    // z.B. "2025-12-16"
  time: string    // z.B. "11:00"
  pricePerKWh: number
}

export async function fetchEpexData(): Promise<EpexData | null> {
  try {
    const response = await fetch('http://100.120.107.71:5050/api/epex/latest')
    if (!response.ok) throw new Error('Network response was not ok')
    
    const data = await response.json()
    const rawTime: string = data[0]._time // z.B. "2025-12-16T11:00:00+01:00"
    const [year, month, day] = rawTime.split('T')[0].split('-').map(Number)
    
    // DD.MM.YYYY
    const date = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
     // HH:mm:ss
    const time = rawTime.split('T')[1].slice(0, 8)

    return {
      pricePerKWh: Number(data[0].price.toFixed(1)),
      date,
      time,
    }
  } catch (error) {
    console.error('Failed to fetch EPEX data:', error)
    return null
  }
}
