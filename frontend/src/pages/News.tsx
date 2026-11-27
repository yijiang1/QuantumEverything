import { useState } from 'react'
import { ExternalLink, Newspaper } from 'lucide-react'
import { loadData, useData, formatDate, type NewsItem, type Meta } from '../lib/data'

const SOURCE_STYLES: Record<string, string> = {
  'arXiv quant-ph': 'bg-blue-50 text-blue-700',
  'Quantum Computing Report': 'bg-emerald-50 text-emerald-700',
  'The Quantum Insider': 'bg-teal-50 text-teal-600',
}

export function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <div className="space-y-2">
      {items.map(item => (
        <a
          key={item.id}
          href={item.link || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_STYLES[item.source] ?? 'bg-gray-100 text-gray-500'}`}>
                {item.source}
              </span>
              {item.published && <span className="text-xs text-gray-400">{formatDate(item.published)}</span>}
            </div>
            <h3 className="font-medium text-gray-900 group-hover:text-teal-700 transition-colors leading-snug">
              {item.title}
            </h3>
            {item.summary && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.summary}</p>}
          </div>
          {item.link && <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />}
        </a>
      ))}
    </div>
  )
}

export default function News() {
  const { data: news, error, loading } = useData(() => loadData<NewsItem[]>('news.json'))
  const { data: meta } = useData(() => loadData<Meta>('meta.json'))
  const [source, setSource] = useState('')

  const sources = news ? Array.from(new Set(news.map(n => n.source))) : []
  const items = news ? news.filter(n => !source || n.source === source) : []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quantum News</h1>
        <p className="text-gray-500 text-sm">
          Industry and research headlines, refreshed daily.
          {meta && ` Updated ${formatDate(meta.generated_at)}.`}
        </p>
      </div>

      {sources.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {['', ...sources].map(s => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                source === s ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-gray-300 text-gray-500 hover:border-gray-400'
              }`}
            >
              {s || 'All sources'}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-center text-gray-500 py-12">{error}</p>
      ) : loading ? (
        <p className="text-center text-gray-500 py-12">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="mb-1">No news yet.</p>
          <p className="text-sm">Headlines appear after the first scheduled data refresh.</p>
        </div>
      ) : (
        <NewsList items={items} />
      )}
    </div>
  )
}
