// Small, dependency-free chart pieces for share prices: a line chart with a
// hover crosshair, a sparkline, a range picker and a percent-change label.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Point } from '../lib/data'

const LINE = '#0d9488'      // teal-600, the site's accent
const GRID = '#e5e7eb'      // gray-200
const AXIS_TEXT = '#9ca3af' // gray-400
const SPARK = '#6b7280'     // gray-500

// ── Formatting ───────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', CAD: 'C$', AUD: 'A$' }

export function formatPrice(value: number | null | undefined, currency = 'USD') {
  if (value == null) return '—'
  const symbol = CURRENCY_SYMBOL[currency] ?? ''
  const digits = value < 10 ? 2 : value < 1000 ? 2 : 0
  const n = value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return symbol ? `${symbol}${n}` : `${n} ${currency}`.trim()
}

export function formatDay(d: string, withYear = true) {
  const date = new Date(`${d}T12:00:00Z`)
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
  })
}

/** Percent change with a sign and an arrow, so direction never rests on color alone. */
export function Change({ value, className = '' }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={`text-gray-400 ${className}`}>—</span>
  const up = value > 0
  const flat = value === 0
  const color = flat ? 'text-gray-500' : up ? 'text-emerald-700' : 'text-red-600'
  const arrow = flat ? '' : up ? '▲ ' : '▼ '
  return (
    <span className={`tabular-nums whitespace-nowrap ${color} ${className}`}>
      {arrow}{up ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}

export function pctChange(series: Point[]): number | null {
  if (series.length < 2 || !series[0][1]) return null
  return (series[series.length - 1][1] / series[0][1] - 1) * 100
}

// ── Ranges ───────────────────────────────────────────────────────────────────

export const RANGES = [
  { key: '1M', days: 31 },
  { key: '3M', days: 92 },
  { key: '6M', days: 183 },
  { key: 'YTD', days: 0 },
  { key: '1Y', days: 366 },
  { key: 'All', days: Infinity },
] as const
export type RangeKey = typeof RANGES[number]['key']

export function sliceRange(series: Point[], range: RangeKey): Point[] {
  if (!series.length) return series
  const last = new Date(`${series[series.length - 1][0]}T12:00:00Z`)
  let start: string
  if (range === 'All') return series
  if (range === 'YTD') {
    start = `${last.getUTCFullYear() - 1}-12-31`
    // Begin from the last close of the previous year, so the change is year to date.
    const prior = series.filter(([d]) => d <= start)
    const from = prior.length ? prior[prior.length - 1][0] : series[0][0]
    return series.filter(([d]) => d >= from)
  }
  const days = RANGES.find(r => r.key === range)!.days
  start = new Date(last.getTime() - days * 86400000).toISOString().slice(0, 10)
  return series.filter(([d]) => d >= start)
}

export function RangePicker({ value, onChange }: { value: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Time range">
      {RANGES.map(r => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          aria-pressed={value === r.key}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            value === r.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {r.key}
        </button>
      ))}
    </div>
  )
}

// ── Line chart ───────────────────────────────────────────────────────────────

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) { min -= 1; max += 1 }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw
  const ticks = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(10))
  return ticks
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export function LineChart({
  series,
  height = 220,
  format,
  label,
  baseline = true,
}: {
  series: Point[]
  height?: number
  format: (v: number) => string
  label: string
  baseline?: boolean
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const pad = { top: 12, right: 12, bottom: 24, left: 52 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom

  const geom = useMemo(() => {
    if (series.length < 2) return null
    const values = series.map(p => p[1])
    let lo = Math.min(...values)
    let hi = Math.max(...values)
    const padY = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 1
    lo -= padY
    hi += padY
    const ticks = niceTicks(lo, hi)
    lo = Math.min(lo, ticks[0])
    hi = Math.max(hi, ticks[ticks.length - 1])
    const x = (i: number) => (i / (series.length - 1)) * w
    const y = (v: number) => h - ((v - lo) / (hi - lo)) * h
    const path = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')
    const xLabels = [0, Math.floor((series.length - 1) / 2), series.length - 1]
    return { x, y, ticks, path, xLabels }
  }, [series, w, h])

  if (!geom) {
    return (
      <div ref={ref} style={{ height }} className="flex items-center justify-center text-sm text-gray-400">
        Not enough price history yet.
      </div>
    )
  }

  const { x, y, ticks, path, xLabels } = geom
  const change = pctChange(series)
  const summary = `${label}: ${format(series[0][1])} on ${formatDay(series[0][0])} to ${format(series[series.length - 1][1])} on ${formatDay(series[series.length - 1][0])}${change != null ? ` (${change >= 0 ? '+' : ''}${change.toFixed(1)}%)` : ''}.`

  const onMove = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect()
    const px = clientX - rect.left - pad.left
    const i = Math.round((px / w) * (series.length - 1))
    setHover(Math.max(0, Math.min(series.length - 1, i)))
  }

  const hp = hover != null ? series[hover] : null
  const tipLeft = hover != null ? pad.left + x(hover) : 0
  const tipRight = tipLeft > width * 0.6

  return (
    <div ref={ref} className="relative select-none" style={{ height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        className="block touch-pan-y"
        onMouseMove={e => onMove(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={e => onMove(e.touches[0].clientX, e.currentTarget)}
        onTouchMove={e => onMove(e.touches[0].clientX, e.currentTarget)}
        onTouchEnd={() => setHover(null)}
      >
        <g transform={`translate(${pad.left},${pad.top})`}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={-8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
                {format(t)}
              </text>
            </g>
          ))}
          {xLabels.map((i, k) => (
            <text
              key={i}
              x={x(i)}
              y={h + 17}
              fontSize={11}
              fill={AXIS_TEXT}
              textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}
            >
              {formatDay(series[i][0])}
            </text>
          ))}
          {baseline && (
            <line
              x1={0} x2={w} y1={y(series[0][1])} y2={y(series[0][1])}
              stroke={AXIS_TEXT} strokeWidth={1} strokeDasharray="3 3"
            />
          )}
          <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hp && hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={0} y2={h} stroke="#9ca3af" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(hp[1])} r={4.5} fill={LINE} stroke="#fff" strokeWidth={2} />
            </g>
          )}
          {/* full-height hit area */}
          <rect x={0} y={0} width={w} height={h} fill="transparent" />
        </g>
      </svg>
      {hp && (
        <div
          className="absolute top-1 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-sm px-2.5 py-1.5 text-xs"
          style={tipRight ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }}
        >
          <div className="text-gray-500">{formatDay(hp[0])}</div>
          <div className="font-semibold text-gray-900 tabular-nums">{format(hp[1])}</div>
          {series[0][1] ? <Change value={(hp[1] / series[0][1] - 1) * 100} className="text-[11px]" /> : null}
        </div>
      )}
    </div>
  )
}

// ── Sparkline ────────────────────────────────────────────────────────────────

export function Sparkline({ series, width = 96, height = 28 }: { series: Point[]; width?: number; height?: number }) {
  if (series.length < 2) return <span className="inline-block text-xs text-gray-300" style={{ width }}>—</span>
  const values = series.map(p => p[1])
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const x = (i: number) => 2 + (i / (series.length - 1)) * (width - 6)
  const y = (v: number) => 3 + (1 - (v - lo) / span) * (height - 6)
  const d = series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')
  const last = series.length - 1
  return (
    <svg width={width} height={height} aria-hidden="true" className="block">
      <path d={d} fill="none" stroke={SPARK} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(values[last])} r={2.5} fill={LINE} />
    </svg>
  )
}

export function ExampleNotice() {
  return (
    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      Example prices for this preview only. They are made up; real prices load on the first daily data refresh.
    </p>
  )
}
