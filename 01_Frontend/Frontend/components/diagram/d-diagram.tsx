/* eslint-disable react-hooks/exhaustive-deps */
// components/diagram/d-diagram.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  PanResponder,
  Pressable,
} from 'react-native'
import type { DateSelection } from '@/components/diagram/d-dates'

import { CartesianChart, Line, Scatter } from 'victory-native'
import { useFont } from '@shopify/react-native-skia'
import { fetchDiagramPvPoints, diagramRequestKey, type PvPoint } from '@/services/diagram_service'

type Props = {
  selection: DateSelection
  showSoc?: boolean
}

const COLORS = {
  pv: '#1EAFF3',
  load: '#474646',
  feedIn: '#2FBF71',
  soc: '#F39C12',
}

type Mode = 'day' | 'month' | 'year'

// kriegt eine Zahl, z.B: 5, und macht daraus '05'
function pad2(n: number) {
  return String(n).padStart(2, '0')
}

// ISO-Strings ohne Zeitzone kommen bei uns aus dem Backend als UTC.
// JS würde sie sonst als lokale Zeit interpretieren -> 1h Offset-Bug.
// Wenn bereits eine Zeitzone dabei ist (Z oder +hh:mm), wird normal geparst.
function parseApiTime(iso: string): Date {
  const s = String(iso)
  if (/[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s)) return new Date(s)
  return new Date(s + 'Z')
}

// Entscheidet, in welchem Modus wir sind (Tag/Monat/Jahr) basierend auf der DateSelection
function modeFromSelection(s: DateSelection): Mode {
  if (s.month === null) return 'year'
  if (s.day === null) return 'month'
  return 'day'
}

// begrent eine zahl, damit sie zwischen min und max bleibt
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

// Clamp für die "gefühlte" Cursor-Position:
// Scroll soll am echten Finger hängen (RAW), aber Auswahl soll nicht am Screen-Rand kleben.
function clampVisibleX(xVisible: number, screenWidth: number, mode: Mode) {
  const edge = mode === 'day' ? 40 : 55
  return clamp(xVisible, edge, screenWidth - edge)
}

// Macht aus Zahl eine Watt angabe
function fmtW(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return `${Math.round(n)} W`
}

// Macht aus Zahl eine Prozent angabe
function fmtPct(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return `${Math.round(clamp(n, 0, 100))} %`
}

function fmtKWh(v: number) {
  const n = Number.isFinite(v) ? v : 0
  return `${n.toFixed(2)} kWh`
}

function isoParts(iso: string) {
  const s = String(iso)

  // erwartet: YYYY-MM-DDTHH:MM...
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (m) {
    return {
      y: Number(m[1]),
      mo: Number(m[2]),
      d: Number(m[3]),
      h: Number(m[4]),
      mi: Number(m[5]),
    }
  }

  // Fallback (sollte praktisch nie passieren)
  const dt = new Date(s)
  return {
    y: dt.getFullYear(),
    mo: dt.getMonth() + 1,
    d: dt.getDate(),
    h: dt.getHours(),
    mi: dt.getMinutes(),
  }
}

// Erstellt die Beschriftung für die X-Achse basierend auf dem Modus
function axisLabelForIso(iso: string, mode: Mode) {
  const p = isoParts(iso)
  if (mode === 'day') return `${pad2(p.h)}:${pad2(p.mi)}`
  if (mode === 'month') return `${pad2(p.d)}`
  // Monat als Kurzname (de-AT), ohne Device-Timezone-Abhängigkeit
  const monNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  return monNames[clamp(p.mo, 1, 12) - 1]
}

// Für die genauere Anzeige der Text
function tooltipLabelForIso(iso: string, mode: Mode) {
  const p = isoParts(iso)
  const date = `${pad2(p.d)}.${pad2(p.mo)}.${p.y}`
  const time = `${pad2(p.h)}:${pad2(p.mi)}`
  if (mode === 'day') return `${date} ${time}`
  if (mode === 'month') return `${date} ${time}`
  const monNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
  const mon = monNames[clamp(p.mo, 1, 12) - 1]
  return `${mon} ${date} ${time}`
}

function getDaysInMonth(year: number, month0Based: number) {
  return new Date(year, month0Based + 1, 0).getDate()
}

type ChartRow = {
  x: number
  axisLabel: string
  tipLabel: string
  pv: number
  load: number
  feedIn: number
  socScaled: number
  socPct: number
  t: number
}

type Selected = {
  index: number
  label: string
  pv: number
  load: number
  feedIn: number
  socPct: number
}

// Da so viele Daten für das Jahr sind, wird alle 15 Tage ein Tick gemacht
function yearTickIndices(rows: ChartRow[]) {
  const ticks: number[] = []
  let lastMonth = -1

  // Iteriere durch alle Datenpunkte
  for (let i = 0; i < rows.length; i++) {
    const d = new Date(rows[i].t)
    const m = d.getMonth()
    const day = d.getDate()
    const h = d.getHours()
    const min = d.getMinutes()

    // Überprüfe, ob es der 1. oder 15. Tag des Monats um Mitternacht ist
    const isStart = day === 1 && h === 0 && min === 0
    const isMid = day === 15 && h === 0 && min === 0

    if (m !== lastMonth && isStart) {
      ticks.push(i)
      lastMonth = m
      continue
    }

    if (m === lastMonth && isMid) {
      ticks.push(i)
    }
  }

  return ticks
}

function downsampleMonth(points: PvPoint[]) {
  const out: PvPoint[] = []
  for (const p of points) {
    const d = parseApiTime(p._time)
    if (d.getMinutes() === 0) out.push(p)
  }
  return out.length > 0 ? out : points.filter((_, i) => i % 4 === 0)
}

function aggregateYearByDay(points: PvPoint[]) {
  const map = new Map<string, PvPoint[]>()

  for (const p of points) {
    const d = parseApiTime(p._time)
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    const arr = map.get(key)
    if (arr) arr.push(p)
    else map.set(key, [p])
  }

  const keys = Array.from(map.keys()).sort()
  const out: PvPoint[] = []

  for (const k of keys) {
    const arr = map.get(k) ?? []
    if (arr.length === 0) continue

    let pvMax = 0
    let loadMax = 0
    let feedMax = 0
    let socLast = 0
    let lastT = -Infinity

    for (const p of arr) {
      const pv = Math.max(0, Number(p.pv_power ?? 0))
      const load = Math.max(0, Math.abs(Number(p.load_power ?? 0)))
      const gp = Number(p.grid_power ?? 0)
      const feed = gp < 0 ? Math.abs(gp) : 0

      if (pv > pvMax) pvMax = pv
      if (load > loadMax) loadMax = load
      if (feed > feedMax) feedMax = feed

      const t = parseApiTime(p._time).getTime()
      if (t >= lastT) {
        lastT = t
        socLast = clamp(Number(p.soc ?? 0), 0, 100)
      }
    }

    // Mittags als Repräsentations-Zeitpunkt (stabiler für Labeling als "Tag")
    const noon = parseApiTime(`${k}T12:00:00`)
    out.push({
      _time: noon.toISOString(),
      pv_power: pvMax,
      load_power: -loadMax,
      grid_power: -feedMax,
      soc: socLast,
    })
  }

  return out
}

function integrateEnergy(points: PvPoint[]) {
  if (!points || points.length === 0) {
    return { pvKWh: 0, loadKWh: 0, feedInKWh: 0, socEnd: 0 }
  }

  const sorted = [...points].sort((a, b) => parseApiTime(a._time).getTime() - parseApiTime(b._time).getTime())
  const times = sorted.map(p => parseApiTime(p._time).getTime())

  const diffs: number[] = []
  for (let i = 1; i < times.length; i++) {
    const dt = times[i] - times[i - 1]
    if (dt > 0 && dt < 12 * 60 * 60 * 1000) diffs.push(dt)
  }
  const defaultDt = diffs.length ? diffs.sort((a, b) => a - b)[Math.floor(diffs.length / 2)] : 15 * 60 * 1000

  let pvWh = 0
  let loadWh = 0
  let feedWh = 0

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]
    const nextT = i < sorted.length - 1 ? times[i + 1] : times[i] + defaultDt
    const dtH = clamp((nextT - times[i]) / (1000 * 60 * 60), 0, 12)

    const pv = Math.max(0, Number(cur.pv_power ?? 0))
    const load = Math.max(0, Math.abs(Number(cur.load_power ?? 0)))
    const gp = Number(cur.grid_power ?? 0)
    const feed = gp < 0 ? Math.abs(gp) : 0

    pvWh += pv * dtH
    loadWh += load * dtH
    feedWh += feed * dtH
  }

  const last = sorted[sorted.length - 1]
  const socEnd = clamp(Number(last.soc ?? 0), 0, 100)

  return {
    pvKWh: pvWh / 1000,
    loadKWh: loadWh / 1000,
    feedInKWh: feedWh / 1000,
    socEnd,
  }
}

export const DDiagram: React.FC<Props> = ({ selection, showSoc = true }) => {
  const { width: screenWidth } = useWindowDimensions()
  // skia braucht fonts, denn Skia rendert alles selbst
  const font = useFont(require('../../assets/fonts/Inter.ttf'), 11)

  const [selected, setSelected] = useState<Selected | null>(null) //Aktuell ausgewählter Punkt
  const [rawApiData, setRawApiData] = useState<PvPoint[] | null>(null) //Daten vom API
  const [isLoading, setIsLoading] = useState(false) //State, ob gerade eine API Request läuft
  const [errorText, setErrorText] = useState<string | null>(null) //Fehlermeldung, falls API Request fehlschlägt

  const [detailMode, setDetailMode] = useState<'current' | 'sum'>('current')

  const scrollRef = useRef<ScrollView>(null)
  const scrollXRef = useRef(0)
  const pointsXRef = useRef<number[]>([])
  const lastIdxRef = useRef(-1)

  const viewportWRef = useRef(0)
  const contentWRef = useRef(0)
  const maxScrollRef = useRef(0)

  //useMemo, damit die Werte nur neu berechnet werden, wenn sich die Selection ändert (und nicht bei Neu Rendering)
  const mode = useMemo(() => modeFromSelection(selection), [selection])
  const requestKey = useMemo(() => diagramRequestKey(selection), [selection])

  useEffect(() => {
    setDetailMode('current')
  }, [mode, requestKey])

  const chartData = useMemo(() => {
    const arr = rawApiData ?? []
    if (mode === 'day') return arr
    if (mode === 'month') return downsampleMonth(arr)
    return aggregateYearByDay(arr)
  }, [rawApiData, mode])

  const baseRows = useMemo(() => {
    //Verarbeitet die rohen API-Daten in ein Format, das für das Diagramm geeignet ist
    return (chartData ?? []).map((p, i) => {
      const pv = Math.max(0, Number(p.pv_power ?? 0))
      const load = Math.max(0, Math.abs(Number(p.load_power ?? 0)))

      const gp = Number(p.grid_power ?? 0)
      const feedIn = gp < 0 ? Math.abs(gp) : 0

      const socPct = clamp(Number(p.soc ?? 0), 0, 100)
      const t = parseApiTime(p._time).getTime()

      return {
        x: i,
        axisLabel: axisLabelForIso(p._time, mode),
        tipLabel: tooltipLabelForIso(p._time, mode),
        pv,
        load,
        feedIn,
        socPct,
        t,
      }
    })
  }, [chartData, mode])

  const yMax = useMemo(() => {
    //Bestimmt den maximalen Y-Wert für die Skalierung des Diagramms
    const maxY = Math.max(
      100,
      ...baseRows.map(r => r.pv),
      ...baseRows.map(r => r.load),
      ...baseRows.map(r => r.feedIn),
    )
    //y-Achse endet z.B bei Wert von 4267, auf 4500
    return Math.ceil(maxY / 500) * 500
  }, [baseRows])

  //Bereitet die Daten für das Diagramm vor, inklusive Skalierung des SoC-Werts
  const prepared = useMemo(() => {
    const rows: ChartRow[] = baseRows.map(r => ({
      ...r,
      socScaled: (r.socPct / 100) * yMax,
    }))
    return { rows, yMax }
  }, [baseRows, yMax])

  const title = useMemo(() => {
    if (mode === 'day') return 'Energieverlauf (Tag)'
    if (mode === 'month') return 'Energieverlauf (Monat)'
    return 'Energieverlauf (Jahr)'
  }, [mode])

  //Pixelanzahl für jeden Datenpunkt, abhängig von Modus und Datenanzahl
  const pxPerPoint = useMemo(() => {
    const n = prepared.rows.length
    if (mode === 'day') return 9
    if (mode === 'month') return 3.2
    if (n <= 600) return 3.0
    if (n <= 1500) return 2.8
    if (n <= 3000) return 2.6
    return 2.4
  }, [mode, prepared.rows.length])

  const padding = { top: 20, bottom: 40, left: 55, right: 20 }
  const chartHeight = 260

  const chartWidth = useMemo(() => {
    const n = prepared.rows.length
    if (n === 0) return screenWidth
    return Math.max(screenWidth, n * pxPerPoint + padding.left + padding.right)
  }, [prepared.rows.length, pxPerPoint, screenWidth])

  const yKeys = useMemo(() => {
    return showSoc ? (['pv', 'load', 'feedIn', 'socScaled'] as const) : (['pv', 'load', 'feedIn'] as const)
  }, [showSoc])

  //Kreuzlinie X-Position
  const crossX = useMemo(() => {
    const idx = selected?.index ?? -1
    const xs = pointsXRef.current
    if (idx < 0 || idx >= xs.length) return null
    const x = xs[idx]
    return Number.isFinite(x) ? x : null
  }, [selected?.index, prepared.rows.length])

  //Wählt einen Datenpunkt basierend auf dem Index aus
  const selectIndex = useCallback(
    (idxRaw: number) => {
      const n = prepared.rows.length
      if (n <= 0) return
      const idx = clamp(idxRaw, 0, n - 1)
      const row = prepared.rows[idx]
      if (!row) return
      lastIdxRef.current = idx
      setSelected({
        index: idx,
        label: row.tipLabel,
        pv: row.pv,
        load: row.load,
        feedIn: row.feedIn,
        socPct: row.socPct,
      })
    },
    [prepared.rows],
  )

  //Findet den Index des Datenpunkts, der der gegebenen X-Position am nächsten ist
  const nearestIndexFromChartX = useCallback((xInContent: number) => {
    const xs = pointsXRef.current
    const n = xs.length
    if (n === 0) return -1

    let lo = 0
    let hi = n - 1
    while (hi - lo > 3) {
      const mid = (lo + hi) >> 1
      if (xs[mid] < xInContent) lo = mid
      else hi = mid
    }

    let best = lo
    let bestDist = Math.abs(xs[lo] - xInContent)
    for (let i = lo + 1; i <= hi; i++) {
      const d = Math.abs(xs[i] - xInContent)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return best
  }, [])

  //Scrollt zu einer bestimmten X-Position im Diagramm wenn nötig
  const scrollToX = useCallback((x: number) => {
    const max = maxScrollRef.current
    const next = clamp(x, 0, max)
    if (next === scrollXRef.current) return
    scrollXRef.current = next
    scrollRef.current?.scrollTo({ x: next, animated: false })
  }, [])

  const autoScrollIfNearEdges = useCallback(
    (xVisible: number) => {
      const max = maxScrollRef.current
      if (max <= 0) return

      const edge = mode === 'day' ? 280 : 320
      const mult = mode === 'day' ? 3.9 : 1.4
      const cap = mode === 'day' ? 260 : 140

      if (xVisible < edge) {
        const delta = Math.min(cap, (edge - xVisible) * mult)
        scrollToX(scrollXRef.current - delta)
        return
      }

      if (xVisible > screenWidth - edge) {
        const delta = Math.min(cap, (xVisible - (screenWidth - edge)) * mult)
        scrollToX(scrollXRef.current + delta)
      }
    },
    [mode, screenWidth, scrollToX],
  )

  //PanResponder für Touch-Dinge im Diagramm
  //Ermöglicht das Auswählen von Datenpunkten durch Berühren und Ziehen
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const xVisibleRaw = e.nativeEvent.locationX

        // Scroll-Verhalten bleibt am echten Finger
        // Auswahl/Strich wird "komfortabel" nach innen gedeckelt
        const xVisible = clampVisibleX(xVisibleRaw, screenWidth, mode)
        const xContent = scrollXRef.current + xVisible

        const idx = nearestIndexFromChartX(xContent)
        if (idx >= 0) selectIndex(idx)
      },
      onPanResponderMove: (e) => {
        const xVisibleRaw = e.nativeEvent.locationX

        // Autoscroll am echten Finger (sonst fühlt es sich träge an)
        autoScrollIfNearEdges(xVisibleRaw)

        // Auswahl nicht am Rand kleben lassen
        const xVisible = clampVisibleX(xVisibleRaw, screenWidth, mode)
        const xContent = scrollXRef.current + xVisible

        const idx = nearestIndexFromChartX(xContent)
        if (idx >= 0) selectIndex(idx)
      },
      onPanResponderRelease: () => {},
      onPanResponderTerminate: () => {},
    })
  }, [nearestIndexFromChartX, selectIndex, autoScrollIfNearEdges, screenWidth, mode])

  //x-Achsen Ticks basierend auf dem Modus und der Datenanzahl
  const xTickValues = useMemo(() => {
    const n = prepared.rows.length
    if (n === 0) return []

    if (mode === 'day') {
      const desiredPx = 45
      const step = Math.max(1, Math.round(desiredPx / pxPerPoint))
      const ticks: number[] = []
      for (let i = 0; i < n; i += step) ticks.push(i)
      if (ticks[ticks.length - 1] !== n - 1) ticks.push(n - 1)
      return ticks
    }

    if (mode === 'month') {
      const y = selection.year
      const m0 = selection.month ?? 0
      const dim = getDaysInMonth(y, m0)

      const ticks: number[] = []
      const seen = new Set<number>()

      for (let i = 0; i < n; i++) {
        const d = new Date(prepared.rows[i].t)
        const day = d.getDate()
        const h = d.getHours()
        const min = d.getMinutes()
        if (h === 0 && min === 0 && !seen.has(day)) {
          ticks.push(i)
          seen.add(day)
          if (seen.size >= dim) break
        }
      }

      if (ticks.length === 0) {
        const step = Math.max(1, Math.round(35 / pxPerPoint))
        for (let i = 0; i < n; i += step) ticks.push(i)
      }

      return ticks
    }

    const ticks = yearTickIndices(prepared.rows)
    if (ticks.length > 0) return ticks

    const step = Math.max(1, Math.round(70 / pxPerPoint))
    const fallback: number[] = []
    for (let i = 0; i < n; i += step) fallback.push(i)
    return fallback
  }, [prepared.rows, mode, selection.year, selection.month, pxPerPoint])

  const formatXLabel = useCallback(
    (xIndex: number) => {
      const idx = Math.round(Number(xIndex))
      const r = prepared.rows[idx]
      if (!r) return ''

      if (mode === 'year') {
        const d = new Date(r.t)
        const day = d.getDate()
        const mon = new Intl.DateTimeFormat('de-AT', { month: 'short' }).format(d)
        if (day === 1) return mon
        return `${day}.`
      }

      return r.axisLabel
    },
    [prepared.rows, mode],
  )

  const selectedIndex = selected?.index ?? -1
  const showOverlayMessage = !isLoading && (!!errorText || prepared.rows.length === 0)
  const showFontLoading = !font

  const periodTotals = useMemo(() => {
    const arr = rawApiData ?? []
    if (arr.length === 0) return null
    return integrateEnergy(arr)
  }, [rawApiData])

  //Effekt, der bei Änderung der Selection die Daten vom API lädt (ausgelagert in Service)
  useEffect(() => {
    let alive = true

    setIsLoading(true)
    setErrorText(null)
    setSelected(null)
    setRawApiData(null)

    pointsXRef.current = []
    lastIdxRef.current = -1
    scrollXRef.current = 0
    scrollRef.current?.scrollTo({ x: 0, animated: false })

    ;(async () => {
      try {
        const arr = await fetchDiagramPvPoints(selection)
        if (!alive) return
        setRawApiData(arr)
        setErrorText(arr.length === 0 ? 'Keine Daten für diese Auswahl.' : null)
      } catch (e) {
        if (!alive) return
        setRawApiData(null)
        setErrorText(String((e as any)?.message ?? e))
      } finally {
        if (!alive) return
        setIsLoading(false)
      }
    })()

    return () => {
      alive = false
    }
  }, [requestKey, selection])

  useEffect(() => {
    const n = prepared.rows.length
    if (n <= 0) return
    if (lastIdxRef.current !== -1) {
      selectIndex(lastIdxRef.current)
      return
    }
    selectIndex(n - 1)
  }, [prepared.rows.length, selectIndex])

  if (!font) return null

  return (
    <View style={styles.wrapper}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {isLoading && <ActivityIndicator size="small" />}
      </View>

      <View style={styles.chartBox}>
        {(showOverlayMessage || showFontLoading) && (
          <View style={styles.overlayMessage}>
            <Text style={styles.overlayTitle}>Keine Anzeige möglich</Text>
            <Text style={styles.overlayText} numberOfLines={3}>
              {showFontLoading ? 'Schrift lädt...' : (errorText ?? 'Keine Daten für diese Auswahl.')}
            </Text>
          </View>
        )}

        {!showOverlayMessage && !showFontLoading && (
          <>
            <View style={{ width: '100%', height: chartHeight }}>
              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled
                scrollEventThrottle={16}
                onLayout={(e) => {
                  viewportWRef.current = e.nativeEvent.layout.width
                  const max = Math.max(0, contentWRef.current - viewportWRef.current)
                  maxScrollRef.current = max
                  scrollToX(scrollXRef.current)
                }}
                onContentSizeChange={(w) => {
                  contentWRef.current = w
                  const max = Math.max(0, contentWRef.current - viewportWRef.current)
                  maxScrollRef.current = max
                  scrollToX(scrollXRef.current)
                }}
                onScroll={(e) => {
                  scrollXRef.current = e.nativeEvent.contentOffset.x
                }}
                contentContainerStyle={{ width: chartWidth }}
              >
                <View style={{ width: chartWidth, height: chartHeight }}>
                  {crossX !== null && (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.crosshair,
                        {
                          left: crossX - 1,
                          top: 0,
                          height: chartHeight,
                          width: 2,
                        },
                      ]}
                    />
                  )}

                  <CartesianChart
                    data={prepared.rows}
                    xKey="x"
                    yKeys={yKeys as any}
                    padding={padding}
                    domain={{ x: [0, Math.max(1, prepared.rows.length - 1)], y: [0, prepared.yMax] }}
                    xAxis={{
                      font,
                      tickValues: xTickValues,
                      formatXLabel,
                      labelColor: '#666',
                    }}
                    yAxis={[
                      {
                        font,
                        tickCount: 5,
                        labelColor: '#666',
                        formatYLabel: (v) => `${Math.round(Number(v))} W`,
                      },
                    ]}
                  >
                    {({ points }) => {
                      const pvPts = points.pv ?? []
                      if (pvPts.length > 0) {
                        const xs: number[] = []
                        for (let i = 0; i < pvPts.length; i++) {
                          const x = pvPts[i]?.x
                          xs.push(typeof x === 'number' && Number.isFinite(x) ? x : NaN)
                        }
                        if (xs.every(v => Number.isFinite(v))) pointsXRef.current = xs
                      }

                      const n = pvPts.length
                      const idxOk = selectedIndex >= 0 && selectedIndex < n
                      const pvP = idxOk ? pvPts[selectedIndex] : undefined
                      const loadP = idxOk ? points.load?.[selectedIndex] : undefined
                      const feedP = idxOk ? points.feedIn?.[selectedIndex] : undefined
                      const socP = idxOk ? points.socScaled?.[selectedIndex] : undefined

                      return (
                        <>
                          <Line points={points.pv} color={COLORS.pv} strokeWidth={3} />
                          <Line points={points.load} color={COLORS.load} strokeWidth={3} />
                          <Line points={points.feedIn} color={COLORS.feedIn} strokeWidth={3} />
                          {showSoc && <Line points={points.socScaled} color={COLORS.soc} strokeWidth={3} />}

                          {idxOk && (
                            <>
                              {pvP && <Scatter points={[pvP]} color={COLORS.pv} radius={5} />}
                              {loadP && <Scatter points={[loadP]} color={COLORS.load} radius={5} />}
                              {feedP && <Scatter points={[feedP]} color={COLORS.feedIn} radius={5} />}
                              {showSoc && socP && <Scatter points={[socP]} color={COLORS.soc} radius={5} />}
                            </>
                          )}
                        </>
                      )
                    }}
                  </CartesianChart>
                </View>
              </ScrollView>

              <View
                style={[styles.gestureViewportOverlay, { width: screenWidth, height: chartHeight }]}
                {...panResponder.panHandlers}
              />
            </View>

            <View style={styles.valuesBox}>
              <View style={styles.valuesTopRow}>
                <Text style={styles.valuesTime} numberOfLines={2}>
                  {selected?.label ?? ''}
                </Text>

                <View style={styles.toggleWrap}>
                  <Pressable
                    onPress={() => setDetailMode('current')}
                    style={[styles.togglePill, detailMode === 'current' && styles.togglePillActive]}
                  >
                    <Text style={[styles.toggleText, detailMode === 'current' && styles.toggleTextActive]}>Aktuell</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDetailMode('sum')}
                    style={[styles.togglePill, detailMode === 'sum' && styles.togglePillActive]}
                  >
                    <Text style={[styles.toggleText, detailMode === 'sum' && styles.toggleTextActive]}>Summe</Text>
                  </Pressable>
                </View>
              </View>

              {detailMode === 'current' && (
                <>
                  <ValueRow color={COLORS.pv} label="Erzeugung" value={fmtW(selected?.pv ?? 0)} />
                  <ValueRow color={COLORS.load} label="Hausverbrauch" value={fmtW(selected?.load ?? 0)} />
                  <ValueRow color={COLORS.feedIn} label="Netzeinspeisung" value={fmtW(selected?.feedIn ?? 0)} />
                  {showSoc && <ValueRow color={COLORS.soc} label="Batterieladung" value={fmtPct(selected?.socPct ?? 0)} />}
                </>
              )}

              {detailMode === 'sum' && (
                <>
                  <ValueRow color={COLORS.pv} label="Erzeugung" value={fmtKWh(periodTotals?.pvKWh ?? 0)} />
                  <ValueRow color={COLORS.load} label="Hausverbrauch" value={fmtKWh(periodTotals?.loadKWh ?? 0)} />
                  <ValueRow color={COLORS.feedIn} label="Netzeinspeisung" value={fmtKWh(periodTotals?.feedInKWh ?? 0)} />
                  {showSoc && (
                    <ValueRow color={COLORS.soc} label="Batterieladung (Ende)" value={fmtPct(periodTotals?.socEnd ?? 0)} />
                  )}
                </>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  )
}

const ValueRow: React.FC<{ color: string; label: string; value: string }> = ({ color, label, value }) => (
  <View style={styles.valueRow}>
    <View style={[styles.valueDot, { backgroundColor: color }]} />
    <Text style={styles.valueLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.valueValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
)

const styles = StyleSheet.create({
  wrapper: { paddingTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontSize: 19, fontWeight: '900', color: '#474646' },

  chartBox: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    width: '100%',
    alignSelf: 'stretch',
  },

  overlayMessage: {
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#474646',
    marginBottom: 6,
  },
  overlayText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textAlign: 'center',
  },

  gestureViewportOverlay: {
    position: 'absolute',
    zIndex: 10,
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
  },

  crosshair: {
    position: 'absolute',
    zIndex: 7,
    backgroundColor: 'rgba(120,120,120,0.35)',
  },

  valuesBox: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },

  valuesTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  valuesTime: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#474646',
    flexShrink: 1,
    paddingRight: 6,
  },

  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#F1F1F1',
    borderRadius: 999,
    padding: 3,
    gap: 3,
  },
  togglePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  togglePillActive: {
    backgroundColor: '#1EAFF3',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  valueDot: { width: 10, height: 10, borderRadius: 999 },
  valueLabel: { flex: 1, fontSize: 16, fontWeight: '800', color: '#474646' },
  valueValue: { fontSize: 16, fontWeight: '900', color: '#474646' },
})
