import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Check, X, Zap } from 'lucide-react'

export interface Paper {
  id: number
  title: string
  authors: string
  date: string
  journal: string
  url: string
  abstract: string
  paper_type: string
  quantum_area: string
  hardware_platform: string
  quantum_advantage: string
  relevance_score: number
  summary: string
  status: string
  skip_reason: string
  arxiv_id: string
  openalex_id: string
  source: string
}

interface Props {
  paper: Paper
  onApprove?: (id: number) => void
  onSkip?: (id: number) => void
}

const AREA_COLORS: Record<string, string> = {
  quantum_computing:    'bg-blue-950 text-blue-300 border-blue-800',
  quantum_ml:           'bg-violet-950 text-violet-300 border-violet-800',
  quantum_sensing:      'bg-amber-950 text-amber-300 border-amber-800',
  quantum_communication:'bg-emerald-950 text-emerald-300 border-emerald-800',
  quantum_simulation:   'bg-cyan-950 text-cyan-300 border-cyan-800',
  quantum_cryptography: 'bg-rose-950 text-rose-300 border-rose-800',
  quantum_hardware:     'bg-indigo-950 text-indigo-300 border-indigo-800',
}

const TYPE_LABELS: Record<string, string> = {
  algorithm:       'Algorithm',
  hardware:        'Hardware',
  error_correction:'Error Correction',
  simulation:      'Simulation',
  ml_quantum:      'Quantum ML',
  application:     'Application',
  review:          'Review',
  other:           'Other',
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-gray-800 text-gray-400',
  approved: 'bg-emerald-950 text-emerald-400',
  skipped:  'bg-gray-900 text-gray-600',
}

const ADVANTAGE_STYLES: Record<string, string> = {
  proven:      'bg-emerald-950 text-emerald-400',
  claimed:     'bg-yellow-950 text-yellow-400',
  theoretical: 'bg-blue-950 text-blue-400',
  none:        '',
}

function ScoreBadge({ score }: { score: number }) {
  if (score === 0) return null
  const color =
    score >= 8 ? 'text-emerald-400' :
    score >= 6 ? 'text-yellow-400' :
    score >= 4 ? 'text-orange-400' : 'text-gray-500'
  return (
    <span className={`font-mono text-sm font-semibold ${color}`}>
      {score.toFixed(1)}
    </span>
  )
}

function AreaBadge({ area }: { area: string }) {
  const label = area.replace(/_/g, ' ').replace('quantum ', 'Q/')
  const cls = AREA_COLORS[area] ?? 'bg-gray-800 text-gray-400 border-gray-700'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
  )
}

export default function PaperCard({ paper, onApprove, onSkip }: Props) {
  const [expanded, setExpanded] = useState(false)

  const areas = paper.quantum_area
    ? paper.quantum_area.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const platforms = paper.hardware_platform
    ? paper.hardware_platform.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const isPending = paper.status === 'pending'
  const isSkipped = paper.status === 'skipped'
  const advantageStyle = ADVANTAGE_STYLES[paper.quantum_advantage] ?? ''

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
      isSkipped ? 'border-gray-800 opacity-60' : 'border-gray-800 hover:border-gray-700'
    }`}>
      {/* Collapsed header — always visible */}
      <button
        className="w-full text-left p-4"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-3">
          {/* Left: title + authors */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-white leading-snug">{paper.title}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <ScoreBadge score={paper.relevance_score} />
                {expanded
                  ? <ChevronUp className="w-4 h-4 text-gray-600" />
                  : <ChevronDown className="w-4 h-4 text-gray-600" />}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
              {paper.authors && <span className="truncate max-w-xs">{paper.authors}</span>}
              {paper.date && <><span>·</span><span>{paper.date.slice(0, 7)}</span></>}
              {paper.journal && paper.journal !== 'arXiv' && (
                <><span>·</span><span className="italic truncate max-w-[180px]">{paper.journal}</span></>
              )}
              <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_STYLES[paper.status] ?? ''}`}>
                {paper.status}
              </span>
              {paper.source && (
                <span className="text-gray-700">{paper.source}</span>
              )}
            </div>

            {/* Area + type badges */}
            {(areas.length > 0 || paper.paper_type) && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {areas.map(a => <AreaBadge key={a} area={a} />)}
                {paper.paper_type && paper.paper_type !== 'other' && (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-800 text-gray-400 border-gray-700">
                    {TYPE_LABELS[paper.paper_type] ?? paper.paper_type}
                  </span>
                )}
                {advantageStyle && paper.quantum_advantage !== 'none' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${advantageStyle}`}>
                    {paper.quantum_advantage} advantage
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary preview (collapsed) */}
        {!expanded && paper.summary && (
          <p className="text-sm text-gray-500 mt-2 line-clamp-2">{paper.summary}</p>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 pb-4 pt-3 space-y-3">
          {paper.summary && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Summary</div>
              <p className="text-sm text-gray-300 leading-relaxed">{paper.summary}</p>
            </div>
          )}

          {paper.abstract && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Abstract</div>
              <p className="text-sm text-gray-400 leading-relaxed">{paper.abstract}</p>
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {platforms.length > 0 && (
              <>
                <span className="text-gray-600">Hardware</span>
                <span className="text-gray-300">{platforms.join(', ')}</span>
              </>
            )}
            {paper.journal && (
              <>
                <span className="text-gray-600">Journal</span>
                <span className="text-gray-300 italic">{paper.journal}</span>
              </>
            )}
            {paper.arxiv_id && (
              <>
                <span className="text-gray-600">arXiv ID</span>
                <span className="text-gray-300 font-mono text-xs">{paper.arxiv_id}</span>
              </>
            )}
            {paper.skip_reason && (
              <>
                <span className="text-gray-600">Skip reason</span>
                <span className="text-gray-500">{paper.skip_reason}</span>
              </>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2 pt-1">
            {paper.url && (
              <a
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open paper
              </a>
            )}
            <div className="flex-1" />
            {isPending && onApprove && (
              <button
                onClick={e => { e.stopPropagation(); onApprove(paper.id) }}
                className="flex items-center gap-1.5 text-xs bg-emerald-900/60 hover:bg-emerald-800 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-800 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
            )}
            {isPending && onSkip && (
              <button
                onClick={e => { e.stopPropagation(); onSkip(paper.id) }}
                className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-1.5 rounded-lg border border-gray-700 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Skip
              </button>
            )}
            {paper.status === 'approved' && (
              <span className="flex items-center gap-1 text-xs text-emerald-500">
                <Zap className="w-3.5 h-3.5" /> In search index
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
