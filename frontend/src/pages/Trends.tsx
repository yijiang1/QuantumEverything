import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import {
  loadData, loadPolicy, loadStocks, useData,
  type CompanyRecord, type Deal, type Facility, type PolicyData, type StocksData, type TrendPoint,
} from '../lib/data'
import { LineChart } from '../components/StockChart'
import { Card, SERIES_COLORS, TimeScatter, Timeline, YearBars, yearOf, type SeriesDef, type TimePoint, type YearValue } from '../components/TrendCharts'
import { RAISES, formatMillions } from './Funding'

const PLATFORMS: SeriesDef[] = [
  ['superconducting', 'Superconducting'],
  ['trapped_ion', 'Trapped ion'],
  ['neutral_atom', 'Neutral atom'],
  ['photonic', 'Photonic'],
  ['spin', 'Spin / silicon'],
  ['other', 'NMR and other'],
].map(([key, label], i) => ({ key, label, color: SERIES_COLORS[i] }))
const PLATFORM_KEYS = new Set(PLATFORMS.map(p => p.key))

function toPoint(r: TrendPoint, series = PLATFORM_KEYS.has(r.platform) ? r.platform : 'other'): TimePoint {
  return {
    id: r.id, t: yearOf(r.date), date: r.date, value: r.value ?? NaN, series,
    label: r.label, detail: [r.group, r.description].filter(Boolean).join(' · '),
    value_text: r.value_text, source_url: r.source_url, source_name: r.source_name, confirmed: r.confirmed, note: r.note,
  }
}

const compact = (v: number) => v >= 1e6 ? `${+(v / 1e6).toPrecision(3)}M` : v >= 1e3 ? `${+(v / 1e3).toPrecision(3)}K` : `${+v.toPrecision(3)}`
const count = (v: number) => Math.round(v).toLocaleString('en-US')
const pct = (v: number) => `${+v.toPrecision(2)}%`
const micro = (v: number) => v < 1 ? `${+(v * 1000).toPrecision(3)} ns` : v >= 1000 ? `${+(v / 1000).toPrecision(3)} ms` : `${+v.toPrecision(3)} µs`

function perYear<T>(rows: T[], year: (r: T) => number | null | undefined, value: (r: T) => number = () => 1, detail?: (rs: T[]) => string): YearValue[] {
  const m = new Map<number, T[]>()
  for (const r of rows) {
    const y = year(r)
    if (y && Number.isFinite(y)) m.set(y, [...(m.get(y) ?? []), r])
  }
  return [...m.entries()].map(([y, rs]) => ({ year: y, value: rs.reduce((s, r) => s + value(r), 0), detail: detail?.(rs) }))
}

const names = (rs: { name: string }[], max = 4) => rs.slice(0, max).map(r => r.name).join(', ') + (rs.length > max ? ` and ${rs.length - max} more` : '')

export default function Trends() {
  const { data, error } = useData(() => Promise.all([
    loadData<TrendPoint[]>('trends.json').catch(() => [] as TrendPoint[]),
    loadData<Deal[]>('deals.json').catch(() => [] as Deal[]),
    loadData<CompanyRecord[]>('companies.json'),
    loadData<Facility[]>('facilities.json').catch(() => [] as Facility[]),
    loadPolicy(),
    loadStocks(),
  ]))
  const view = useMemo(() => data && build(...data), [data])
  if (error) return <p className="text-center text-gray-500 py-12">{error}</p>
  if (!view) return <p className="text-center text-gray-500 py-12">Loading…</p>
  const v = view

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trends</h1>
        <p className="text-gray-500 text-sm max-w-2xl">
          How quantum computing has grown, in charts: the hardware's "Moore's law" curves, and the field around it (papers, companies, money, labs and national programs). Every point links to its source.
        </p>
      </div>

      {v.tiles.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {v.tiles.map(t => (
            <div key={t.label} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-2xl font-bold text-gray-900 tabular-nums">{t.value}</div>
              <div className="text-xs text-gray-600">{t.label}</div>
              <div className="text-xs text-gray-400">{t.sub}</div>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><TrendingUp className="w-4 h-4 text-teal-600" /> The hardware</h2>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Physical qubits in one processor" subtitle="Landmark and record devices, log scale. More qubits isn't better on its own; their quality (below) decides what a machine can do.">
            <TimeScatter points={v.qubits} series={PLATFORMS} format={compact} />
          </Card>
          <Card title="Two-qubit gate error" subtitle="Best reported error per two-qubit gate (100% minus fidelity), log scale; lower is better. Lab records often beat what full machines achieve.">
            <TimeScatter points={v.fidelity} series={PLATFORMS} format={pct} record="min" tableValue={p => p.value_text || `${(100 - p.value).toFixed(3)}%`} />
          </Card>
          <Card title="Superconducting qubit coherence" subtitle="How long a superconducting qubit holds its state (T1 or T2), log scale. Roughly ten times longer every few years, sometimes called Schoelkopf's law.">
            <TimeScatter points={v.coherence} series={[{ key: 'superconducting', label: 'Superconducting', color: SERIES_COLORS[0] }]} format={micro} />
          </Card>
          <Card title="Quantum volume records" subtitle="IBM's whole-machine benchmark, log scale. Mostly reported by IBM and Quantinuum; other makers use other benchmarks.">
            <TimeScatter points={v.qv.points} series={v.qv.series} format={compact} />
          </Card>
        </div>
        {v.qec.length > 0 && (
          <Card title="Error-correction milestones" subtitle="From the first codes on paper to logical qubits that get better as they get bigger.">
            <Timeline items={v.qec} />
          </Card>
        )}
        <p className="text-xs text-gray-500">See every machine and roadmap target on the <Link to="/hardware" className="text-teal-700 hover:text-teal-800">Hardware</Link> page.</p>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><TrendingUp className="w-4 h-4 text-teal-600" /> The field</h2>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Quantum physics papers per year" subtitle={v.arxivNote}>
            <YearBars data={v.arxiv} format={compact} unit="new papers" />
          </Card>
          <Card title="Quantum companies founded per year" subtitle={`Startups and specialist firms in this site's list, by founding year (${v.founded.counted} of ${v.founded.total}). Big tech firms and older companies that later moved into quantum aren't counted.`}>
            <YearBars data={v.founded.data} format={count} unit="founded" cumulativeLabel="Companies" />
          </Card>
          <Card title="Capital raised per year" subtitle="Disclosed US dollar funding rounds, share offerings, IPOs and SPAC mergers in the funding list. It's a curated list, so it undercounts the market.">
            <YearBars data={v.capital} format={v => (v ? formatMillions(v) : '$0')} unit="raised" />
          </Card>
          <Card title="Quantum facilities opened per year" subtitle={`Labs, centers and company sites on the Facilities page, by the year each opened (${v.facilities.counted} of ${v.facilities.total} have a year).`}>
            <YearBars data={v.facilities.data} format={count} unit="opened" cumulativeLabel="Facilities open" />
          </Card>
        </div>
        <Card
          title="National quantum programs"
          subtitle="Each program by launch year, with its budget as announced. Budgets are in different currencies and periods, so they aren't added up or converted."
        >
          <div className="grid lg:grid-cols-2 gap-6">
            <YearBars data={v.programs.byYear} format={count} unit="launched" cumulativeLabel="Programs in place" height={180} />
            <Timeline items={v.programs.items} />
          </div>
        </Card>
        <Card title={v.stocks.title} subtitle={v.stocks.subtitle}>
          {v.stocks.series.length > 1
            ? <LineChart series={v.stocks.series} format={x => x.toFixed(0)} label="Quantum stock index" />
            : <p className="text-xs text-gray-500">The index appears after the first daily data refresh. See the <Link to="/stocks" className="text-teal-700 hover:text-teal-800">Stocks</Link> page.</p>}
        </Card>
      </section>

      <p className="text-xs text-gray-400">
        Historical figures are in backend/app/trends/history.json; facility years are in backend/app/facilities/facilities.json. Hollow dots and amber notes mark figures not confirmed from their source.
      </p>
    </div>
  )
}

function build(trends: TrendPoint[], deals: Deal[], companies: CompanyRecord[], facilities: Facility[], policy: PolicyData, stocks: StocksData) {
  const of = (s: TrendPoint['series']) => trends.filter(r => r.series === s && r.value != null)

  const qubits = of('qubits').map(r => toPoint(r))
  const fidelity = of('two_qubit_fidelity').map(r => ({ ...toPoint(r), value: +(100 - r.value!).toPrecision(6) }))
  const coherence = of('coherence').map(r => toPoint(r, 'superconducting'))
  const qvRows = of('quantum_volume')
  // Honeywell's trapped-ion business became Quantinuum in 2021; keep it one series.
  const qvGroup = (r: TrendPoint) => (/honeywell|quantinuum/i.test(r.group) ? 'Quantinuum (Honeywell before 2021)' : r.group || 'Other')
  const groups = [...new Set(qvRows.map(qvGroup))]
    .sort((a, b) => qvRows.filter(r => qvGroup(r) === b).length - qvRows.filter(r => qvGroup(r) === a).length)
  const qv = {
    series: groups.map((g, i) => ({ key: g, label: g, color: SERIES_COLORS[i % SERIES_COLORS.length] })),
    points: qvRows.map(r => toPoint(r, qvGroup(r))),
  }
  const qec = trends.filter(r => r.series === 'qec_milestones').sort((a, b) => a.date.localeCompare(b.date)).map(r => ({
    id: r.id, date: r.date.slice(0, 4), title: r.label, text: [r.group, r.description].filter(Boolean).join(': '),
    source_url: r.source_url, source_name: r.source_name, confirmed: r.confirmed, note: r.note,
  }))
  const arxivRows = of('arxiv_quant_ph')
  const arxiv = arxivRows.map(r => ({ year: Number(r.date.slice(0, 4)), value: r.value!, detail: /partial/i.test(r.note ?? '') ? r.note!.replace(/^.*?\)\.\s*/, '') : r.confirmed ? undefined : 'Not confirmed from the source page' }))
  const arxivSources = [...new Set(arxivRows.map(r => r.source_name).filter(Boolean))]
  const arxivNote = `New submissions to arXiv's quantum physics section (quant-ph) each year, a broad stand-in for research activity${arxivSources.length ? `. Source: ${arxivSources.join(', ')}` : ''}.`

  const startups = companies.filter(c => c.category !== 'big_tech' && Number(c.founded) >= 1990)
  const founded = {
    data: perYear(startups, c => Number(c.founded), undefined, rs => names(rs)),
    counted: startups.length,
    total: companies.length,
  }

  const capital = perYear(
    deals.filter(d => RAISES.includes(d.kind) && d.currency === 'USD' && d.amount != null),
    d => Number(d.date.slice(0, 4)), d => d.amount!, rs => `${rs.length} deal${rs.length === 1 ? '' : 's'}`,
  )

  const withYear = facilities.filter(f => f.opened)
  const facilityData = {
    data: perYear(withYear, f => f.opened, undefined, rs => names(rs, 3)),
    counted: withYear.length,
    total: facilities.length,
  }

  const programs = [...policy.programs].sort((a, b) => a.launched.localeCompare(b.launched))
  const basis: Record<string, string> = { estimate: ' (estimate)', proposed: ' (proposed)' }
  const programData = {
    byYear: perYear(programs, p => Number(p.launched.slice(0, 4)), undefined, rs => names(rs, 3)),
    items: programs.map(p => ({
      id: p.slug, date: p.launched, title: `${p.name} (${p.jurisdiction})`,
      text: p.funding ? `${p.funding}${basis[p.funding_basis ?? ''] ?? ''}` : 'No published total',
      source_url: p.source_url, source_name: p.source_name, confirmed: p.funding_confirmed,
      note: p.funding_confirmed ? undefined : 'Budget not confirmed from the source page.',
    })),
  }

  const idx = stocks.index
  const stockView = {
    title: idx.name || 'Quantum stock index',
    subtitle: `${idx.method || 'An equal-weight index of listed quantum companies.'}${stocks.example ? ' Preview only: these prices are made up.' : ''}`,
    series: idx.series,
  }

  const tiles: { label: string; value: string; sub: string }[] = []
  const bestQ = [...qubits].filter(p => p.confirmed !== false).sort((a, b) => b.value - a.value)[0]
  if (bestQ) tiles.push({ label: 'Largest qubit array', value: compact(bestQ.value), sub: `${bestQ.label}, ${bestQ.date.slice(0, 4)}` })
  const bestF = [...fidelity].filter(p => p.confirmed !== false).sort((a, b) => a.value - b.value)[0]
  if (bestF) tiles.push({ label: 'Best two-qubit fidelity', value: `${+(100 - bestF.value).toPrecision(5)}%`, sub: `${bestF.label}, ${bestF.date.slice(0, 4)}` })
  const lastArxiv = [...arxiv].sort((a, b) => b.year - a.year)[0]
  if (lastArxiv) tiles.push({ label: 'quant-ph papers', value: compact(lastArxiv.value), sub: `in ${lastArxiv.year}` })
  if (programs.length) tiles.push({ label: 'National programs', value: String(programs.length), sub: `since ${programs[0].launched.slice(0, 4)}` })

  return { qubits, fidelity, coherence, qv, qec, arxiv, arxivNote, founded, capital, facilities: facilityData, programs: programData, stocks: stockView, tiles }
}
