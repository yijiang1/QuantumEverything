import { BookOpen, ExternalLink } from 'lucide-react'
import { loadData, useData, type ReadingListItem } from '../lib/data'
import { REPO_URL } from '../lib/site'

export default function ReadingList() {
  const { data, error, loading } = useData(() => loadData<ReadingListItem[]>('reading_list.json'))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reading List</h1>
        <p className="text-gray-500 text-sm">
          Hand-picked papers worth reading. Edit{' '}
          <a href={`${REPO_URL}/blob/main/frontend/public/data/reading_list.json`} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">
            reading_list.json
          </a>{' '}
          to add one.
        </p>
      </div>

      {error ? (
        <p className="text-center text-gray-500 py-12">{error}</p>
      ) : loading ? (
        <p className="text-center text-gray-500 py-12">Loading…</p>
      ) : data!.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>The reading list is empty.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.map((item, i) => {
            const body = (
              <>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 leading-snug">{item.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[item.authors, item.year].filter(Boolean).join(' · ')}
                  </p>
                  {item.notes && <p className="text-sm text-gray-600 mt-1.5">{item.notes}</p>}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {item.tags.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                {item.url && <ExternalLink className="w-4 h-4 text-gray-300 shrink-0 mt-1" />}
              </>
            )
            const cls = 'flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-4'
            return item.url ? (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className={`${cls} hover:border-gray-300`}>{body}</a>
            ) : (
              <div key={i} className={cls}>{body}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
