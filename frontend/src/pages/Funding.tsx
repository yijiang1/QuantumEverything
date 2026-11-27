import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Search, Banknote } from 'lucide-react'
import { loadData, useData, formatMonthOrDay, type CompanyRecord, type Deal, type DealKind } from '../lib/data'

export const DEAL_KINDS: Record<DealKind, string> = {
  venture: 'Funding round',
  public_offering: 'Share offering',
  ipo: 'IPO',
  spac: 'SPAC merger',
  acquisition: 'Acquisition',
  grant: 'Government funding',
}

/** Capital raised (not acquisitions or grants), for the yearly chart. */
export const RAISES: DealKind[] = ['venture', 'public_offering', 'ipo', 'spac']

export function formatMillions(m: number) {
  return m >= 1000 ? `$${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}B` : `$${Math.round(m)}M`
}

export function DealRow({ d, names, showCompany = true }: { d: Deal; names: Map<string, string>; showCompany?: boolean }) {
  const counterparty = d.counterparty_slug
    ? <Link to={`/companies/${d.counterparty_slug}`} className="hover:text-teal-700">{names.get(d.counterparty_slug) ?? d.counterparty}</Link>
    : d.counterparty
  return (
    <div className="p-3 sm:flex gap-4">
      <div className="text-xs text-gray-400 sm:w-24 shrink-0 pt-0.5">{formatMonthOrDay(d.date)}</div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{DEAL_KINDS[d.kind] ?? d.kind}</span>
          {showCompany && (
            <Link to={`/companies/${d.company}`} className="text-sm font-medium text-gray-900 hover:text-teal-700">
              {names.get(d.company) ?? d.company}
            </Link>
          )}
          <span className="text-sm text-gray-700">{d.title}</span>
        </div>
        <div className="text-xs text-gray-500">
          {[
            d.kind === 'acquisition' && d.counterparty && !d.title.toLowerCase().includes((names.get(d.counterparty_slug) ?? d.counterparty).toLowerCase()) ? <>Buyer: {counterparty}</> : null,
            d.valuation_text ? `Valuation ${d.valuation_text}` : null,
            d.lead_investors?.length ? `Led by ${d.lead_investors.join(', ')}` : null,
          ].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && ' · '}{x}</span>)}
        </div>
        {(!d.confirmed || d.note) && (
          <p className="text-xs text-amber-700">{d.note ?? 'Figure not yet confirmed from the source page.'}</p>
        )}
      </div>
      <div className="sm:text-right shrink-0 mt-1 sm:mt-0">
        <div className="text-sm font-semibold text-gray-900 tabular-nums">{d.amount_text || 'Undisclosed'}</div>
        {d.source_url && (
          <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-700 hover:text-teal-800 inline-flex items-center gap-1">
            {d.source_name || 'Source'} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}

function YearChart({ deals }: { deals: Deal[] }) {
  const years = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>()
    for (const d of deals) {
      if (!RAISES.includes(d.kind) || d.currency !== 'USD' || d.amount == null) continue
      const y = d.date.slice(0, 4)
      const e = m.get(y) ?? { total: 0, count: 0 }
      e.total += d.amount
      e.count += 1
      m.set(y, e)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [deals])
  const [hover, setHover] = useState<string | null>(null)
  if (years.length < 2) return null
  const max = Math.max(...years.map(([, e]) => e.total))
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
      <div>
        <h2 className="text-sm font-medium text-gray-900">Capital raised per year</h2>
        <p className="text-xs text-gray-500">Disclosed US dollar rounds, offerings, IPOs and SPAC mergers in this list. Deals in other currencies aren't included.</p>
      </div>
      <div className="flex items-end gap-2 h-44" role="img" aria-label={years.map(([y, e]) => `${y}: ${formatMillions(e.total)} across ${e.count} deals`).join('; ')}>
        {years.map(([y, e]) => (
          <div
            key={y}
            className="flex-1 flex flex-col items-center justify-end h-full gap-1 relative"
            onMouseEnter={() => setHover(y)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="text-xs text-gray-600 tabular-nums">{formatMillions(e.total)}</span>
            <div
              className={`w-full max-w-12 rounded-t ${hover === y ? 'bg-teal-700' : 'bg-teal-600'}`}
              style={{ height: `${Math.max(2, (e.total / max) * 100)}%` }}
            />
            {hover === y && (
              <div className="absolute bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-sm px-2 py-1 text-xs whitespace-nowrap z-10">
                <div className="font-semibold text-gray-900">{y}: {formatMillions(e.total)}</div>
                <div className="text-gray-500">{e.count} deal{e.count === 1 ? '' : 's'}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-gray-200 pt-1">
        {years.map(([y]) => <span key={y} className="flex-1 text-center text-xs text-gray-400">{y}</span>)}
      </div>
    </section>
  )
}

export default function Funding() {
  const { data, error } = useData(() => Promise.all([
    loadData<Deal[]>('deals.json'),
    loadData<CompanyRecord[]>('companies.json'),
  ]))
  const [kind, setKind] = useState<'' | DealKind>('')
  const [year, setYear] = useState('')
  const [q, setQ] = useState('')

  if (error) return <p className="text-center text-gray-500 py-12">{error}</p>
  if (!data) return <p className="text-center text-gray-500 py-12">Loading…</p>
  const [deals, companies] = data
  const names = new Map(companies.map(c => [c.slug, c.name]))
  const years = [...new Set(deals.map(d => d.date.slice(0, 4)))].sort().reverse()
  const needle = q.trim().toLowerCase()
  const shown = deals.filter(d =>
    (!kind || d.kind === kind) && (!year || d.date.startsWith(year)) &&
    (!needle || [names.get(d.company), d.title, d.counterparty, ...(d.lead_investors ?? [])].some(t => t?.toLowerCase().includes(needle))))
  const kinds = (Object.keys(DEAL_KINDS) as DealKind[]).filter(k => deals.some(d => d.kind === k))
  const selectClass = 'bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-teal-500'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Funding and deals</h1>
        <p className="text-gray-500 text-sm max-w-2xl">
          Funding rounds, share offerings, IPOs, SPAC mergers and acquisitions across the quantum industry, each with its source.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['venture', 'Funding rounds'],
          ['acquisition', 'Acquisitions'],
          ['listings', 'IPOs and SPACs'],
          ['public_offering', 'Share offerings'],
        ].map(([k, label]) => {
          const n = k === 'listings' ? deals.filter(d => d.kind === 'ipo' || d.kind === 'spac').length : deals.filter(d => d.kind === k).length
          return (
            <div key={k} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="text-2xl font-bold text-gray-900 tabular-nums">{n}</div>
              <div className="text-xs text-gray-600">{label}</div>
            </div>
          )
        })}
      </div>

      <YearChart deals={deals} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Company or investor"
            aria-label="Search deals"
            className={`${selectClass} pl-8 w-full sm:w-52`}
          />
        </div>
        <select value={kind} onChange={e => setKind(e.target.value as '' | DealKind)} className={selectClass} aria-label="Deal type">
          <option value="">All types</option>
          {kinds.map(k => <option key={k} value={k}>{DEAL_KINDS[k]}</option>)}
        </select>
        <select value={year} onChange={e => setYear(e.target.value)} className={selectClass} aria-label="Year">
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{shown.length} of {deals.length}</span>
      </div>

      {shown.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <Banknote className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No deals match these filters.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {shown.map(d => <DealRow key={d.id} d={d} names={names} />)}
        </div>
      )}

      <p className="text-xs text-gray-400">
        A curated list; edit backend/app/funding/deals.json in the repository to add or correct a deal. Amounts are as announced, in the deal's own currency.
      </p>
    </div>
  )
}
