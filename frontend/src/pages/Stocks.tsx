import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, LineChart as LineIcon } from 'lucide-react'
import { loadStocks, useData, type StockTicker } from '../lib/data'
import {
  Change, ExampleNotice, LineChart, RangePicker, Sparkline, formatDay, formatPrice, pctChange, sliceRange,
  type RangeKey,
} from '../components/StockChart'

type SortKey = 'name' | 'price' | '1d' | '1m' | 'ytd' | '1y'

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'name', label: 'Company' },
  { key: 'price', label: 'Price', className: 'text-right' },
  { key: '1d', label: '1D', className: 'text-right' },
  { key: '1m', label: '1M', className: 'text-right' },
  { key: 'ytd', label: 'YTD', className: 'text-right hidden sm:table-cell' },
  { key: '1y', label: '1Y', className: 'text-right hidden sm:table-cell' },
]

function sortValue(t: StockTicker, key: SortKey): number | string | null {
  if (key === 'name') return t.name.toLowerCase()
  if (key === 'price') return t.last
  return t.change[key]
}

function StockTable({ title, note, rows, sort, dir, onSort }: {
  title: string
  note: string
  rows: StockTicker[]
  sort: SortKey
  dir: 1 | -1
  onSort: (k: SortKey) => void
}) {
  const sorted = [...rows].sort((a, b) => {
    const va = sortValue(a, sort)
    const vb = sortValue(b, sort)
    if (va == null && vb == null) return 0
    if (va == null) return 1   // missing values always last
    if (vb == null) return -1
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir
  })
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{note}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100">
              {COLUMNS.map(c => (
                <th key={c.key} className={`font-medium px-3 py-2 ${c.className ?? 'text-left'}`}>
                  <button
                    onClick={() => onSort(c.key)}
                    className={`inline-flex items-center gap-0.5 hover:text-gray-900 ${sort === c.key ? 'text-gray-900' : ''}`}
                  >
                    {c.label}
                    {sort === c.key && (dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                  </button>
                </th>
              ))}
              <th className="font-medium px-3 py-2 text-left hidden md:table-cell">3 months</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => (
              <tr key={t.ticker} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link to={`/companies/${t.companies[0]}`} className="text-gray-900 hover:text-teal-700">
                    {t.name}
                  </Link>
                  <div className="text-xs text-gray-400 font-mono">
                    {t.ticker}{t.exchange ? ` · ${t.exchange}` : ''}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900">{formatPrice(t.last, t.currency)}</td>
                <td className="px-3 py-2 text-right"><Change value={t.change['1d']} /></td>
                <td className="px-3 py-2 text-right"><Change value={t.change['1m']} /></td>
                <td className="px-3 py-2 text-right hidden sm:table-cell"><Change value={t.change.ytd} /></td>
                <td className="px-3 py-2 text-right hidden sm:table-cell"><Change value={t.change['1y']} /></td>
                <td className="px-3 py-2 hidden md:table-cell"><Sparkline series={sliceRange(t.history, '3M')} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function Stocks() {
  const { data, error } = useData(loadStocks)
  const [range, setRange] = useState<RangeKey>('1Y')
  const [sort, setSort] = useState<SortKey>('name')
  const [dir, setDir] = useState<1 | -1>(1)

  const onSort = (k: SortKey) => {
    if (k === sort) setDir(d => (d === 1 ? -1 : 1))
    else { setSort(k); setDir(k === 'name' ? 1 : -1) }
  }

  const tickers = useMemo(() => Object.values(data?.tickers ?? {}), [data])
  const priced = tickers.filter(t => t.history.length > 0)
  const pure = tickers.filter(t => t.pure_play)
  const other = tickers.filter(t => !t.pure_play)
  const index = data?.index
  const shown = useMemo(() => sliceRange(index?.series ?? [], range), [index, range])
  const lastDate = priced.map(t => t.last_date ?? '').sort().pop()

  if (error) return <p className="text-center text-gray-500 py-12">{error}</p>
  if (!data) return <p className="text-center text-gray-500 py-12">Loading…</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quantum Stocks</h1>
        <p className="text-gray-500 text-sm">
          Daily closing prices for the {tickers.length} listed companies in the directory.
          {lastDate && <> Prices as of {formatDay(lastDate)}.</>}
        </p>
      </div>

      {data.example && <ExampleNotice />}

      {priced.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          <LineIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Prices appear after the first daily data refresh.</p>
          <p className="text-xs text-gray-400 mt-2">Tracking {tickers.map(t => t.ticker).join(', ')}</p>
        </div>
      ) : (
        <>
          <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-gray-500">{index?.name}</h2>
                <div className="flex items-baseline gap-3 mt-0.5">
                  <span className="text-3xl font-bold text-gray-900 tabular-nums">
                    {index?.last != null ? index.last.toFixed(1) : '—'}
                  </span>
                  <Change value={pctChange(shown)} className="text-sm" />
                  <span className="text-xs text-gray-400">{range === 'All' ? 'since start' : range}</span>
                </div>
              </div>
              <RangePicker value={range} onChange={setRange} />
            </div>
            <LineChart series={shown} format={v => v.toFixed(0)} label={index?.name ?? 'Index'} />
            <p className="text-xs text-gray-500">
              Equal-weight average of {index?.constituents.length} pure-play quantum stocks
              ({index?.constituents.join(', ')}), rebalanced daily. It starts at 100
              on {index?.series[0] ? formatDay(index.series[0][0]) : 'the first day of data'}; the dashed line marks
              where the chosen range began. Stocks join the index on their first trading day. Built by this site,
              not a published index.
            </p>
          </section>

          <StockTable
            title="Pure-play quantum"
            note="Companies whose business is mainly quantum technology. These make up the index."
            rows={pure}
            sort={sort} dir={dir} onSort={onSort}
          />
          <StockTable
            title="Big tech and suppliers"
            note="Quantum is a small part of these businesses, so their prices mostly reflect other work."
            rows={other}
            sort={sort} dir={dir} onSort={onSort}
          />
        </>
      )}

      <p className="text-xs text-gray-400">
        Daily closing prices from Yahoo Finance, refreshed once a day. Prices may be a
        day or more behind. Not investment advice.
      </p>
    </div>
  )
}
