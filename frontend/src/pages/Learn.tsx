import { useState } from 'react'
import { ExternalLink, GraduationCap, Search } from 'lucide-react'
import { loadData, useData, type LearnFormat, type LearnLevel, type LearnResource } from '../lib/data'

export const LEVELS: Record<LearnLevel, { label: string; blurb: string }> = {
  beginner: { label: 'Beginner', blurb: 'No physics background needed; some algebra helps.' },
  intermediate: { label: 'Intermediate', blurb: 'Comfortable with linear algebra and the basics of qubits and circuits.' },
  advanced: { label: 'Advanced', blurb: 'Graduate level: error correction, complexity, hardware physics.' },
}

export const FORMATS: Record<LearnFormat, string> = {
  course: 'Course',
  video: 'Video lectures',
  lecture_notes: 'Lecture notes',
  book: 'Book',
  tutorial: 'Tutorial',
  interactive: 'Interactive',
}

function ResourceRow({ r }: { r: LearnResource }) {
  return (
    <div className="p-3 sm:flex gap-4">
      <div className="min-w-0 flex-1 space-y-0.5">
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-teal-700 inline-flex items-center gap-1">
          {r.title} <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
        </a>
        <div className="text-xs text-gray-500">
          {[r.provider, r.people.length ? r.people.join(', ') : null, r.language !== 'English' ? r.language : null, r.year ? String(r.year) : null]
            .filter(Boolean).join(' · ')}
        </div>
        <p className="text-xs text-gray-600">{r.description}</p>
        {r.free_note && <p className="text-xs text-gray-500">{r.free_note}</p>}
        {!r.confirmed && <p className="text-xs text-amber-700">Link not yet checked.</p>}
      </div>
      <div className="flex sm:flex-col sm:items-end gap-1.5 mt-1.5 sm:mt-0 shrink-0">
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{FORMATS[r.format] ?? r.format}</span>
        {r.topics.slice(0, 2).map(t => <span key={t} className="text-xs text-gray-400">{t}</span>)}
      </div>
    </div>
  )
}

export default function Learn() {
  const { data, error } = useData(() => loadData<LearnResource[]>('learn.json'))
  const [level, setLevel] = useState<'' | LearnLevel>('')
  const [format, setFormat] = useState<'' | LearnFormat>('')
  const [topic, setTopic] = useState('')
  const [q, setQ] = useState('')

  if (error) return <p className="text-center text-gray-500 py-12">{error}</p>
  if (!data) return <p className="text-center text-gray-500 py-12">Loading…</p>
  const needle = q.trim().toLowerCase()
  const shown = data.filter(r =>
    (!level || r.level === level) && (!format || r.format === format) && (!topic || r.topics.includes(topic)) &&
    (!needle || [r.title, r.provider, r.description, ...r.people].some(t => t.toLowerCase().includes(needle))))
  const formats = (Object.keys(FORMATS) as LearnFormat[]).filter(f => data.some(r => r.format === f))
  const topicCounts = new Map<string, number>()
  for (const r of data) for (const t of r.topics) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1)
  const topics = [...topicCounts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([t]) => t)
  const selectClass = 'bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-teal-500'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Learn</h1>
        <p className="text-gray-500 text-sm max-w-2xl">
          Free courses, lecture videos, notes and hands-on tutorials on quantum computing, from first steps to research level. Every link goes to the provider's own page.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {(Object.keys(LEVELS) as LearnLevel[]).map(l => (
          <button
            key={l}
            onClick={() => setLevel(level === l ? '' : l)}
            aria-pressed={level === l}
            className={`text-left rounded-xl p-3 border ${level === l ? 'border-teal-600 bg-teal-50' : 'border-gray-200 bg-white hover:border-teal-300'}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-gray-900">{LEVELS[l].label}</span>
              <span className="text-xs text-gray-500 tabular-nums">{data.filter(r => r.level === l).length}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{LEVELS[l].blurb}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Title, teacher or provider" aria-label="Search resources" className={`${selectClass} pl-8 w-full sm:w-56`} />
        </div>
        <select value={format} onChange={e => setFormat(e.target.value as '' | LearnFormat)} className={selectClass} aria-label="Format">
          <option value="">All formats</option>
          {formats.map(f => <option key={f} value={f}>{FORMATS[f]}</option>)}
        </select>
        <select value={topic} onChange={e => setTopic(e.target.value)} className={selectClass} aria-label="Topic">
          <option value="">All topics</option>
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{shown.length} of {data.length}</span>
      </div>

      {shown.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Nothing matches these filters.</p>
        </div>
      ) : (
        (Object.keys(LEVELS) as LearnLevel[]).filter(l => shown.some(r => r.level === l)).map(l => (
          <section key={l} className="space-y-1.5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{LEVELS[l].label}</h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {shown.filter(r => r.level === l).map(r => <ResourceRow key={r.id} r={r} />)}
            </div>
          </section>
        ))
      )}

      <p className="text-xs text-gray-400">
        A curated list of free resources; edit backend/app/learn/resources.json to add one. Videos are linked, not copied, so they play on the provider's site.
      </p>
    </div>
  )
}
