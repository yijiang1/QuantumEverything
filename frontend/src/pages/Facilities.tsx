import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, MapPin, Building } from 'lucide-react'
import { loadData, loadPolicy, useData, type CompanyRecord, type Facility } from '../lib/data'
import { PLATFORM_LABELS } from '../lib/companies'
import { FACILITY_TYPES, TypeLabel } from '../components/FacilityType'

// Leaflet is only needed on this page, so load it in its own chunk.
const FacilitiesMap = lazy(() => import('../components/FacilitiesMap'))

function FacilityCard({ f, names, programs }: {
  f: Facility
  names: Map<string, string>
  programs: Map<string, string>
}) {
  return (
    <div id={`facility-${f.slug}`} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2 scroll-mt-20 transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 leading-snug">{f.name}</h3>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" /> {f.city} · {f.operator}{f.opened ? ` · Since ${f.opened}` : ''}
          </p>
        </div>
        {f.url && (
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:text-teal-800 shrink-0" aria-label={`${f.name} website`}>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TypeLabel type={f.type} />
        {f.open_access && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
            Outside researchers can use it
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600">{f.focus}</p>
      {(f.platforms.length > 0 || f.companies.length > 0 || f.program) && (
        <div className="flex flex-wrap gap-1.5">
          {f.platforms.map(p => (
            <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{PLATFORM_LABELS[p] ?? p}</span>
          ))}
          {f.companies.map(s => (
            <Link key={s} to={`/companies/${s}`} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-teal-50 hover:text-teal-700">
              {names.get(s) ?? s}
            </Link>
          ))}
          {f.program && programs.get(f.program) && (
            <Link to="/policy" className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 hover:bg-teal-50 hover:text-teal-700">
              Program: {programs.get(f.program)}
            </Link>
          )}
        </div>
      )}
      {(!f.confirmed || f.note) && (
        <p className="text-xs text-amber-700">{f.note ?? 'Not yet confirmed from a source.'}</p>
      )}
    </div>
  )
}

export default function Facilities() {
  const { data, error } = useData(() => Promise.all([
    loadData<Facility[]>('facilities.json'),
    loadData<CompanyRecord[]>('companies.json'),
    loadPolicy(),
  ]))
  const [type, setType] = useState<'' | Facility['type']>('')
  const [openOnly, setOpenOnly] = useState(false)
  const [country, setCountry] = useState('')

  const all = data?.[0] ?? []
  const countries = useMemo(() => [...new Set(all.map(f => f.country))].sort(), [all])
  const shown = useMemo(() => all.filter(f =>
    (!type || f.type === type) && (!openOnly || f.open_access) && (!country || f.country === country)),
  [all, type, openOnly, country])
  const select = useCallback((slug: string) => {
    const card = document.getElementById(`facility-${slug}`)
    if (!card) return
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    card.classList.add('ring-2', 'ring-teal-500')
    setTimeout(() => card.classList.remove('ring-2', 'ring-teal-500'), 1600)
  }, [])
  const byCountry = useMemo(() => {
    const m = new Map<string, Facility[]>()
    for (const f of shown) m.set(f.country, [...(m.get(f.country) ?? []), f])
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [shown])

  if (error) return <p className="text-center text-gray-500 py-12">{error}</p>
  if (!data) return <p className="text-center text-gray-500 py-12">Loading…</p>
  const [, companies, policy] = data
  const names = new Map(companies.map(c => [c.slug, c.name]))
  const programs = new Map(policy.programs.map(p => [p.slug, `${p.name} (${p.jurisdiction})`]))
  const counts = (Object.keys(FACILITY_TYPES) as Facility['type'][]).map(t => [t, all.filter(f => f.type === t).length] as const)

  const selectClass = 'bg-gray-100 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-teal-500'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quantum Facilities</h1>
        <p className="text-gray-500 text-sm max-w-2xl">
          National labs, testbeds, university institutes and company sites where quantum computers are built,
          studied or made available to researchers.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {counts.map(([t, n]) => (
          <button
            key={t}
            onClick={() => setType(type === t ? '' : t)}
            aria-pressed={type === t}
            className={`text-left bg-white border rounded-xl p-3 transition-colors ${type === t ? 'border-teal-500' : 'border-gray-200 hover:border-teal-300'}`}
          >
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{n}</div>
            <TypeLabel type={t} />
          </button>
        ))}
        <button
          onClick={() => setOpenOnly(o => !o)}
          aria-pressed={openOnly}
          className={`text-left bg-white border rounded-xl p-3 transition-colors ${openOnly ? 'border-teal-500' : 'border-gray-200 hover:border-teal-300'}`}
        >
          <div className="text-2xl font-bold text-gray-900 tabular-nums">{all.filter(f => f.open_access).length}</div>
          <div className="text-xs text-gray-600">Open to outside researchers</div>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select id="facility-type" value={type} onChange={e => setType(e.target.value as '' | Facility['type'])} className={selectClass}>
          <option value="">All types</option>
          {Object.entries(FACILITY_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select id="facility-country" value={country} onChange={e => setCountry(e.target.value)} className={selectClass}>
          <option value="">All countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 px-2 cursor-pointer select-none">
          <input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} className="accent-teal-600" />
          Open to outside researchers
        </label>
        <span className="text-xs text-gray-400 ml-auto">{shown.length} of {all.length}</span>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Map legend">
          {(Object.keys(FACILITY_TYPES) as Facility['type'][]).map(t => <TypeLabel key={t} type={t} />)}
        </div>
        <Suspense fallback={<div className="h-72 sm:h-96 xl:h-[32rem] rounded-xl border border-gray-200 bg-gray-100" />}>
          <FacilitiesMap facilities={shown} onSelect={select} />
        </Suspense>
        <p className="text-xs text-gray-400">Pins mark the town or campus, not the exact building. Click a pin to jump to its entry.</p>
      </div>

      {shown.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <Building className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>No facilities match these filters.</p>
        </div>
      ) : (
        byCountry.map(([c, list]) => (
          <section key={c} className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">{c} <span className="text-gray-400 font-normal">{list.length}</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {list.map(f => <FacilityCard key={f.slug} f={f} names={names} programs={programs} />)}
            </div>
          </section>
        ))
      )}

      <p className="text-xs text-gray-400">
        A curated list; edit backend/app/facilities/facilities.json in the repository to add or correct a facility.
      </p>
    </div>
  )
}
