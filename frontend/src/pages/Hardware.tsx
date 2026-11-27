import { useMemo, useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, ArrowDown, ArrowUp } from 'lucide-react'
import { loadData, useData, formatMonthOrDay, type CompanyRecord, type HardwareRecord, type Machine, type Milestone } from '../lib/data'
import { PLATFORM_LABELS } from '../lib/companies'

export const STATUS_LABEL: Record<Machine['status'], string> = {
  available: 'Available',
  announced: 'Announced',
  research: 'Research result',
}

function BuilderLink({ r, names }: { r: { company: string; builder: string }; names: Map<string, string> }) {
  return r.company
    ? <Link to={`/companies/${r.company}`} className="hover:text-teal-700">{names.get(r.company) ?? r.builder}</Link>
    : <>{r.builder}</>
}

function SourceLink({ url, name }: { url: string; name: string }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:text-teal-800 inline-flex items-center gap-0.5" aria-label={`Source: ${name}`}>
      <ExternalLink className="w-3.5 h-3.5" />
    </a>
  )
}

// ── Qubits over time: one dot per machine, log scale ──────────────────────────

function QubitChart({ machines }: { machines: Machine[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<Machine | null>(null)
  const pts = machines.filter(m => m.qubits && m.qubits > 0 && /^\d{4}-\d{2}/.test(m.date))
  const enough = pts.length >= 3
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [enough])
  if (!enough) return null
  const t = (d: string) => Number(d.slice(0, 4)) + (Number(d.slice(5, 7)) - 0.5) / 12
  const height = 240
  const pad = { top: 12, right: 16, bottom: 24, left: 44 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const x0 = Math.floor(Math.min(...pts.map(m => t(m.date))))
  const x1 = Math.ceil(Math.max(...pts.map(m => t(m.date))) + 0.01)
  const maxQ = Math.max(...pts.map(m => m.qubits!))
  const yTicks = [1, 10, 100, 1000, 10000].filter(v => v <= maxQ * 10).slice(0, 5)
  const yMax = Math.log10(Math.max(yTicks[yTicks.length - 1], maxQ))
  const x = (v: number) => ((v - x0) / (x1 - x0)) * w
  const y = (q: number) => h - (Math.log10(q) / yMax) * h
  const yearTicks = Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i)
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-2">
      <div>
        <h2 className="text-sm font-medium text-gray-900">Physical qubits over time</h2>
        <p className="text-xs text-gray-500">One dot per machine in this list, on a log scale. Qubit counts aren't comparable across platforms on their own; quality matters as much.</p>
      </div>
      <div ref={ref} className="relative">
        <svg width={width} height={height} role="img" aria-label={`Qubit counts of ${pts.length} machines from ${x0} to ${x1 - 1}; the table below lists them.`}>
          <g transform={`translate(${pad.left},${pad.top})`}>
            {yTicks.map(v => (
              <g key={v}>
                <line x1={0} x2={w} y1={y(v)} y2={y(v)} stroke="#e5e7eb" />
                <text x={-8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="#9ca3af">{v.toLocaleString('en-US')}</text>
              </g>
            ))}
            {yearTicks.map(v => (
              <text key={v} x={x(v)} y={h + 17} fontSize={11} fill="#9ca3af" textAnchor="middle">{v}</text>
            ))}
            {pts.map(m => (
              <circle
                key={m.id}
                cx={x(t(m.date))}
                cy={y(m.qubits!)}
                r={hover?.id === m.id ? 6.5 : 5}
                fill={m.status === 'available' ? '#0d9488' : '#ffffff'}
                stroke="#0d9488"
                strokeWidth={2}
                onMouseEnter={() => setHover(m)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{`${m.builder} ${m.name}: ${m.qubits} qubits`}</title>
              </circle>
            ))}
          </g>
        </svg>
        {hover && (
          <div
            className="absolute pointer-events-none bg-white border border-gray-200 rounded-lg shadow-sm px-2.5 py-1.5 text-xs"
            style={{ left: Math.min(pad.left + x(t(hover.date)) + 10, width - 180), top: Math.max(0, pad.top + y(hover.qubits!) - 40) }}
          >
            <div className="font-semibold text-gray-900">{hover.builder} {hover.name}</div>
            <div className="text-gray-500">{hover.qubits!.toLocaleString('en-US')} qubits · {PLATFORM_LABELS[hover.platform] ?? hover.platform} · {formatMonthOrDay(hover.date)}</div>
          </div>
        )}
      </div>
      <div className="flex gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-teal-600" /> Announced or research result</span>
      </div>
    </section>
  )
}

// ── Machines table ────────────────────────────────────────────────────────────

type SortKey = 'builder' | 'date' | 'qubits' | 'fidelity'

export function MachineRows({ machines, names, showBuilder = true }: { machines: Machine[]; names: Map<string, string>; showBuilder?: boolean }) {
  return (
    <>
      {machines.map(m => (
        <tr key={m.id} className="align-top">
          {showBuilder && <td className="py-2 pr-3 text-gray-700 whitespace-nowrap"><BuilderLink r={m} names={names} /></td>}
          <td className="py-2 pr-3">
            <div className="font-medium text-gray-900">{m.name}</div>
            {m.highlight && <div className="text-xs text-gray-500 max-w-xs">{m.highlight}</div>}
            {(!m.confirmed || m.note) && <div className="text-xs text-amber-700 max-w-xs">{m.note ?? 'Not yet confirmed from the source page.'}</div>}
          </td>
          <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{m.date ? formatMonthOrDay(m.date) : ''}</td>
          <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
            {PLATFORM_LABELS[m.platform] ?? m.platform}
            <div className="text-xs text-gray-400">{STATUS_LABEL[m.status] ?? m.status}</div>
          </td>
          <td className="py-2 pr-3 text-right tabular-nums text-gray-900">
            {m.qubits?.toLocaleString('en-US') ?? '—'}
            {m.logical_qubits ? <div className="text-xs text-gray-500">{m.logical_qubits} logical</div> : null}
          </td>
          <td className="py-2 pr-3 text-right tabular-nums text-gray-900">
            {m.two_qubit_fidelity != null ? `${m.two_qubit_fidelity}%` : '—'}
            {m.fidelity_text && <div className="text-xs text-gray-500 max-w-[10rem] ml-auto">{m.fidelity_text}</div>}
          </td>
          <td className="py-2 text-right"><SourceLink url={m.source_url} name={m.source_name} /></td>
        </tr>
      ))}
    </>
  )
}

function SortHeader({ k, label, sort, setSort, right }: { k: SortKey; label: string; sort: [SortKey, 1 | -1]; setSort: (s: [SortKey, 1 | -1]) => void; right?: boolean }) {
  const active = sort[0] === k
  return (
    <th className={`py-2 pr-3 font-medium ${right ? 'text-right' : 'text-left'}`} aria-sort={active ? (sort[1] === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort([k, active ? (sort[1] === 1 ? -1 : 1) : (k === 'builder' ? 1 : -1)])} className="inline-flex items-center gap-1 hover:text-gray-900">
        {label}
        {active && (sort[1] === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    </th>
  )
}

// ── Roadmap timeline ──────────────────────────────────────────────────────────

export function Roadmap({ milestones, names, showBuilder = true }: { milestones: Milestone[]; names: Map<string, string>; showBuilder?: boolean }) {
  const byYear = useMemo(() => {
    const m = new Map<number, Milestone[]>()
    for (const r of milestones) m.set(r.year, [...(m.get(r.year) ?? []), r])
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [milestones])
  return (
    <ol className="relative border-l-2 border-gray-200 ml-2 space-y-5">
      {byYear.map(([year, list]) => (
        <li key={year} className="pl-5 relative">
          <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-teal-600 ring-2 ring-white" aria-hidden="true" />
          <div className="text-sm font-semibold text-gray-900">{year}</div>
          <ul className="mt-1 space-y-1.5">
            {list.map(r => (
              <li key={r.id} className="text-sm text-gray-700 flex items-start gap-1.5">
                <span className="min-w-0">
                  {showBuilder && <span className="font-medium text-gray-900"><BuilderLink r={r} names={names} />: </span>}
                  {r.target}
                  {(!r.confirmed || r.note) && <span className="block text-xs text-amber-700">{r.note ?? 'Not yet confirmed from the source page.'}</span>}
                </span>
                <SourceLink url={r.source_url} name={r.source_name} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

export default function Hardware() {
  const { data, error } = useData(() => Promise.all([
    loadData<HardwareRecord[]>('hardware.json'),
    loadData<CompanyRecord[]>('companies.json'),
  ]))
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<[SortKey, 1 | -1]>(['date', -1])

  if (error) return <p className="text-center text-gray-500 py-12">{error}</p>
  if (!data) return <p className="text-center text-gray-500 py-12">Loading…</p>
  const [records, companies] = data
  const names = new Map(companies.map(c => [c.slug, c.name]))
  const machines = records.filter((r): r is Machine => r.kind === 'machine')
  const milestones = records.filter((r): r is Milestone => r.kind === 'milestone')
  const platforms = [...new Set(machines.map(m => m.platform))].sort()
  const shown = machines
    .filter(m => (!platform || m.platform === platform) && (!status || m.status === status))
    .sort((a, b) => {
      const [k, dir] = sort
      const val = (m: Machine) => k === 'builder' ? (names.get(m.company) ?? m.builder).toLowerCase()
        : k === 'date' ? m.date : k === 'qubits' ? (m.qubits ?? -1) : (m.two_qubit_fidelity ?? -1)
      const va = val(a), vb = val(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir
    })
  const shownMilestones = milestones.filter(m => !platform || machines.some(x => x.company === m.company && x.platform === platform))
  const selectClass = 'bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-teal-500'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hardware tracker</h1>
        <p className="text-gray-500 text-sm max-w-2xl">
          Quantum computers and processors with their qubit counts and two-qubit gate fidelities, and the targets companies have published in their roadmaps.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={platform} onChange={e => setPlatform(e.target.value)} className={selectClass} aria-label="Platform">
          <option value="">All platforms</option>
          {platforms.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{shown.length} of {machines.length} machines</span>
      </div>

      <QubitChart machines={shown} />

      <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 border-b border-gray-200">
            <tr>
              <SortHeader k="builder" label="Builder" sort={sort} setSort={setSort} />
              <th className="py-2 pr-3 font-medium text-left">Machine</th>
              <SortHeader k="date" label="Date" sort={sort} setSort={setSort} />
              <th className="py-2 pr-3 font-medium text-left">Platform</th>
              <SortHeader k="qubits" label="Qubits" sort={sort} setSort={setSort} right />
              <SortHeader k="fidelity" label="2-qubit fidelity" sort={sort} setSort={setSort} right />
              <th className="py-2 font-medium text-right"><span className="sr-only">Source</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <MachineRows machines={shown} names={names} />
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-3">
          Companies report fidelity differently (median or best pair, error or fidelity), so the wording each company used is shown under the figure.
        </p>
      </section>

      {shownMilestones.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Published roadmaps</h2>
            <p className="text-xs text-gray-500">Targets as each company announced them. Roadmaps slip; treat dates as goals, not forecasts.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
            <Roadmap milestones={shownMilestones} names={names} />
          </div>
        </section>
      )}

      <p className="text-xs text-gray-400">
        A curated list; edit backend/app/hardware/hardware.json in the repository to add or correct a machine or milestone.
      </p>
    </div>
  )
}
