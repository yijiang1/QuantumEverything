import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Landmark, ScrollText, Gavel, Globe2 } from 'lucide-react'
import {
  loadData, loadPolicy, useData, billLabel,
  type BillStage, type CompanyRecord, type Facility, type FederalRegisterDoc, type PolicyProgram, type UsAction,
} from '../lib/data'
import { formatDay } from '../components/StockChart'

export const STAGES: { key: BillStage; label: string }[] = [
  { key: 'introduced', label: 'Introduced' },
  { key: 'committee', label: 'In committee' },
  { key: 'reported', label: 'Reported by committee' },
  { key: 'passed_one', label: 'Passed one chamber' },
  { key: 'passed_both', label: 'Passed both chambers' },
  { key: 'law', label: 'Became law' },
]

const BASIS_LABEL: Record<string, string> = {
  estimate: 'Estimate',
  proposed: 'Proposed',
}

const KIND_LABEL: Record<string, string> = {
  law: 'Law',
  executive_order: 'Executive order',
  standard: 'Standard',
}

export function StageBar({ stage }: { stage?: BillStage }) {
  const at = Math.max(0, STAGES.findIndex(s => s.key === stage))
  return (
    <div className="space-y-1" aria-label={`Status: ${STAGES[at].label}`}>
      <div className="flex gap-0.5" aria-hidden="true">
        {STAGES.map((s, i) => (
          <span
            key={s.key}
            title={s.label}
            className={`h-1.5 flex-1 first:rounded-l-full last:rounded-r-full ${i <= at ? 'bg-teal-600' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <div className="text-xs text-gray-600">
        {STAGES[at].label} <span className="text-gray-400">· step {at + 1} of {STAGES.length}</span>
      </div>
    </div>
  )
}

function CompanyChips({ slugs, names }: { slugs: string[]; names: Map<string, string> }) {
  if (!slugs.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {slugs.map(s => (
        <Link key={s} to={`/companies/${s}`} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-teal-50 hover:text-teal-700">
          {names.get(s) ?? s}
        </Link>
      ))}
    </div>
  )
}

function SectionTitle({ icon: Icon, title, note }: { icon: typeof Landmark; title: string; note?: string }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <Icon className="w-4 h-4 text-teal-600" /> {title}
      </h2>
      {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
    </div>
  )
}

function ProgramCard({ p, companies, facilities }: { p: PolicyProgram; companies: CompanyRecord[]; facilities: Facility[] }) {
  const local = companies.filter(c => p.countries.includes(c.country))
  const sites = facilities.filter(f => f.program === p.slug)
  const shown = local.slice(0, 6)
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wider">{p.jurisdiction} · {p.launched}</div>
        <h3 className="font-medium text-gray-900 leading-snug">{p.name}</h3>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">{p.funding || 'No total published'}</span>
          {p.funding && p.funding_basis && p.funding_basis !== 'announced' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              {BASIS_LABEL[p.funding_basis]}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {p.period}
          {!p.funding_confirmed && p.funding && <span className="text-amber-700"> · figure not confirmed from the source</span>}
        </div>
      </div>
      <p className="text-sm text-gray-600">{p.summary}</p>
      {p.note && <p className="text-xs text-amber-700">{p.note}</p>}
      {local.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-400">Companies based here</div>
          <div className="flex flex-wrap gap-1.5">
            {shown.map(c => (
              <Link key={c.slug} to={`/companies/${c.slug}`} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-teal-50 hover:text-teal-700">
                {c.name}
              </Link>
            ))}
            {local.length > shown.length && (
              <Link to="/companies" className="text-xs px-2 py-0.5 text-gray-500 hover:text-teal-700">
                +{local.length - shown.length} more
              </Link>
            )}
          </div>
        </div>
      )}
      {sites.length > 0 && (
        <div className="text-xs text-gray-500">
          <Link to="/facilities" className="text-gray-400 hover:text-teal-700">Facilities:</Link>{' '}
          {sites.map(f => f.name).join('; ')}
        </div>
      )}
      <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="mt-auto pt-1 text-xs text-teal-700 hover:text-teal-800 inline-flex items-center gap-1">
        Source: {p.source_name} <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  )
}

const REGIONS: Record<string, string> = {
  'United States': 'Americas', Canada: 'Americas',
  'United Kingdom': 'Europe', 'European Union': 'Europe', Germany: 'Europe', France: 'Europe', Netherlands: 'Europe',
  Denmark: 'Europe', Finland: 'Europe', Switzerland: 'Europe', Spain: 'Europe', Italy: 'Europe', Russia: 'Europe',
}
const regionOf = (p: PolicyProgram) => REGIONS[p.jurisdiction] ?? (p.jurisdiction === 'Israel' ? 'Middle East' : 'Asia-Pacific')

function ProgramGrid({ programs, companies, facilities }: { programs: PolicyProgram[]; companies: CompanyRecord[]; facilities: Facility[] }) {
  const regions = ['Americas', 'Europe', 'Asia-Pacific', 'Middle East'].filter(r => programs.some(p => regionOf(p) === r))
  const [region, setRegion] = useState('')
  const shown = programs.filter(p => !region || regionOf(p) === region)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Region">
        {['', ...regions].map(r => (
          <button
            key={r || 'all'}
            onClick={() => setRegion(r)}
            aria-pressed={region === r}
            className={`text-xs px-2.5 py-1 rounded-full border ${region === r ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'}`}
          >
            {r || 'All'} <span className="opacity-70">{r ? programs.filter(p => regionOf(p) === r).length : programs.length}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 *:min-w-0">
        {shown.map(p => <ProgramCard key={p.slug} p={p} companies={companies} facilities={facilities} />)}
      </div>
    </div>
  )
}

function BillRow({ a, names }: { a: UsAction; names: Map<string, string> }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-teal-700 leading-snug">
            {a.title}
          </a>
          <div className="text-xs text-gray-400 mt-0.5">
            {billLabel(a)} · {a.sponsor}{a.introduced ? ` · introduced ${formatDay(a.introduced)}` : ''}
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-600">{a.summary}</p>
      <StageBar stage={a.stage} />
      {a.latest_action?.text && (
        <p className="text-xs text-gray-500">
          Latest action{a.latest_action.date ? `, ${formatDay(a.latest_action.date)}` : ''}: {a.latest_action.text}
        </p>
      )}
      <CompanyChips slugs={a.companies ?? []} names={names} />
    </div>
  )
}

function FederalRegisterList({ docs, names }: { docs: FederalRegisterDoc[]; names: Map<string, string> }) {
  const types = useMemo(() => [...new Set(docs.map(d => d.type).filter(Boolean))].sort(), [docs])
  const [type, setType] = useState('')
  const [limit, setLimit] = useState(15)
  const shown = docs.filter(d => !type || d.type === type)
  if (!docs.length) {
    return <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-6 text-center">Federal Register documents appear after the first daily data refresh.</p>
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {['', ...types].map(t => (
          <button
            key={t || 'all'}
            onClick={() => { setType(t); setLimit(15) }}
            aria-pressed={type === t}
            className={`text-xs px-2.5 py-1 rounded-full border ${type === t ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-teal-300'}`}
          >
            {t || 'All'} <span className="opacity-70">{t ? docs.filter(d => d.type === t).length : docs.length}</span>
          </button>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {shown.slice(0, limit).map(d => (
          <div key={d.id} className="p-3 space-y-1">
            <div className="text-xs text-gray-400">
              {formatDay(d.date)} · {d.type}{d.agencies.length ? ` · ${d.agencies.join(', ')}` : ''}
            </div>
            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-teal-700">
              {d.title}
            </a>
            {d.abstract && <p className="text-xs text-gray-500 line-clamp-2">{d.abstract}</p>}
            <CompanyChips slugs={d.companies} names={names} />
          </div>
        ))}
      </div>
      {shown.length > limit && (
        <button onClick={() => setLimit(l => l + 15)} className="text-sm text-teal-700 hover:text-teal-800">
          Show more ({shown.length - limit} left)
        </button>
      )}
    </div>
  )
}

export default function Policy() {
  const { data, error } = useData(() => Promise.all([
    loadPolicy(),
    loadData<CompanyRecord[]>('companies.json'),
    loadData<Facility[]>('facilities.json').catch(() => [] as Facility[]),
  ]))
  if (error) return <p className="text-center text-gray-500 py-12">{error}</p>
  if (!data) return <p className="text-center text-gray-500 py-12">Loading…</p>
  const [policy, companies, facilities] = data
  const names = new Map(companies.map(c => [c.slug, c.name]))
  const bills = policy.us_actions
    .filter(a => a.kind === 'bill')
    .sort((a, b) =>
      STAGES.findIndex(s => s.key === b.stage) - STAGES.findIndex(s => s.key === a.stage)
      || (b.latest_action?.date ?? '').localeCompare(a.latest_action?.date ?? ''))
  const enacted = policy.us_actions
    .filter(a => a.kind !== 'bill')
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quantum Policy</h1>
        <p className="text-gray-500 text-sm max-w-2xl">
          National quantum programs and their budgets, US laws and bills, and federal rules and notices that
          mention quantum technology.
        </p>
      </div>

      <section className="space-y-3">
        <SectionTitle
          icon={Globe2}
          title="National programs"
          note="Public funding in each program's own currency. Periods and what counts as funding differ, so compare with care. Estimate marks countries with no official total; Proposed marks a recommended figure not yet allocated."
        />
        <ProgramGrid programs={policy.programs} companies={companies} facilities={facilities} />
      </section>

      <section className="space-y-3">
        <SectionTitle icon={ScrollText} title="US bills in Congress" note="Status is refreshed daily from govinfo.gov bill status files." />
        <div className="space-y-3">
          {bills.map(a => <BillRow key={a.id} a={a} names={names} />)}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={Gavel} title="US laws, executive orders and standards" />
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {enacted.map(a => (
            <div key={a.id} className="p-3 sm:flex gap-4">
              <div className="text-xs text-gray-400 sm:w-28 shrink-0 pt-0.5">{a.date ? formatDay(a.date) : ''}</div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{KIND_LABEL[a.kind] ?? a.kind}</span>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-gray-900 hover:text-teal-700">
                    {a.title}
                  </a>
                </div>
                <div className="text-xs text-gray-400">{a.reference}</div>
                <p className="text-sm text-gray-600">{a.summary}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle icon={Landmark} title="Federal Register" note="Rules, proposed rules, notices and presidential documents that mention quantum technology, newest first." />
        <FederalRegisterList docs={policy.federal_register} names={names} />
      </section>

      <p className="text-xs text-gray-400">
        Programs and US actions are a curated list; edit backend/app/policy in the repository to add or correct one.
        Federal Register items come from the Federal Register API.
      </p>
    </div>
  )
}
