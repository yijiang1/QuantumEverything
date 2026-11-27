import { Link } from 'react-router-dom'
import { ArrowRight, FileText, Building2, Newspaper, Atom, TrendingUp } from 'lucide-react'
import PaperCard from '../components/PaperCard'
import { NewsList } from './News'
import {
  loadData, loadPapers, loadPolicy, useData, formatDate, billLabel,
  type CompanyRecord, type NewsItem, type Meta, type AnalysisSummary, type Deal, type EventItem,
  formatMonthOrDay,
} from '../lib/data'
import { formatDay } from '../lib/format'

function Stat({ to, icon: Icon, value, label }: { to: string; icon: typeof FileText; value: number | string; label: string }) {
  return (
    <Link to={to} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors">
      <Icon className="w-4 h-4 text-teal-600 mb-2" />
      <div className="text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </Link>
  )
}

function Section({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <Link to={to} className="text-sm text-teal-700 hover:text-teal-800 flex items-center gap-1">
          See all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {children}
    </section>
  )
}

export default function Overview() {
  const { data } = useData(() => Promise.all([
    loadData<Meta>('meta.json'),
    loadPapers(),
    loadData<NewsItem[]>('news.json'),
    loadData<CompanyRecord[]>('companies.json'),
    loadData<AnalysisSummary[]>('analyses/index.json').catch(() => [] as AnalysisSummary[]),
    loadPolicy(),
    loadData<Deal[]>('deals.json').catch(() => [] as Deal[]),
    loadData<EventItem[]>('events.json').catch(() => [] as EventItem[]),
  ]))

  if (!data) return <p className="text-center text-gray-500 py-12">Loading…</p>
  const [meta, papers, news, companies, analyses, policy, deals, events] = data
  const dealNames = new Map(companies.map(c => [c.slug, c.name]))
  const policyItems = [
    ...policy.us_actions.map(a => ({
      id: a.id,
      title: a.title,
      url: a.url,
      date: a.latest_action?.date ?? a.date ?? '',
      tag: a.kind === 'bill' ? billLabel(a) : a.reference ?? '',
    })),
    ...policy.federal_register.map(d => ({ id: d.id, title: d.title, url: d.url, date: d.date, tag: d.type })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  const anyScored = papers.some(p => (p.relevance_score || 0) > 0)
  const topPapers = [...papers]
    .sort((a, b) => anyScored
      ? (b.relevance_score || 0) - (a.relevance_score || 0) || (b.date || '').localeCompare(a.date || '')
      : (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5)
  const inTheNews = [...companies]
    .filter(c => c.news_ids.length + c.paper_ids.length > 0)
    .sort((a, b) => (b.news_ids.length * 3 + b.paper_ids.length) - (a.news_ids.length * 3 + a.paper_ids.length))
    .slice(0, 8)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quantum Everything</h1>
        <p className="text-gray-600 mt-1 max-w-2xl">
          One place to follow quantum computing: new research, the companies building it, and the news around them.
        </p>
        <p className="text-xs text-gray-400 mt-2">Data updated {formatDate(meta.generated_at)}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 *:min-w-0">
        <Stat to="/papers" icon={FileText} value={meta.counts.papers} label="papers tracked" />
        <Stat to="/companies" icon={Building2} value={meta.counts.companies} label="companies" />
        <Stat to="/stocks" icon={TrendingUp} value={meta.counts.public_companies} label="publicly traded" />
        <Stat to="/news" icon={Newspaper} value={meta.counts.news} label="news items" />
      </div>

      {inTheNews.length > 0 && (
        <Section title="Companies in the news and research" to="/companies">
          <div className="flex flex-wrap gap-2">
            {inTheNews.map(c => (
              <Link
                key={c.slug}
                to={`/companies/${c.slug}`}
                className="flex flex-wrap items-center gap-x-2 max-w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:border-teal-300"
              >
                <span className="text-gray-900">{c.name}</span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {c.paper_ids.length} papers · {c.news_ids.length} news
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {deals.length > 0 && (
        <Section title="Latest deals" to="/funding">
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {deals.slice(0, 5).map(d => (
              <Link key={d.id} to={`/companies/${d.company}`} className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 px-3 py-2 hover:bg-gray-50">
                <span className="text-xs text-gray-400 sm:w-24 shrink-0 tabular-nums">{formatMonthOrDay(d.date)}</span>
                <span className="text-sm text-gray-900 min-w-0 flex-1">{dealNames.get(d.company) ?? d.company}: {d.title}</span>
                <span className="text-xs text-gray-600 tabular-nums sm:text-right sm:max-w-[40%]">{d.amount_text}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {events.length > 0 && (
        <Section title="Upcoming events" to="/events">
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {events.slice(0, 4).map(e => (
              <a key={e.id} href={e.url || e.source_url} target="_blank" rel="noopener noreferrer" className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 px-3 py-2 hover:bg-gray-50">
                <span className="text-xs text-gray-400 sm:w-24 shrink-0 tabular-nums">{formatDay(e.start)}</span>
                <span className="text-sm text-gray-900 min-w-0 flex-1">{e.name}</span>
                <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">{[e.city, e.country].filter(Boolean).join(', ')}</span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {policyItems.length > 0 && (
        <Section title="Latest in policy" to="/policy">
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {policyItems.map(item => (
              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 px-3 py-2 hover:bg-gray-50">
                <span className="text-xs text-gray-400 sm:w-24 shrink-0 tabular-nums">{item.date ? formatDay(item.date) : ""}</span>
                <span className="text-sm text-gray-900 min-w-0 flex-1">{item.title}</span>
                <span className="text-xs text-gray-400 shrink-0 hidden sm:inline">{item.tag}</span>
              </a>
            ))}
          </div>
        </Section>
      )}

      <Section title={anyScored ? 'Top-scored papers' : 'Latest papers'} to="/papers">
        {topPapers.length === 0
          ? <p className="text-sm text-gray-500">Papers appear after the first scheduled data refresh.</p>
          : <div className="space-y-2">{topPapers.map(p => <PaperCard key={p.id} paper={p} />)}</div>}
      </Section>

      <Section title="Latest news" to="/news">
        {news.length === 0
          ? <p className="text-sm text-gray-500">Headlines appear after the first scheduled data refresh.</p>
          : <NewsList items={news.slice(0, 5)} />}
      </Section>

      {analyses.length > 0 && (
        <Section title="Opportunity analyses" to="/analyses">
          <div className="flex flex-wrap gap-2">
            {analyses.slice(0, 6).map(a => (
              <Link key={a.slug} to={`/analyses/${a.slug}`} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:border-teal-300">
                <Atom className="w-3.5 h-3.5 text-teal-600" />
                <span className="capitalize text-gray-900">{a.topic}</span>
                <span className="text-xs text-gray-400">{a.opportunity_level}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
