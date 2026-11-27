// Static data loader. Everything the site shows comes from JSON files in
// public/data, written by the data pipeline (backend/pipeline) and refreshed
// by a scheduled GitHub Actions workflow.
import { useEffect, useState } from 'react'
import type { Paper } from '../components/PaperCard'
import type { Company } from './companies'

export interface NewsItem {
  id: string
  title: string
  summary: string
  link: string
  published: string
  source: string
  category: string
}

export interface CompanyRecord extends Company {
  paper_ids: number[]
  news_ids: string[]
}

export interface Meta {
  generated_at: string
  counts: {
    papers: number
    papers_scored: number
    news: number
    companies: number
    public_companies: number
  }
}

export interface AnalysisSummary {
  slug: string
  topic: string
  generated_at: string
  opportunity_level: string
  opportunity_score: number
  summary: string
}

export interface ReadingListItem {
  title: string
  authors?: string
  year?: string
  url?: string
  tags?: string[]
  notes?: string
}

const cache = new Map<string, Promise<unknown>>()

export function loadData<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(`${import.meta.env.BASE_URL}data/${path}`).then(res => {
      if (!res.ok) throw new Error(`Couldn't load ${path} (${res.status})`)
      return res.json()
    })
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return cache.get(path) as Promise<T>
}

/** Papers the site shows: everything the pipeline didn't skip. */
export async function loadPapers(): Promise<Paper[]> {
  const all = await loadData<Paper[]>('papers.json')
  return all.filter(p => p.status !== 'skipped')
}

export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    setError('')
    loader()
      .then(d => { if (live) setData(d) })
      .catch(e => { if (live) setError(String(e.message ?? e)) })
    return () => { live = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading: data === null && !error }
}

export function formatDate(s: string) {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime())
    ? s.slice(0, 16)
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
