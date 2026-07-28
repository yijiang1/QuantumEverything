import { useState, useEffect, useCallback } from 'react'
import {
  Search, RefreshCw, Zap, Brain, FileText,
  ChevronDown
} from 'lucide-react'
import PaperCard, { type Paper } from '../components/PaperCard'

interface Stats { total: number; pending: number; approved: number; skipped: number }

const SORT_OPTIONS = [
  { value: 'date_desc',    label: 'Date ↓' },
  { value: 'date_asc',     label: 'Date ↑' },
  { value: 'score_desc',   label: 'Score ↓' },
  { value: 'created_desc', label: 'Added ↓' },
]

const STATUS_OPTS = ['', 'pending', 'approved', 'skipped'] as const
const AREA_OPTS = [
  '', 'quantum_computing', 'quantum_ml', 'quantum_sensing',
  'quantum_communication', 'quantum_simulation',
  'quantum_cryptography', 'quantum_hardware',
] as const
const TYPE_OPTS = [
  '', 'algorithm', 'hardware', 'error_correction',
  'simulation', 'ml_quantum', 'application', 'review',
] as const

const STATUS_LABELS: Record<string, string> = {
  '': 'All',
  pending: 'Pending',
  approved: 'Approved',
  skipped: 'Skipped',
}
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

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-lg border ${color}`}>
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs uppercase tracking-wider opacity-70">{label}</span>
    </div>
  )
}

export default function Papers() {
  const [papers, setPapers]     = useState<Paper[]>([])
  const [stats, setStats]       = useState<Stats>({ total: 0, pending: 0, approved: 0, skipped: 0 })
  const [loading, setLoading]   = useState(false)

  // Controls
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatus]     = useState('')
  const [areaFilter, setArea]         = useState('')
  const [typeFilter, setType]         = useState('')
  const [sort, setSort]               = useState('date_desc')

  // Fetch / classify state
  const [arxivQuery, setArxivQuery]     = useState('')
  const [oaKeyword, setOaKeyword]       = useState('')
  const [fetching, setFetching]         = useState<'arxiv' | 'openalex' | null>(null)
  const [classifying, setClassifying]   = useState(false)
  const [toast, setToast]               = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/papers/stats')
    setStats(await res.json())
  }, [])

  const loadPapers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '50',
        sort,
        ...(statusFilter && { status: statusFilter }),
        ...(search       && { search }),
        ...(areaFilter   && { quantum_area: areaFilter }),
        ...(typeFilter   && { paper_type: typeFilter }),
      })
      const res = await fetch(`/api/papers?${params}`)
      setPapers(await res.json())
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, areaFilter, typeFilter, sort])

  useEffect(() => { loadPapers(); loadStats() }, [loadPapers, loadStats])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => loadPapers(), 350)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (paperId: number) => {
    await fetch(`/api/papers/${paperId}/approve`, { method: 'POST' })
    setPapers(prev => prev.map(p => p.id === paperId ? { ...p, status: 'approved' } : p))
    setStats(prev => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }))
  }

  const handleSkip = async (paperId: number) => {
    await fetch(`/api/papers/${paperId}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: '' }),
    })
    setPapers(prev => prev.map(p => p.id === paperId ? { ...p, status: 'skipped' } : p))
    setStats(prev => ({ ...prev, pending: prev.pending - 1, skipped: prev.skipped + 1 }))
  }

  const handleFetchArxiv = async () => {
    setFetching('arxiv')
    await fetch('/api/papers/fetch/arxiv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: arxivQuery, max_results: 30 }),
    })
    setFetching(null)
    showToast('arXiv fetch started — papers will appear shortly. Refresh to see them.')
    setTimeout(() => { loadPapers(); loadStats() }, 5000)
  }

  const handleFetchOpenAlex = async () => {
    setFetching('openalex')
    await fetch('/api/papers/fetch/openalex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: oaKeyword, lookback_days: 90 }),
    })
    setFetching(null)
    showToast('OpenAlex fetch started — papers will appear shortly. Refresh to see them.')
    setTimeout(() => { loadPapers(); loadStats() }, 6000)
  }

  const handleClassify = async () => {
    setClassifying(true)
    await fetch('/api/papers/classify?limit=30', { method: 'POST' })
    setClassifying(false)
    showToast('Classification started — scores & areas will update in a moment.')
    setTimeout(() => { loadPapers(); loadStats() }, 8000)
  }

  const pendingUnscored = papers.filter(p => p.status === 'pending' && p.relevance_score === 0).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quantum Paper Database</h1>
        <p className="text-gray-500 text-sm">Curated knowledge base of quantum computing research</p>
      </div>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        <StatBadge label="Total"    value={stats.total}    color="border-gray-300 text-gray-700" />
        <StatBadge label="Pending"  value={stats.pending}  color="border-yellow-200 text-yellow-700" />
        <StatBadge label="Approved" value={stats.approved} color="border-emerald-200 text-emerald-700" />
        <StatBadge label="Skipped"  value={stats.skipped}  color="border-gray-200 text-gray-400" />
        <button
          onClick={() => { loadPapers(); loadStats() }}
          className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Fetch controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Fetch Papers</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex gap-2">
            <input
              value={arxivQuery}
              onChange={e => setArxivQuery(e.target.value)}
              placeholder="arXiv query (blank = default quantum queries)"
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
            <button
              onClick={handleFetchArxiv}
              disabled={fetching === 'arxiv'}
              className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetching === 'arxiv' ? 'animate-spin' : ''}`} />
              arXiv
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={oaKeyword}
              onChange={e => setOaKeyword(e.target.value)}
              placeholder="OpenAlex keyword (blank = default queries)"
              className="flex-1 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
            <button
              onClick={handleFetchOpenAlex}
              disabled={fetching === 'openalex'}
              className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetching === 'openalex' ? 'animate-spin' : ''}`} />
              OpenAlex
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleClassify}
            disabled={classifying || pendingUnscored === 0}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Brain className={`w-4 h-4 ${classifying ? 'animate-pulse' : ''}`} />
            {classifying ? 'Classifying…' : `Classify Pending (${pendingUnscored} unscored)`}
          </button>
          <span className="text-xs text-gray-400">
            Uses Claude Haiku to score relevance, assign quantum area & paper type
          </span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="bg-teal-50 border border-teal-200 text-teal-700 text-sm px-4 py-2 rounded-lg">
          <Zap className="inline w-3.5 h-3.5 mr-1" />{toast}
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search title, authors, abstract, summary…"
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 focus:outline-none focus:border-teal-500 cursor-pointer"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 flex-wrap">
          {/* Status */}
          {STATUS_OPTS.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === s
                  ? 'border-teal-300 bg-teal-50 text-teal-700'
                  : 'border-gray-300 text-gray-500 hover:border-gray-400'
              }`}
            >
              {STATUS_LABELS[s] ?? s}
            </button>
          ))}
          <span className="w-px bg-gray-200 mx-1" />
          {/* Area */}
          {AREA_OPTS.map(a => (
            <button
              key={a}
              onClick={() => setArea(a)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                areaFilter === a
                  ? 'border-teal-300 bg-teal-50 text-teal-700'
                  : 'border-gray-300 text-gray-500 hover:border-gray-400'
              }`}
            >
              {AREA_LABELS[a] ?? a}
            </button>
          ))}
          <span className="w-px bg-gray-200 mx-1" />
          {/* Type */}
          {TYPE_OPTS.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                typeFilter === t
                  ? 'border-teal-300 bg-teal-50 text-teal-700'
                  : 'border-gray-300 text-gray-500 hover:border-gray-400'
              }`}
            >
              {TYPE_LABELS[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      {/* Paper list */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : papers.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="mb-1">No papers found.</p>
          <p className="text-sm">Fetch from arXiv or OpenAlex to populate the database.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {papers.map(p => (
            <PaperCard
              key={p.id}
              paper={p}
              onApprove={handleApprove}
              onSkip={handleSkip}
            />
          ))}
          {papers.length === 50 && (
            <p className="text-center text-xs text-gray-400 pt-2">
              Showing first 50 results — use search or filters to narrow down
            </p>
          )}
        </div>
      )}
    </div>
  )
}
