import { useMemo, useState } from 'react'
import { Search, FileText, ChevronDown } from 'lucide-react'
import PaperCard from '../components/PaperCard'
import { loadPapers, loadData, useData, formatDate, type Meta } from '../lib/data'

const PAGE_SIZE = 50

const SORT_OPTIONS = [
  { value: 'date_desc',  label: 'Newest' },
  { value: 'date_asc',   label: 'Oldest' },
  { value: 'score_desc', label: 'Highest score' },
]

const AREA_LABELS: Record<string, string> = {
  '': 'All areas',
  quantum_computing: 'Quantum Computing',
  quantum_ml: 'Quantum ML',
  quantum_sensing: 'Sensing',
  quantum_communication: 'Communication',
  quantum_simulation: 'Simulation',
  quantum_cryptography: 'Cryptography',
  quantum_hardware: 'Hardware',
}
const TYPE_LABELS: Record<string, string> = {
  '': 'All types',
  algorithm: 'Algorithm',
  hardware: 'Hardware',
  error_correction: 'Error Correction',
  simulation: 'Simulation',
  ml_quantum: 'Quantum ML',
  application: 'Application',
  review: 'Review',
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-gray-300 text-gray-500 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  )
}

export default function Papers() {
  const { data: papers, error, loading } = useData(loadPapers)
  const { data: meta } = useData(() => loadData<Meta>('meta.json'))
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('')
  const [type, setType] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [sort, setSort] = useState('date_desc')
  const [shown, setShown] = useState(PAGE_SIZE)

  const filtered = useMemo(() => {
    if (!papers) return []
    const q = search.trim().toLowerCase()
    const out = papers.filter(p => {
      if (q && ![p.title, p.authors, p.abstract, p.summary].join(' ').toLowerCase().includes(q)) return false
      if (area && !(p.quantum_area || '').split(',').includes(area)) return false
      if (type && p.paper_type !== type) return false
      if (minScore && (p.relevance_score || 0) < minScore) return false
      return true
    })
    out.sort((a, b) =>
      sort === 'score_desc' ? (b.relevance_score || 0) - (a.relevance_score || 0)
      : sort === 'date_asc' ? (a.date || '').localeCompare(b.date || '')
      : (b.date || '').localeCompare(a.date || ''))
    return out
  }, [papers, search, area, type, minScore, sort])

  const anyScored = papers?.some(p => (p.relevance_score || 0) > 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Research Papers</h1>
        <p className="text-gray-500 text-sm">
          New quantum computing papers from arXiv and OpenAlex, scored for relevance by Claude.
          {meta && ` Updated ${formatDate(meta.generated_at)}.`}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              id="paper-search"
              value={search}
              onChange={e => { setSearch(e.target.value); setShown(PAGE_SIZE) }}
              placeholder="Search title, authors, abstract…"
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="relative">
            <select
              id="paper-sort"
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(AREA_LABELS).map(([k, v]) => (
            <Chip key={k} active={area === k} onClick={() => { setArea(k); setShown(PAGE_SIZE) }}>{v}</Chip>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <Chip key={k} active={type === k} onClick={() => { setType(k); setShown(PAGE_SIZE) }}>{v}</Chip>
          ))}
          {anyScored && (
            <>
              <span className="w-px bg-gray-200 mx-1" />
              {[0, 6, 8].map(s => (
                <Chip key={s} active={minScore === s} onClick={() => { setMinScore(s); setShown(PAGE_SIZE) }}>
                  {s === 0 ? 'Any score' : `Score ${s}+`}
                </Chip>
              ))}
            </>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-center text-gray-500 py-12">{error}</p>
      ) : loading ? (
        <p className="text-center text-gray-500 py-12">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="mb-1">{papers!.length === 0 ? 'No papers yet.' : 'No papers match these filters.'}</p>
          {papers!.length === 0 && (
            <p className="text-sm">Papers appear after the first scheduled data refresh.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{filtered.length} papers</p>
          {filtered.slice(0, shown).map(p => <PaperCard key={p.id} paper={p} />)}
          {filtered.length > shown && (
            <button
              onClick={() => setShown(s => s + PAGE_SIZE)}
              className="w-full text-sm text-teal-700 hover:bg-teal-50 border border-gray-200 rounded-lg py-2"
            >
              Show more ({filtered.length - shown} left)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
