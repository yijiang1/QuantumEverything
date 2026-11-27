import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Atom, ExternalLink } from 'lucide-react'
import AnalysisReport, { LEVEL_STYLES, type AnalysisResult } from '../components/AnalysisReport'
import { loadData, useData, formatDate, type AnalysisSummary } from '../lib/data'
import { ANALYZE_WORKFLOW_URL } from '../lib/site'

interface AnalysisFile {
  slug: string
  topic: string
  generated_at: string
  research_steps: { tool: string; query: string }[]
  result: AnalysisResult
}

export function AnalysesList() {
  const { data, error, loading } = useData(() => loadData<AnalysisSummary[]>('analyses/index.json'))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Opportunity Analyses</h1>
        <p className="text-gray-500 text-sm">
          Research reports on where quantum computing could help, written by a Claude research agent.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        New analyses are added by running the{' '}
        <a href={ANALYZE_WORKFLOW_URL} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline inline-flex items-center gap-0.5">
          Analyze a topic workflow <ExternalLink className="w-3 h-3" />
        </a>{' '}
        on GitHub. It researches the topic and saves the report here.
      </div>

      {error ? (
        <p className="text-center text-gray-500 py-12">{error}</p>
      ) : loading ? (
        <p className="text-center text-gray-500 py-12">Loading…</p>
      ) : data!.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <Atom className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No analyses yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 *:min-w-0">
          {data!.map(a => (
            <Link
              key={a.slug}
              to={`/analyses/${a.slug}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-teal-300 transition-colors flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-gray-900 capitalize">{a.topic}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${LEVEL_STYLES[a.opportunity_level] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {a.opportunity_level}
                </span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-3">{a.summary}</p>
              <p className="text-xs text-gray-400 mt-auto">{formatDate(a.generated_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function AnalysisDetail() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { data, error } = useData(() => loadData<AnalysisFile>(`analyses/${slug}.json`), [slug])

  return (
    <div className="space-y-4">
      <Link to="/analyses" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> All analyses
      </Link>
      {error ? (
        <p className="text-center text-gray-500 py-12">This analysis couldn't be found.</p>
      ) : !data ? (
        <p className="text-center text-gray-500 py-12">Loading…</p>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            Generated {formatDate(data.generated_at)} after {data.research_steps.length} research steps
          </p>
          <AnalysisReport topic={data.topic} result={data.result} />
        </>
      )}
    </div>
  )
}
