import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, FileText, Newspaper, TrendingUp, Building2 } from 'lucide-react'
import PaperCard from '../components/PaperCard'
import {
  type CompanyDetail as CompanyDetailData,
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  PLATFORM_LABELS,
} from '../lib/companies'

export default function CompanyDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [company, setCompany] = useState<CompanyDetailData | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'papers' | 'news'>('papers')

  useEffect(() => {
    if (!slug) return
    setCompany(null)
    setError('')
    fetch(`/api/companies/${slug}`)
      .then(async res => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Company not found' : `Error ${res.status}`)
        return res.json()
      })
      .then(setCompany)
      .catch(e => setError(e.message))
  }, [slug])

  const formatDate = (s: string) => {
    if (!s) return ''
    const d = new Date(s)
    return isNaN(d.getTime())
      ? s.slice(0, 16)
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
              No papers in your database mention {company.name} yet. Fetch more on the Papers page.
            </p>
          ) : (
            <div className="space-y-3">
              {company.papers.map(p => <PaperCard key={p.id} paper={p} />)}
            </div>
          )
        ) : company.news.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No current news mentions {company.name}. Refresh the News page to pull the latest feeds.
          </p>
        ) : (
          <div className="space-y-2">
            {company.news.map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 text-xs text-gray-400">
                    <span>{item.source}</span>
                    {item.published && <span>{formatDate(item.published)}</span>}
                  </div>
                  <h3 className="font-medium text-gray-900 group-hover:text-teal-700 leading-snug">{item.title}</h3>
                  {item.summary && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.summary}</p>}
                </div>
                <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
