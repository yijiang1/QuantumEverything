import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Search, FileText, Newspaper, TrendingUp } from 'lucide-react'
import { loadData, loadStocks, useData, type CompanyRecord, type StocksData } from '../lib/data'
import { Change } from '../components/StockChart'
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  PLATFORM_LABELS,
} from '../lib/companies'

export default function Companies() {
  const { data, error } = useData(() => loadData<CompanyRecord[]>('companies.json'))
  const { data: stocks } = useData<StocksData>(loadStocks)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [platform, setPlatform] = useState('')
  const [publicOnly, setPublicOnly] = useState(false)

  const companies = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data
      .filter(c => {
        if (q && ![c.name, c.description, c.country, c.aliases.join(' ')].join(' ').toLowerCase().includes(q)) return false
        if (category && c.category !== category) return false
        if (platform && !c.platforms.includes(platform)) return false
        if (publicOnly && !c.ticker) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data, search, category, platform, publicOnly])
  const loading = !data && !error

  const selectClass =
    'bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-teal-500'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quantum Companies</h1>
        <p className="text-gray-500 text-sm">
          {companies.length} companies across hardware, software, big tech and the supply chain
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="company-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, country or description"
            className="w-full bg-gray-100 border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
          />
        </div>
        <select id="company-category" value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select id="company-platform" value={platform} onChange={e => setPlatform(e.target.value)} className={selectClass}>
          <option value="">All platforms</option>
          {Object.entries(PLATFORM_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 px-2 cursor-pointer select-none">
          <input
            id="company-public"
            type="checkbox"
            checked={publicOnly}
            onChange={e => setPublicOnly(e.target.checked)}
            className="accent-teal-600"
          />
          Publicly traded
        </label>
      </div>

      {error ? (
        <div className="text-center text-gray-500 py-12">{error}</div>
      ) : loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : companies.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No companies match these filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {companies.map(c => (
            <Link
              key={c.slug}
              to={`/companies/${c.slug}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors group flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 group-hover:text-teal-700 transition-colors leading-snug">
                    {c.name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {[c.country, c.founded && `founded ${c.founded}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {c.ticker && (
                  <span className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      <TrendingUp className="w-3 h-3" /> {c.ticker}
                    </span>
                    {stocks?.tickers[c.ticker.toUpperCase()]?.change['1d'] != null && (
                      <Change value={stocks.tickers[c.ticker.toUpperCase()].change['1d']} className="text-[11px]" />
                    )}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-500 line-clamp-2">{c.description}</p>

              <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_STYLES[c.category] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {CATEGORY_LABELS[c.category] ?? c.category}
                </span>
                {c.platforms.map(p => (
                  <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {PLATFORM_LABELS[p] ?? p}
                  </span>
                ))}
                {c.status === 'acquired' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                    Acquired{c.parent ? ` by ${c.parent}` : ''}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1" title="Papers mentioning this company">
                    <FileText className="w-3.5 h-3.5" /> {c.paper_ids.length}
                  </span>
                  <span className="flex items-center gap-1" title="News items mentioning this company">
                    <Newspaper className="w-3.5 h-3.5" /> {c.news_ids.length}
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
