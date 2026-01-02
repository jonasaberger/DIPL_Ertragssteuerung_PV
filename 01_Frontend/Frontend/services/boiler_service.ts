// services/boiler_service.ts

export interface BoilerData {
  date: string    // z.B. "2025-12-16"
  time: string    // z.B. "11:00"
  temp: number
  heating: boolean
}

export async function fetchBoilerData(): Promise<BoilerData | null> {
  try {
    const response_temp = await fetch('http://100.120.107.71:5050/api/boiler/latest')

    if (!response_temp.ok) {
      console.error(
        'Boiler latest failed:',
        response_temp.status,
        response_temp.statusText
      )
      const text = await response_temp.text()
      console.error('Response body:', text)
      throw new Error('Boiler latest not ok')
    }

    const data_temp = await response_temp.json()
    const rawTime: string = data_temp[0]._time // z.B. "2025-12-16T11:00:00+01:00"
    const [year, month, day] = rawTime.split('T')[0].split('-').map(Number)

    // DD.MM.YYYY
    const date = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
     // HH:mm:ss
    const time = rawTime.split('T')[1].slice(0, 8)

    const response_state = await fetch('http://100.120.107.71:5050/api/boiler/state')
    if (!response_state.ok) throw new Error('Network response was not ok')
    const data_state = await response_state.json()

    return {
      temp: Number(data_temp[0].boiler_temp.toFixed(1)),
      heating: data_state.heating,
      date,
      time,
    }
  } catch (error) {
    console.error('Failed to fetch Boiler data:', error)
    return null
  }
}


