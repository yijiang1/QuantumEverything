import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { loadData, useData, type CompanyRecord } from '../lib/data'
import { CATEGORY_LABELS, PURE_PLAY_CATEGORIES, quoteUrl } from '../lib/companies'

// The site doesn't host share prices: free price feeds either block GitHub's
// servers or don't allow their data on a public website. Each listed company
// links to its live quote page instead.

function ListedTable({ title, note, rows }: { title: string; note: string; rows: CompanyRecord[] }) {
  if (rows.length === 0) return null
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{note}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {rows.map(c => (
          <div key={c.slug} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5">
            <div className="min-w-0">
              <Link to={`/companies/${c.slug}`} className="text-sm text-gray-900 hover:text-teal-700">{c.name}</Link>
              <div className="text-xs text-gray-400">
                <span className="font-mono">{c.ticker}</span>
                {c.exchange ? ` · ${c.exchange}` : ''}
                {CATEGORY_LABELS[c.category] ? ` · ${CATEGORY_LABELS[c.category]}` : ''}
              </div>
            </div>
            <a
              href={quoteUrl(c.ticker, c.exchange)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-teal-700 hover:text-teal-800 flex items-center gap-1 shrink-0"
            >
              Live quote <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Stocks() {
  const { data, error } = useData(() => loadData<CompanyRecord[]>('companies.json'))

  if (error) return <p className="text-center text-gray-500 py-12">{error}</p>
  if (!data) return <p className="text-center text-gray-500 py-12">Loading…</p>

  // One row per traded security; a subsidiary that shares its parent's ticker isn't repeated.
  const seen = new Set<string>()
  const listed = data
    .filter(c => c.ticker)
    .filter(c => {
      const key = `${c.ticker.toUpperCase()}|${c.exchange}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const pure = listed.filter(c => PURE_PLAY_CATEGORIES.has(c.category))
  const other = listed.filter(c => !PURE_PLAY_CATEGORIES.has(c.category))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quantum Stocks</h1>
        <p className="text-gray-500 text-sm">
          The {listed.length} publicly traded companies in the directory. Each links to its live quote on Yahoo Finance.
        </p>
      </div>

      <ListedTable
        title="Pure-play quantum"
        note="Companies whose business is mainly quantum technology."
        rows={pure}
      />
      <ListedTable
        title="Big tech and suppliers"
        note="Quantum is a small part of these businesses, so their share prices mostly reflect other work."
        rows={other}
      />

      <p className="text-xs text-gray-400">
        Quotes open on Yahoo Finance in a new tab. Not investment advice.
      </p>
    </div>
  )
}
