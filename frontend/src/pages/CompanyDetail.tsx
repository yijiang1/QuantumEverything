import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ExternalLink, FileText, Newspaper, TrendingUp, Building2 } from 'lucide-react'
import PaperCard from '../components/PaperCard'
import { NewsList } from './News'
import {
  loadData, loadPapers, loadPolicy, loadStocks, useData,
  type CompanyRecord, type NewsItem, type PolicyData, type StockTicker,
} from '../lib/data'
import {
  Change, ExampleNotice, LineChart, RangePicker, formatDay, formatPrice, pctChange, sliceRange, type RangeKey,
} from '../components/StockChart'
import type { Paper } from '../components/PaperCard'
import {
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  PLATFORM_LABELS,
} from '../lib/companies'

function PriceCard({ stock, ticker, example }: { stock: StockTicker | undefined; ticker: string; example?: boolean }) {
  const [range, setRange] = useState<RangeKey>('1Y')
  const shown = sliceRange(stock?.history ?? [], range)
  const heading = (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-medium text-gray-500">Share price · <span className="font-mono">{ticker}</span></h2>
      <Link to="/stocks" className="text-sm text-teal-700 hover:text-teal-800 flex items-center gap-1">
        All quantum stocks <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
  if (!stock || stock.history.length === 0) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
        {heading}
        <p className="text-sm text-gray-500">Price history appears after the next daily data refresh.</p>
      </section>
    )
  }
  const periods: [string, number | null][] = [
    ['1D', stock.change['1d']], ['1M', stock.change['1m']], ['YTD', stock.change.ytd], ['1Y', stock.change['1y']],
  ]
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
      {heading}
      {example && <ExampleNotice />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900 tabular-nums">{formatPrice(stock.last, stock.currency)}</span>
            <Change value={pctChange(shown)} className="text-sm" />
            <span className="text-xs text-gray-400">{range === 'All' ? 'since start' : range}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Close on {stock.last_date ? formatDay(stock.last_date) : '—'}{stock.exchange ? ` · ${stock.exchange}` : ''}
          </p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </div>
      <LineChart series={shown} format={v => formatPrice(v, stock.currency)} label={`${ticker} closing price`} />
      <dl className="grid grid-cols-4 gap-2 text-sm">
        {periods.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-gray-400">{k}</dt>
            <dd><Change value={v} /></dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function PolicyCard({ company, policy }: { company: CompanyRecord; policy: PolicyData }) {
  const programs = policy.programs.filter(p => p.countries.includes(company.country))
  const mentions = [
    ...policy.us_actions.filter(a => a.companies?.includes(company.slug))
      .map(a => ({ id: a.id, title: a.title, url: a.url, date: a.latest_action?.date ?? a.date ?? '' })),
    ...policy.federal_register.filter(d => d.companies.includes(company.slug))
      .map(d => ({ id: d.id, title: d.title, url: d.url, date: d.date })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  if (!programs.length && !mentions.length) return null
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-gray-500">Government policy</h2>
        <Link to="/policy" className="text-sm text-teal-700 hover:text-teal-800 flex items-center gap-1">
          All policy <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {programs.map(p => (
        <div key={p.slug} className="text-sm">
          <span className="text-gray-900 font-medium">{p.name}</span>
          <span className="text-gray-500"> ({p.jurisdiction}, {p.launched})</span>
          {p.funding && <span className="text-gray-700"> · {p.funding}</span>}
        </div>
      ))}
      {mentions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-400">Named in</div>
          {mentions.slice(0, 5).map(m => (
            <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-800 hover:text-teal-700">
              {m.title} {m.date && <span className="text-xs text-gray-400">· {formatDay(m.date)}</span>}
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

export default function CompanyDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [tab, setTab] = useState<'papers' | 'news'>('papers')
  const { data: all, error: loadError } = useData(
    () => Promise.all([
      loadData<CompanyRecord[]>('companies.json'),
      loadPapers(),
      loadData<NewsItem[]>('news.json'),
      loadStocks(),
      loadPolicy(),
    ]),
  )

  const found = all?.[0].find(c => c.slug === slug)
  const error = loadError || (all && !found ? 'Company not found' : '')
  const example = all?.[3].example
  const stock = found?.ticker ? all?.[3].tickers[found.ticker.toUpperCase()] : undefined
  let company: (CompanyRecord & {
    papers: Paper[]
    news: NewsItem[]
    related: { slug: string; name: string; relation: 'parent' | 'subsidiary' }[]
  }) | null = null
  if (all && found) {
    const [companies, papers, news] = all
    const paperById = new Map(papers.map(p => [p.id, p]))
    const newsById = new Map(news.map(n => [n.id, n]))
    company = {
      ...found,
      papers: found.paper_ids.map(id => paperById.get(id)).filter((p): p is Paper => !!p),
      news: found.news_ids.map(id => newsById.get(id)).filter((n): n is NewsItem => !!n),
      related: companies.flatMap((o): { slug: string; name: string; relation: 'parent' | 'subsidiary' }[] => {
        if (o.slug === found.slug) return []
        if (o.parent && o.parent === found.name) return [{ slug: o.slug, name: o.name, relation: 'subsidiary' }]
        if (found.parent && o.name === found.parent) return [{ slug: o.slug, name: o.name, relation: 'parent' }]
        return []
      }),
    }
  }

  const back = (
    <Link to="/companies" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
      <ArrowLeft className="w-4 h-4" /> All companies
    </Link>
  )

  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <div className="text-center text-gray-500 py-16">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!company) {
    return <div className="space-y-4">{back}<div className="text-center text-gray-500 py-12">Loading…</div></div>
  }

  const facts: [string, string][] = [
    ['Category', CATEGORY_LABELS[company.category] ?? company.category],
    ['Platform', company.platforms.map(p => PLATFORM_LABELS[p] ?? p).join(', ')],
    ['Headquarters', company.country],
    ['Founded', company.founded],
    ['Listed', company.ticker ? `${company.ticker}${company.exchange ? ` (${company.exchange})` : ''}` : 'Private'],
    ['Status', company.status === 'acquired' ? `Acquired${company.parent ? ` by ${company.parent}` : ''}` : ''],
  ].filter(([, v]) => v) as [string, string][]

  return (
    <div className="space-y-6">
      {back}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_STYLES[company.category] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {CATEGORY_LABELS[company.category] ?? company.category}
              </span>
              {company.ticker && (
                <span className="flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                  <TrendingUp className="w-3 h-3" /> {company.ticker}
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-2">{company.description}</p>
          </div>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-teal-700 hover:text-teal-800 shrink-0"
            >
              Website <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-gray-400 uppercase tracking-wider">{k}</dt>
              <dd className="text-gray-800">{v}</dd>
            </div>
          ))}
        </dl>

        {company.related.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {company.related.map(r => (
              <Link
                key={r.slug}
                to={`/companies/${r.slug}`}
                className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-teal-50 hover:text-teal-700"
              >
                {r.relation === 'parent' ? 'Parent: ' : 'Owns: '}{r.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {company.ticker && <PriceCard stock={stock} ticker={company.ticker} example={example} />}

      {all && <PolicyCard company={company} policy={all[4]} />}

      {/* Mentions */}
      <div className="space-y-3">
        <div className="flex gap-1 border-b border-gray-200">
          {([
            ['papers', 'Papers', FileText, company.papers.length],
            ['news', 'News', Newspaper, company.news.length],
          ] as const).map(([key, label, Icon, count]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${
                tab === key
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
              <span className="text-xs text-gray-400">{count}</span>
            </button>
          ))}
        </div>

        {tab === 'papers' ? (
          company.papers.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              No papers in the collection mention {company.name} yet.
            </p>
          ) : (
            <div className="space-y-3">
              {company.papers.map(p => <PaperCard key={p.id} paper={p} />)}
            </div>
          )
        ) : company.news.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No recent news mentions {company.name}.
          </p>
        ) : (
          <NewsList items={company.news} />
        )}
      </div>
    </div>
  )
}
