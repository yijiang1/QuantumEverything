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
  quantum_computing:    'bg-blue-50 text-blue-700 border-blue-200',
  quantum_ml:           'bg-teal-50 text-teal-700 border-teal-200',
  quantum_sensing:      'bg-amber-50 text-amber-700 border-amber-200',
  quantum_communication:'bg-emerald-50 text-emerald-700 border-emerald-200',
  quantum_simulation:   'bg-cyan-50 text-cyan-700 border-cyan-200',
  quantum_cryptography: 'bg-rose-50 text-rose-700 border-rose-200',
  quantum_hardware:     'bg-indigo-50 text-indigo-700 border-indigo-200',
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
  pending:  'bg-gray-100 text-gray-500',
  approved: 'bg-emerald-50 text-emerald-700',
  skipped:  'bg-gray-100 text-gray-400',
}

const ADVANTAGE_STYLES: Record<string, string> = {
  proven:      'bg-emerald-50 text-emerald-700',
  claimed:     'bg-yellow-50 text-yellow-700',
  theoretical: 'bg-blue-50 text-blue-700',
  none:        '',
}

function ScoreBadge({ score }: { score: number }) {
  if (score === 0) return null
  const color =
    score >= 8 ? 'text-emerald-700' :
    score >= 6 ? 'text-yellow-700' :
    score >= 4 ? 'text-orange-700' : 'text-gray-500'
  return (
    <span className={`font-mono text-sm font-semibold ${color}`}>
      {score.toFixed(1)}
    </span>
  )
}

function AreaBadge({ area }: { area: string }) {
  const label = area.replace(/_/g, ' ').replace('quantum ', 'Q/')
  const cls = AREA_COLORS[area] ?? 'bg-gray-100 text-gray-500 border-gray-300'
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
    <div className={`bg-white border rounded-xl overflow-hidden transition-colors ${
      isSkipped ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-gray-300'
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
              <h3 className="font-medium text-gray-900 leading-snug">{paper.title}</h3>
              <div className="flex items-center gap-2 shrink-0">
                <ScoreBadge score={paper.relevance_score} />
                {expanded
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
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
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-300">
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
        <div className="border-t border-gray-200 px-4 pb-4 pt-3 space-y-3">
          {paper.summary && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Summary</div>
              <p className="text-sm text-gray-700 leading-relaxed">{paper.summary}</p>
            </div>
          )}

          {paper.abstract && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Abstract</div>
              <p className="text-sm text-gray-500 leading-relaxed">{paper.abstract}</p>
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {platforms.length > 0 && (
              <>
                <span className="text-gray-400">Hardware</span>
                <span className="text-gray-700">{platforms.join(', ')}</span>
              </>
            )}
            {paper.journal && (
              <>
                <span className="text-gray-400">Journal</span>
                <span className="text-gray-700 italic">{paper.journal}</span>
              </>
            )}
            {paper.arxiv_id && (
              <>
                <span className="text-gray-400">arXiv ID</span>
                <span className="text-gray-700 font-mono text-xs">{paper.arxiv_id}</span>
              </>
            )}
            {paper.skip_reason && (
              <>
                <span className="text-gray-400">Skip reason</span>
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
                className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open paper
              </a>
            )}
            <div className="flex-1" />
            {isPending && onApprove && (
              <button
                onClick={e => { e.stopPropagation(); onApprove(paper.id) }}
                className="flex items-center gap-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Approve
              </button>
            )}
            {isPending && onSkip && (
              <button
                onClick={e => { e.stopPropagation(); onSkip(paper.id) }}
                className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 px-3 py-1.5 rounded-lg border border-gray-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Skip
              </button>
            )}
            {paper.status === 'approved' && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Zap className="w-3.5 h-3.5" /> In search index
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
