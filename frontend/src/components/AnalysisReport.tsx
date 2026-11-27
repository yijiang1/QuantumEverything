import { useState } from 'react'
import { Atom, Zap, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export interface QuantumApproach {
  name: string
  description: string
  advantage: string
  maturity: string
  relevant_papers: string[]
}

export interface AnalysisResult {
  opportunity_level: string
  opportunity_score: number
  summary: string
  current_challenges: string[]
  quantum_approaches: QuantumApproach[]
  key_papers: { title: string; relevance: string }[]
  timeline: string
  recommendations: string[]
  full_analysis: string
}

export const LEVEL_STYLES: Record<string, string> = {
  'Low': 'text-gray-500 bg-gray-100 border-gray-300',
  'Medium': 'text-yellow-700 bg-yellow-50 border-yellow-200',
  'High': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'Very High': 'text-teal-600 bg-teal-50 border-teal-200',
}

const MATURITY_STYLES: Record<string, string> = {
  'Theoretical': 'bg-gray-100 text-gray-500',
  'Research': 'bg-blue-50 text-blue-700',
  'Early Experiments': 'bg-indigo-50 text-indigo-700',
  'NISQ-era': 'bg-amber-50 text-amber-700',
  'Near-term': 'bg-emerald-50 text-emerald-700',
}

export default function AnalysisReport({ topic, result }: { topic: string; result: AnalysisResult }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const levelStyle = LEVEL_STYLES[result.opportunity_level] ?? 'text-gray-500 bg-gray-100 border-gray-300'
  const challenges = result.current_challenges ?? []
  const approaches = result.quantum_approaches ?? []
  const keyPapers = result.key_papers ?? []
  const recs = result.recommendations ?? []

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Atom className="w-5 h-5 text-teal-600 shrink-0" />
              <h2 className="text-lg font-semibold text-gray-900 capitalize">{topic}</h2>
            </div>
            <p className="text-gray-700">{result.summary}</p>
          </div>
          <div className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold border ${levelStyle}`}>
            {result.opportunity_level}
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Quantum opportunity score</span>
            <span>{Math.round(result.opportunity_score * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full"
              style={{ width: `${Math.max(0, Math.min(1, result.opportunity_score)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 *:min-w-0">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Timeline</h3>
          <p className="text-gray-800 text-sm">{result.timeline || 'N/A'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Current Challenges</h3>
          <ul className="space-y-1">
            {challenges.slice(0, 4).map((c, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-teal-600 shrink-0">›</span>{c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {approaches.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Quantum Approaches</h3>
          <div className="space-y-2">
            {approaches.map((qa, i) => (
              <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-3.5 text-left hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Zap className="w-4 h-4 text-teal-600 shrink-0" />
                    <span className="font-medium text-gray-900 truncate">{qa.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${MATURITY_STYLES[qa.maturity] ?? 'bg-gray-100 text-gray-500'}`}>
                      {qa.maturity}
                    </span>
                  </div>
                  {expanded === i
                    ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
                </button>
                {expanded === i && (
                  <div className="px-4 pb-4 border-t border-gray-200 pt-3 space-y-2.5">
                    <p className="text-sm text-gray-700">{qa.description}</p>
                    <p className="text-sm">
                      <span className="text-teal-600 font-medium">Advantage: </span>
                      <span className="text-gray-700">{qa.advantage}</span>
                    </p>
                    {qa.relevant_papers?.length > 0 && (
                      <p className="text-xs text-gray-500">Papers: {qa.relevant_papers.join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {keyPapers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Key Papers</h3>
          <div className="space-y-2">
            {keyPapers.map((p, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-teal-600 shrink-0 mt-0.5">›</span>
                <div>
                  <span className="text-gray-800">{p.title}</span>
                  {p.relevance && <span className="text-gray-500">: {p.relevance}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Recommendations</h3>
          <ol className="space-y-2">
            {recs.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <span className="text-teal-600 font-mono shrink-0">{i + 1}.</span>
                {r}
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.full_analysis && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Detailed Analysis</h3>
          <div className="prose">
            <ReactMarkdown>{result.full_analysis}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
