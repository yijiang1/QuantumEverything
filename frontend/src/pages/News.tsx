import { useState, useEffect } from 'react'
import { RefreshCw, ExternalLink, Newspaper } from 'lucide-react'

interface NewsItem {
  title: string
  summary: string
  link: string
  published: string
  source: string
  category: string
}

const SOURCE_STYLES: Record<string, string> = {
  'arXiv quant-ph': 'bg-blue-50 text-blue-700',
  'Quantum Computing Report': 'bg-emerald-50 text-emerald-700',
  'The Quantum Insider': 'bg-teal-50 text-teal-600',
}

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadNews()
  }, [])

  const loadNews = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/news?limit=50')
      setNews(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetch('/api/news/refresh', { method: 'POST' })
      await loadNews()
    } finally {
      setRefreshing(false)
    }
  }

  const formatDate = (s: string) => {
    if (!s) return ''
    try {
      return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return s.slice(0, 16)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quantum News</h1>
          <p className="text-gray-500 text-sm">{news.length} items from {new Set(news.map(n => n.source)).size} sources</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading…</div>
      ) : news.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <Newspaper className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="mb-1">No news yet.</p>
          <p className="text-sm">Click Refresh to fetch the latest quantum computing news.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {news.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_STYLES[item.source] ?? 'bg-gray-100 text-gray-500'}`}>
                    {item.source}
                  </span>
                  {item.published && (
                    <span className="text-xs text-gray-400">{formatDate(item.published)}</span>
                  )}
                </div>
                <h3 className="font-medium text-gray-900 group-hover:text-teal-700 transition-colors leading-snug">
                  {item.title}
                </h3>
                {item.summary && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.summary}</p>
                )}
              </div>
              <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
