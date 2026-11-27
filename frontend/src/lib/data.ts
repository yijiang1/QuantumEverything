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
  /** year it opened or was set up; for a hosted machine, the year it was installed */
  opened?: number | null
  opened_confirmed?: boolean
  opened_source?: string
}

export interface AnalysisSummary {
  slug: string
  topic: string
  generated_at: string
  opportunity_level: string
  opportunity_score: number
  summary: string
}

export type DealKind = 'venture' | 'acquisition' | 'spac' | 'ipo' | 'public_offering' | 'grant'

export interface Deal {
  id: string
  date: string               // YYYY-MM-DD or YYYY-MM
  kind: DealKind
  company: string            // slug
  counterparty: string       // acquirer: a slug or a plain name
  counterparty_slug: string  // set when counterparty is a known company
  title: string
  amount: number | null      // millions of `currency`
  currency: string
  amount_text: string
  valuation_text: string
  lead_investors: string[]
  source_url: string
  source_name: string
  confirmed: boolean
  note?: string
}

export interface Machine {
  id: string
  kind: 'machine'
  company: string
  builder: string
  name: string
  date: string               // YYYY-MM
  status: 'available' | 'announced' | 'research'
  platform: string
  qubits: number | null
  logical_qubits: number | null
  two_qubit_fidelity: number | null  // percent
  fidelity_text: string
  highlight: string
  source_url: string
  source_name: string
  confirmed: boolean
  note?: string
}

export interface Milestone {
  id: string
  kind: 'milestone'
  company: string
  builder: string
  year: number
  target: string
  logical_qubits: number | null
  qubits: number | null
  source_url: string
  source_name: string
  confirmed: boolean
  note?: string
}

export type HardwareRecord = Machine | Milestone

export interface EventItem {
  id: string
  name: string
  start: string
  end: string
  city: string
  country: string
  format: 'in_person' | 'hybrid' | 'online'
  kind: 'academic' | 'industry' | 'government'
  url: string
  source_url: string
  confirmed: boolean
  note?: string
}

export interface Job {
  id: string
  company: string
  title: string
  location: string
  department: string
  remote: boolean
  url: string
  posted: string
  source: string
}

export interface JobBoard {
  company: string
  ats: string
  careers_url: string
  open_roles: number | null
  checked: string
}

export interface JobsData {
  generated_at: string
  boards: JobBoard[]
  jobs: Job[]
}

/** Month precision dates ("2026-05") display as "May 2026". */
export type LearnLevel = 'beginner' | 'intermediate' | 'advanced'
export type LearnFormat = 'course' | 'video' | 'lecture_notes' | 'book' | 'tutorial' | 'interactive'

export interface LearnResource {
  id: string
  title: string
  provider: string
  people: string[]
  level: LearnLevel
  format: LearnFormat
  topics: string[]
  language: string
  year: number | null
  description: string
  url: string
  free_note: string
  confirmed: boolean
}

export type TrendSeries = 'qubits' | 'two_qubit_fidelity' | 'coherence' | 'quantum_volume' | 'qec_milestones' | 'arxiv_quant_ph'

export interface TrendPoint {
  id: string
  series: TrendSeries
  date: string            // YYYY or YYYY-MM
  label: string
  platform: string
  value: number | null
  value_text: string
  group: string
  description: string
  source_url: string
  source_name: string
  confirmed: boolean
  note?: string
}

export function formatMonthOrDay(d: string) {
  if (/^\d{4}-\d{2}$/.test(d)) {
    return new Date(`${d}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
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
