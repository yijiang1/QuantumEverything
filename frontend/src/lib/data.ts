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
    stocks_priced?: number
  }
}

export type Point = [string, number]  // [YYYY-MM-DD, value]

export interface Changes {
  '1d': number | null
  '1m': number | null
  ytd: number | null
  '1y': number | null
}

export interface StockTicker {
  ticker: string
  exchange: string
  companies: string[]   // company slugs that trade under this ticker
  name: string
  pure_play: boolean
  currency: string
  source: string
  last: number | null
  last_date: string | null
  change: Changes
  history: Point[]
}

export interface StocksData {
  generated_at: string
  example?: boolean     // set only in preview builds that use made-up prices
  index: {
    name: string
    method: string
    constituents: string[]
    series: Point[]
    last: number | null
    last_date: string | null
    change: Changes
  }
  tickers: Record<string, StockTicker>
}

const EMPTY_STOCKS: StocksData = {
  generated_at: '',
  index: { name: '', method: '', constituents: [], series: [], last: null, last_date: null, change: { '1d': null, '1m': null, ytd: null, '1y': null } },
  tickers: {},
}

/** Stock data, or an empty set if the file isn't there yet. */
export function loadStocks(): Promise<StocksData> {
  return loadData<StocksData>('stocks.json').catch(() => EMPTY_STOCKS)
}

export interface PolicyProgram {
  slug: string
  name: string
  jurisdiction: string
  countries: string[]       // matched against Company.country
  launched: string
  period: string
  funding: string
  /** announced (default): a published budget; estimate: no official total, so a reported figure or range; proposed: recommended, not yet allocated */
  funding_basis?: 'announced' | 'estimate' | 'proposed'
  funding_confirmed: boolean
  summary: string
  source_url: string
  source_name: string
  note?: string
}

export type BillStage = 'introduced' | 'committee' | 'reported' | 'passed_one' | 'passed_both' | 'law'

export interface UsAction {
  id: string
  kind: 'law' | 'executive_order' | 'standard' | 'bill'
  title: string
  summary: string
  url?: string
  date?: string
  reference?: string
  // bills only
  congress?: number
  bill_type?: string
  number?: number
  sponsor?: string
  introduced?: string
  latest_action?: { date: string; text: string }
  stage?: BillStage
  companies?: string[]
}

export interface FederalRegisterDoc {
  id: string
  title: string
  type: string
  subtype: string
  abstract: string
  date: string
  agencies: string[]
  citation: string
  url: string
  companies: string[]
}

export interface PolicyData {
  generated_at: string
  programs: PolicyProgram[]
  us_actions: UsAction[]
  federal_register: FederalRegisterDoc[]
}

export function loadPolicy(): Promise<PolicyData> {
  return loadData<PolicyData>('policy.json').catch(
    () => ({ generated_at: '', programs: [], us_actions: [], federal_register: [] }),
  )
}

export function billLabel(a: UsAction) {
  const prefix = ({ hr: 'H.R.', s: 'S.', hres: 'H.Res.', sres: 'S.Res.', hjres: 'H.J.Res.', sjres: 'S.J.Res.' } as Record<string, string>)[a.bill_type ?? ''] ?? ''
  return `${prefix} ${a.number}`
}

export interface Facility {
  slug: string
  name: string
  type: 'government' | 'university' | 'company'
  open_access: boolean      // outside researchers can get time on its hardware
  operator: string
  city: string
  country: string
  lat: number
  lon: number
  focus: string
  platforms: string[]
  companies: string[]       // company slugs
  program: string           // national program slug, or ''
  url: string
  source_url: string
  confirmed: boolean
  note?: string
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
