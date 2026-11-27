import { useMemo, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { useWidth } from './StockChart'

/** Fixed categorical order (validated palette); a series keeps its color whatever is filtered. */
export const SERIES_COLORS = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#008a17', '#6a4ce2', '#ec4647']
const BAR = '#0d9488'
const GRID = '#e7e7e7'
const AXIS = '#c2c2c2'
const TICK = '#666666'

export function Card({ title, subtitle, children, id }: { title: string; subtitle?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3 min-w-0">
      <div>
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  return (
    <div
      className="absolute pointer-events-none bg-white border border-gray-200 rounded-lg shadow-sm px-2.5 py-1.5 text-xs z-10 max-w-[15rem]"
      style={{ left: Math.max(0, Math.min(x + 12, width - 200)), top: Math.max(0, y - 44) }}
    >
      {children}
    </div>
  )
}

function SourceLink({ url, name }: { url?: string; name?: string }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:text-teal-800 inline-flex items-center gap-1">
      {name || 'Source'} <ExternalLink className="w-3 h-3" />
    </a>
  )
}

// ── Bars per year ─────────────────────────────────────────────────────────────

export interface YearValue { year: number; value: number; detail?: string }

/** One bar per year (missing years count as zero), with an optional "total so far" view on the same axis. */
export function YearBars({ data, format, unit, cumulativeLabel, height = 200 }: {
  data: YearValue[]
  format: (v: number) => string
  unit: string
  /** offer a "Total so far" toggle with this label, e.g. "Facilities open" */
  cumulativeLabel?: string
  height?: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const [cumulative, setCumulative] = useState(false)
  const rows = useMemo(() => {
    if (!data.length) return []
    const by = new Map(data.map(d => [d.year, d]))
    const y0 = Math.min(...data.map(d => d.year))
    const y1 = Math.max(...data.map(d => d.year))
    let run = 0
    return Array.from({ length: y1 - y0 + 1 }, (_, i) => {
      const d = by.get(y0 + i)
      run += d?.value ?? 0
      return { year: y0 + i, value: d?.value ?? 0, total: run, detail: d?.detail }
    })
  }, [data])
  if (rows.length < 2) return <p className="text-xs text-gray-500">Not enough data yet.</p>

  const pad = { top: 10, right: 8, bottom: 22, left: 44 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const val = (r: typeof rows[number]) => (cumulative ? r.total : r.value)
  const max = Math.max(...rows.map(val), 1)
  const step = niceStep(max / 4)
  const top = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const slot = w / rows.length
  const gap = Math.min(2, slot * 0.2)
  const labelEvery = Math.ceil(rows.length / Math.max(1, Math.floor(w / 38)))
  const y = (v: number) => h - (v / top) * h
  const hv = hover != null ? rows[hover] : null

  return (
    <div className="space-y-2">
      {cumulativeLabel && (
        <div className="flex gap-1" role="group" aria-label="View">
          {[false, true].map(c => (
            <button
              key={String(c)}
              onClick={() => setCumulative(c)}
              aria-pressed={cumulative === c}
              className={`text-xs px-2.5 py-1 rounded-full border ${cumulative === c ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'}`}
            >
              {c ? 'Total so far' : 'Per year'}
            </button>
          ))}
        </div>
      )}
      <div ref={ref} className="relative">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={rows.filter(r => val(r) > 0).map(r => `${r.year}: ${format(val(r))}`).join('; ')}
          onMouseLeave={() => setHover(null)}
        >
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map(v => (
              <g key={v}>
                <line x1={0} x2={w} y1={y(v)} y2={y(v)} stroke={v === 0 ? AXIS : GRID} />
                <text x={-8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={TICK}>{format(v)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const v = val(r)
              const bh = v > 0 ? Math.max(2, h - y(v)) : 0
              const bx = i * slot + gap / 2
              const bw = Math.max(1, slot - gap)
              const rr = Math.min(4, bw / 2, bh)
              return (
                <g key={r.year} onMouseEnter={() => setHover(i)}>
                  <rect x={i * slot} y={0} width={slot} height={h} fill="transparent" />
                  {bh > 0 && (
                    <path
                      d={`M${bx},${h} V${h - bh + rr} Q${bx},${h - bh} ${bx + rr},${h - bh} H${bx + bw - rr} Q${bx + bw},${h - bh} ${bx + bw},${h - bh + rr} V${h} Z`}
                      fill={BAR}
                      opacity={hover == null || hover === i ? 1 : 0.55}
                    />
                  )}
                  {i % labelEvery === 0 && (
                    <text x={i * slot + slot / 2} y={h + 16} fontSize={11} fill={TICK} textAnchor="middle">{r.year}</text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
        {hv && (
          <Tooltip x={pad.left + hover! * slot + slot / 2} y={pad.top + y(val(hv))} width={width}>
            <div className="font-semibold text-gray-900">{hv.year}: {format(val(hv))} {cumulative ? `${cumulativeLabel?.toLowerCase()}` : unit}</div>
            {cumulative ? <div className="text-gray-500">{format(hv.value)} {unit} that year</div> : hv.detail && <div className="text-gray-500">{hv.detail}</div>}
          </Tooltip>
        )}
      </div>
    </div>
  )
}

function niceStep(raw: number) {
  if (raw <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(raw))
  const m = raw / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p
}

// ── Points over time ──────────────────────────────────────────────────────────

export interface TimePoint {
  id: string
  t: number            // fractional year
  date: string         // as shown
  value: number
  series: string
  label: string
  detail?: string
  value_text?: string
  source_url?: string
  source_name?: string
  confirmed?: boolean
  note?: string
}

export interface SeriesDef { key: string; label: string; color: string }

export function yearOf(d: string) {
  const y = Number(d.slice(0, 4))
  const m = /^\d{4}-\d{2}/.test(d) ? Number(d.slice(5, 7)) : 7
  return y + (m - 0.5) / 12
}

/**
 * Dots over time on a log or linear axis, with a thin line through each series'
 * running record ("best so far"), legend, hover details and a data table.
 */
export function TimeScatter({ points, series, log = true, format, record = 'max', height = 260, tableValue }: {
  points: TimePoint[]
  series: SeriesDef[]
  log?: boolean
  format: (v: number) => string
  /** draw a line through each series' running maximum or minimum */
  record?: 'max' | 'min' | null
  height?: number
  tableValue?: (p: TimePoint) => string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<TimePoint | null>(null)
  const pts = points.filter(p => Number.isFinite(p.value) && (!log || p.value > 0))
  const used = series.filter(s => pts.some(p => p.series === s.key))
  if (pts.length < 2) return <p className="text-xs text-gray-500">Not enough data yet.</p>
  const color = new Map(series.map(s => [s.key, s.color]))
  const label = new Map(series.map(s => [s.key, s.label]))

  const pad = { top: 12, right: 14, bottom: 24, left: 52 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const x0 = Math.floor(Math.min(...pts.map(p => p.t)))
  const x1 = Math.ceil(Math.max(...pts.map(p => p.t)) + 0.01)
  const vals = pts.map(p => p.value)
  let lo: number, hi: number, ticks: number[]
  if (log) {
    lo = Math.floor(Math.log10(Math.min(...vals)))
    hi = Math.ceil(Math.log10(Math.max(...vals)))
    if (hi === lo) hi += 1
    const every = Math.ceil((hi - lo) / 6)
    ticks = []
    for (let e = lo; e <= hi; e += every) ticks.push(10 ** e)
  } else {
    lo = 0
    const step = niceStep(Math.max(...vals) / 4)
    hi = Math.ceil(Math.max(...vals) / step) * step
    ticks = Array.from({ length: Math.round(hi / step) + 1 }, (_, i) => i * step)
  }
  const x = (t: number) => ((t - x0) / (x1 - x0)) * w
  const y = (v: number) => (log ? h - ((Math.log10(v) - lo) / (hi - lo)) * h : h - (v / hi) * h)
  const span = x1 - x0
  const yearStep = span > 24 ? 5 : span > 12 ? 2 : 1
  const years = Array.from({ length: span + 1 }, (_, i) => x0 + i).filter(v => v % yearStep === 0)

  const lines = record ? used.map(s => {
    const own = pts.filter(p => p.series === s.key).sort((a, b) => a.t - b.t)
    const best: TimePoint[] = []
    for (const p of own) {
      const last = best[best.length - 1]
      if (!last || (record === 'max' ? p.value > last.value : p.value < last.value)) best.push(p)
    }
    // step line: hold each record until the next one
    const d = best.map((p, i) => (i === 0 ? `M${x(p.t)},${y(p.value)}` : `H${x(p.t)} V${y(p.value)}`)).join(' ')
    return { key: s.key, d }
  }) : []

  const sorted = [...pts].sort((a, b) => a.t - b.t)

  return (
    <div className="space-y-2">
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={`${pts.length} data points from ${x0} to ${x1 - 1}${used.length > 1 ? `, for ${used.map(s => s.label).join(', ')}` : ''}. The table under the chart lists them.`}>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {ticks.map(v => (
              <g key={v}>
                <line x1={0} x2={w} y1={y(v)} y2={y(v)} stroke={GRID} />
                <text x={-8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={TICK}>{format(v)}</text>
              </g>
            ))}
            <line x1={0} x2={w} y1={h} y2={h} stroke={AXIS} />
            {years.map(v => (
              <text key={v} x={x(v)} y={h + 17} fontSize={11} fill={TICK} textAnchor="middle">{v}</text>
            ))}
            {lines.map(l => <path key={l.key} d={l.d} fill="none" stroke={color.get(l.key)} strokeWidth={2} opacity={0.45} />)}
            {pts.map(p => (
              <circle
                key={p.id}
                cx={x(p.t)}
                cy={y(p.value)}
                r={hover?.id === p.id ? 6.5 : 4.5}
                fill={p.confirmed === false ? '#ffffff' : color.get(p.series)}
                stroke={p.confirmed === false ? color.get(p.series) : '#ffffff'}
                strokeWidth={2}
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${p.label}: ${format(p.value)} (${p.date})`}</title>
              </circle>
            ))}
          </g>
        </svg>
        {hover && (
          <Tooltip x={pad.left + x(hover.t)} y={pad.top + y(hover.value)} width={width}>
            <div className="font-semibold text-gray-900">{hover.label}</div>
            <div className="text-gray-600">{hover.value_text || format(hover.value)} · {hover.date}</div>
            {hover.detail && <div className="text-gray-500">{hover.detail}</div>}
            {hover.confirmed === false && <div className="text-amber-700">Not confirmed from the source page</div>}
          </Tooltip>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        {used.length > 1 && used.map(s => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        {record && <span className="text-gray-500">Line: best so far</span>}
        {pts.some(p => p.confirmed === false) && (
          <span className="flex items-center gap-1.5 text-gray-500"><span className="w-2.5 h-2.5 rounded-full border-2 border-gray-400" /> Not confirmed</span>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-teal-700 hover:text-teal-800">Data and sources ({pts.length})</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left">
            <thead className="text-gray-500">
              <tr><th className="py-1 pr-3 font-medium">Date</th><th className="py-1 pr-3 font-medium">Result</th>{used.length > 1 && <th className="py-1 pr-3 font-medium">Type</th>}<th className="py-1 pr-3 font-medium text-right">Value</th><th className="py-1 font-medium">Source</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(p => (
                <tr key={p.id} className="align-top">
                  <td className="py-1 pr-3 text-gray-500 whitespace-nowrap">{p.date}</td>
                  <td className="py-1 pr-3 text-gray-800">
                    {p.label}
                    {(p.confirmed === false || p.note) && <div className="text-amber-700">{p.note || 'Not confirmed from the source page.'}</div>}
                  </td>
                  {used.length > 1 && <td className="py-1 pr-3 text-gray-500 whitespace-nowrap">{label.get(p.series)}</td>}
                  <td className="py-1 pr-3 text-right tabular-nums text-gray-900 whitespace-nowrap">{tableValue ? tableValue(p) : p.value_text || format(p.value)}</td>
                  <td className="py-1 whitespace-nowrap"><SourceLink url={p.source_url} name={p.source_name} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export interface TimelineItem { id: string; date: string; title: string; text?: string; source_url?: string; source_name?: string; confirmed?: boolean; note?: string }

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative border-l border-gray-200 ml-2 space-y-3">
      {items.map(i => (
        <li key={i.id} className="ml-4">
          <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-teal-600 ring-2 ring-white" />
          <div className="text-xs text-gray-500 tabular-nums">{i.date}</div>
          <div className="text-sm text-gray-900">{i.title}</div>
          {i.text && <p className="text-xs text-gray-600">{i.text}</p>}
          <div className="text-xs flex flex-wrap gap-x-2">
            <SourceLink url={i.source_url} name={i.source_name} />
            {(i.confirmed === false || i.note) && <span className="text-amber-700">{i.note || 'Not confirmed from the source page.'}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}
