import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Briefcase, ExternalLink, MapPin, Search } from 'lucide-react'
import { loadData, useData, type CompanyRecord, type EventItem, type JobsData } from '../lib/data'
import { formatDay } from '../components/StockChart'

const FORMAT_LABEL: Record<EventItem['format'], string> = { in_person: 'In person', hybrid: 'Hybrid', online: 'Online' }
const KIND_LABEL: Record<EventItem['kind'], string> = { academic: 'Academic', industry: 'Industry', government: 'Government' }

function dateRange(e: EventItem) {
  if (!e.confirmed && e.start.endsWith('-01') && (!e.end || e.end === e.start)) {
    return new Date(`${e.start}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  if (!e.end || e.end === e.start) return formatDay(e.start)
  const sameYear = e.start.slice(0, 4) === e.end.slice(0, 4)
  return `${formatDay(e.start, !sameYear)} – ${formatDay(e.end)}`
}

function Events({ events }: { events: EventItem[] }) {
  const [kind, setKind] = useState('')
  const shown = events.filter(e => !kind || e.kind === kind)
  const byMonth = useMemo(() => {
    const m = new Map<string, EventItem[]>()
    for (const e of shown) m.set(e.start.slice(0, 7), [...(m.get(e.start.slice(0, 7)) ?? []), e])
    return [...m.entries()]
  }, [shown])
  if (!events.length) {
    return <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-6 text-center">No upcoming events listed.</p>
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Event type">
        {['', ...Object.keys(KIND_LABEL)].filter(k => !k || events.some(e => e.kind === k)).map(k => (
          <button
            key={k || 'all'}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`text-xs px-2.5 py-1 rounded-full border ${kind === k ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'}`}
          >
            {k ? KIND_LABEL[k as EventItem['kind']] : 'All'} <span className="opacity-70">{k ? events.filter(e => e.kind === k).length : events.length}</span>
          </button>
        ))}
      </div>
      {byMonth.map(([month, list]) => (
        <div key={month} className="space-y-1.5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </h3>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {list.map(e => (
              <div key={e.id} className="p-3 sm:flex gap-4">
                <div className="text-xs text-gray-500 sm:w-36 shrink-0 pt-0.5 tabular-nums">{dateRange(e)}</div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <a href={e.url || e.source_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-teal-700 inline-flex items-center gap-1">
                    {e.name} <ExternalLink className="w-3 h-3 text-gray-400" />
                  </a>
                  <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2">
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{[e.city, e.country].filter(Boolean).join(', ') || 'Online'}</span>
                    <span>{KIND_LABEL[e.kind] ?? e.kind}</span>
                    <span>{FORMAT_LABEL[e.format] ?? e.format}</span>
                  </div>
                  {(!e.confirmed || e.note) && <p className="text-xs text-amber-700">{e.note ?? 'Dates not yet confirmed on the event site.'}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Jobs({ data, names, company, setCompany }: {
  data: JobsData
  names: Map<string, string>
  company: string
  setCompany: (c: string) => void
}) {
  const [q, setQ] = useState('')
  const [remote, setRemote] = useState(false)
  const [limit, setLimit] = useState(30)
  const needle = q.trim().toLowerCase()
  const shown = data.jobs.filter(j =>
    (!company || j.company === company) && (!remote || j.remote) &&
    (!needle || [j.title, j.location, j.department].some(t => t.toLowerCase().includes(needle))))
  const withJobs = [...new Set(data.jobs.map(j => j.company))].sort((a, b) => (names.get(a) ?? a).localeCompare(names.get(b) ?? b))
  const linksOnly = data.boards
    .filter(b => b.careers_url && !data.jobs.some(j => j.company === b.company))
    .sort((a, b) => (names.get(a.company) ?? a.company).localeCompare(names.get(b.company) ?? b.company))
  const selectClass = 'bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-teal-500'

  return (
    <div className="space-y-4">
      {data.jobs.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={e => { setQ(e.target.value); setLimit(30) }} placeholder="Role, team or place" aria-label="Search jobs" className={`${selectClass} pl-8 w-52`} />
            </div>
            <select value={company} onChange={e => { setCompany(e.target.value); setLimit(30) }} className={selectClass} aria-label="Company">
              <option value="">All companies</option>
              {withJobs.map(s => <option key={s} value={s}>{names.get(s) ?? s}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 px-2 cursor-pointer select-none">
              <input type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)} className="accent-teal-600" /> Remote
            </label>
            <span className="text-xs text-gray-400 ml-auto">{shown.length} of {data.jobs.length} roles</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {shown.slice(0, limit).map(j => (
              <div key={j.id} className="p-3 sm:flex gap-4 items-start">
                <div className="min-w-0 flex-1">
                  <a href={j.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-teal-700">{j.title}</a>
                  <div className="text-xs text-gray-500">
                    <Link to={`/companies/${j.company}`} className="hover:text-teal-700">{names.get(j.company) ?? j.company}</Link>
                    {j.location && ` · ${j.location}`}{j.department && ` · ${j.department}`}
                  </div>
                </div>
                {j.posted && <div className="text-xs text-gray-400 shrink-0">Posted {formatDay(j.posted)}</div>}
              </div>
            ))}
            {shown.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No roles match these filters.</p>}
          </div>
          {shown.length > limit && (
            <button onClick={() => setLimit(l => l + 30)} className="text-sm text-teal-700 hover:text-teal-800">Show more ({shown.length - limit} left)</button>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-6 text-center">
          Open roles appear after the first daily data refresh, which reads companies' public job boards. Until then, use the careers pages below.
        </p>
      )}
      {linksOnly.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Other companies: careers pages and websites</h3>
          <div className="flex flex-wrap gap-1.5">
            {linksOnly.map(b => (
              <a key={b.company} href={b.careers_url} target="_blank" rel="noopener noreferrer" className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-teal-300 hover:text-teal-700 inline-flex items-center gap-1">
                {names.get(b.company) ?? b.company} <ExternalLink className="w-3 h-3" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function EventsJobs() {
  const { data, error } = useData(() => Promise.all([
    loadData<EventItem[]>('events.json'),
    loadData<JobsData>('jobs.json'),
    loadData<CompanyRecord[]>('companies.json'),
  ]))
  const [params, setParams] = useSearchParams()
  const company = params.get('company') ?? ''
  const setCompany = (c: string) => setParams(c ? { company: c } : {}, { replace: true })

  if (error) return <p className="text-center text-gray-500 py-12">{error}</p>
  if (!data) return <p className="text-center text-gray-500 py-12">Loading…</p>
  const [events, jobs, companies] = data
  const names = new Map(companies.map(c => [c.slug, c.name]))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Events and jobs</h1>
        <p className="text-gray-500 text-sm max-w-2xl">Upcoming quantum conferences and industry events, and open roles at quantum companies.</p>
      </div>
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><CalendarDays className="w-4 h-4 text-teal-600" /> Upcoming events</h2>
        <Events events={events} />
      </section>
      <section className="space-y-3" id="jobs">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><Briefcase className="w-4 h-4 text-teal-600" /> Open roles</h2>
          <p className="text-xs text-gray-500 mt-0.5">Read daily from companies' public job boards (Greenhouse, Lever and Ashby).</p>
        </div>
        <Jobs data={jobs} names={names} company={company} setCompany={setCompany} />
      </section>
      <p className="text-xs text-gray-400">
        Events are a curated list; edit backend/app/events/events.json to add one. Edit backend/app/jobs/job_boards.json to add a company's job board.
      </p>
    </div>
  )
}
