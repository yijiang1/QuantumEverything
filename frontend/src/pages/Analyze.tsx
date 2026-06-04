import { useState, useRef } from 'react'
import { Search, Loader2, Zap, AlertCircle, ChevronDown, ChevronUp, Atom } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface QuantumApproach {
  name: string
  description: string
  advantage: string
  maturity: string
  relevant_papers: string[]
}

interface AnalysisResult {
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

interface StreamEvent {
  type: string
  message?: string
  tool?: string
  input?: Record<string, string>
  preview?: string
  data?: AnalysisResult
  error?: string
}

const LEVEL_STYLES: Record<string, string> = {
  'Low': 'text-gray-400 bg-gray-800 border-gray-700',
  'Medium': 'text-yellow-400 bg-yellow-950 border-yellow-800',
  'High': 'text-emerald-400 bg-emerald-950 border-emerald-800',
  'Very High': 'text-violet-400 bg-violet-950 border-violet-700',
}

const MATURITY_STYLES: Record<string, string> = {
  'Theoretical': 'bg-gray-800 text-gray-400',
  'Research': 'bg-blue-950 text-blue-400',
  'Early Experiments': 'bg-indigo-950 text-indigo-400',
  'NISQ-era': 'bg-amber-950 text-amber-400',
  'Near-term': 'bg-emerald-950 text-emerald-400',
}

const EXAMPLES = [
  'tomography reconstruction',
  'drug molecule simulation',
  'portfolio optimization',
  'protein folding',
  'climate modeling',
  'logistics routing',
]

export default function Analyze() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [expandedApproach, setExpandedApproach] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleAnalyze = async (t = topic) => {
    if (!t.trim() || loading) return
    setLoading(true)
    setEvents([])
    setResult(null)
    setExpandedApproach(null)

    abortRef.current = new AbortController()
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t }),
        signal: abortRef.current.signal,
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const ev: StreamEvent = JSON.parse(raw)
            if (ev.type === 'done') break
            if (ev.type === 'result') {
              setResult(ev.data!)
            } else {
              setEvents(prev => [...prev, ev])
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setEvents(prev => [...prev, { type: 'error', message: String(err) }])
      }
    } finally {
      setLoading(false)
    }
  }

  const levelStyle = result
    ? LEVEL_STYLES[result.opportunity_level] ?? 'text-gray-400 bg-gray-800 border-gray-700'
    : ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Quantum Opportunity Analyzer</h1>
        <p className="text-gray-400 text-sm">Enter any topic or technology to discover quantum computing opportunities</p>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
          placeholder="e.g., tomography reconstruction, drug discovery, logistics routing..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
        />
        <button
          onClick={() => handleAnalyze()}
          disabled={loading || !topic.trim()}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
      </div>

      {!loading && !result && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => { setTopic(ex); handleAnalyze(ex) }}
              className="text-xs px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-full text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Live events log */}
      {events.length > 0 && !result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2 font-mono text-sm">
          {events.map((ev, i) => (
            <div key={i} className="flex items-start gap-2">
              {ev.type === 'status' && (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0 animate-spin" />
                  <span className="text-gray-300">{ev.message}</span>
                </>
              )}
              {ev.type === 'tool_call' && (
                <>
                  <Zap className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                  <span className="text-gray-400">
                    <span className="text-yellow-400">{ev.tool}</span>
                    {ev.input && <span className="text-gray-600"> {JSON.stringify(ev.input)}</span>}
                  </span>
                </>
              )}
              {ev.type === 'error' && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-red-400">{ev.message}</span>
                </>
              )}
            </div>
          ))}
          {loading && (
            <div className="text-gray-600 pt-1">
              <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1" />
              Synthesizing analysis…
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Atom className="w-5 h-5 text-violet-400" />
                  <h2 className="text-lg font-semibold text-white capitalize">{topic}</h2>
                </div>
                <p className="text-gray-300">{result.summary}</p>
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
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full"
                  style={{ width: `${result.opportunity_score * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Timeline + Challenges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Timeline</h3>
              <p className="text-gray-200 text-sm">{result.timeline || 'N/A'}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Current Challenges</h3>
              <ul className="space-y-1">
                {result.current_challenges.slice(0, 4).map((c, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-violet-500 shrink-0">›</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Quantum Approaches */}
          {result.quantum_approaches.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-base font-semibold text-white mb-3">Quantum Approaches</h3>
              <div className="space-y-2">
                {result.quantum_approaches.map((qa, i) => (
                  <div key={i} className="border border-gray-800 rounded-lg overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-3.5 text-left hover:bg-gray-800/40 transition-colors"
                      onClick={() => setExpandedApproach(expandedApproach === i ? null : i)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Zap className="w-4 h-4 text-violet-400 shrink-0" />
                        <span className="font-medium text-white truncate">{qa.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${MATURITY_STYLES[qa.maturity] ?? 'bg-gray-800 text-gray-400'}`}>
                          {qa.maturity}
                        </span>
                      </div>
                      {expandedApproach === i
                        ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
                    </button>
                    {expandedApproach === i && (
                      <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-2.5">
                        <p className="text-sm text-gray-300">{qa.description}</p>
                        <p className="text-sm">
                          <span className="text-violet-400 font-medium">Advantage: </span>
                          <span className="text-gray-300">{qa.advantage}</span>
                        </p>
                        {qa.relevant_papers.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Papers: {qa.relevant_papers.join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key papers */}
          {result.key_papers.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-base font-semibold text-white mb-3">Key Papers</h3>
              <div className="space-y-2">
                {result.key_papers.map((p, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="text-violet-500 shrink-0 mt-0.5">›</span>
                    <div>
                      <span className="text-gray-200">{p.title}</span>
                      {p.relevance && <span className="text-gray-500"> — {p.relevance}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-base font-semibold text-white mb-3">Recommendations</h3>
              <ol className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-300">
                    <span className="text-violet-400 font-mono shrink-0">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Full analysis */}
          {result.full_analysis && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-base font-semibold text-white mb-3">Detailed Analysis</h3>
              <div className="prose">
                <ReactMarkdown>{result.full_analysis}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
