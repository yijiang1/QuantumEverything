import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Atom, Banknote, BookOpen, Building2, CalendarDays, ChevronDown, Cpu, FileText, GraduationCap, Landmark,
  LayoutGrid, LineChart, MapPin, Menu, Newspaper, Search, Sparkles, TrendingUp, X,
} from 'lucide-react'
import { loadData, type CompanyRecord } from '../lib/data'

type Icon = ComponentType<{ className?: string }>
interface Page { to: string; label: string; icon: Icon; blurb: string; end?: boolean }
interface Group { label: string; pages: Page[] }

export const HOME: Page = { to: '/', label: 'Overview', icon: LayoutGrid, blurb: 'The latest across the site', end: true }

export const GROUPS: Group[] = [
  {
    label: 'Industry',
    pages: [
      { to: '/companies', label: 'Companies', icon: Building2, blurb: 'Quantum companies and their profiles' },
      { to: '/stocks', label: 'Stocks', icon: LineChart, blurb: 'Listed companies, with live quote links' },
      { to: '/funding', label: 'Funding', icon: Banknote, blurb: 'Rounds, IPOs, SPACs and acquisitions' },
      { to: '/events', label: 'Events & jobs', icon: CalendarDays, blurb: 'Conferences and open roles' },
    ],
  },
  {
    label: 'Research',
    pages: [
      { to: '/papers', label: 'Papers', icon: FileText, blurb: 'New papers from arXiv and OpenAlex' },
      { to: '/hardware', label: 'Hardware', icon: Cpu, blurb: 'Machines, fidelities and roadmaps' },
      { to: '/trends', label: 'Trends', icon: TrendingUp, blurb: 'The field’s history in charts' },
      { to: '/analyses', label: 'Analyses', icon: Sparkles, blurb: 'Saved opportunity reports' },
    ],
  },
  {
    label: 'World',
    pages: [
      { to: '/policy', label: 'Policy', icon: Landmark, blurb: 'National programs, laws and rules' },
      { to: '/facilities', label: 'Facilities', icon: MapPin, blurb: 'Labs and sites on a world map' },
      { to: '/news', label: 'News', icon: Newspaper, blurb: 'Headlines from quantum news feeds' },
    ],
  },
  {
    label: 'Learn',
    pages: [
      { to: '/learn', label: 'Courses & lectures', icon: GraduationCap, blurb: 'Free courses, videos and notes' },
      { to: '/reading-list', label: 'Reading list', icon: BookOpen, blurb: 'Saved papers and links' },
    ],
  },
]

const ALL_PAGES = [HOME, ...GROUPS.flatMap(g => g.pages)]

function isIn(pathname: string, p: Page) {
  return p.end ? pathname === p.to : pathname === p.to || pathname.startsWith(`${p.to}/`)
}

// ── Search ────────────────────────────────────────────────────────────────────

interface Hit { to: string; label: string; sub: string }

function useSearch(q: string, enabled: boolean) {
  const [companies, setCompanies] = useState<CompanyRecord[] | null>(null)
  useEffect(() => {
    if (enabled && !companies) loadData<CompanyRecord[]>('companies.json').then(setCompanies).catch(() => setCompanies([]))
  }, [enabled, companies])
  return useMemo<Hit[]>(() => {
    const n = q.trim().toLowerCase()
    if (!n) return []
    const pages = ALL_PAGES
      .filter(p => p.label.toLowerCase().includes(n) || p.blurb.toLowerCase().includes(n))
      .map(p => ({ to: p.to, label: p.label, sub: 'Page' }))
    const cos = (companies ?? [])
      .filter(c => [c.name, c.ticker ?? '', ...(c.aliases ?? [])].some(t => t.toLowerCase().includes(n)))
      .slice(0, 8)
      .map(c => ({ to: `/companies/${c.slug}`, label: c.name, sub: c.ticker ? `Company · ${c.ticker}` : 'Company' }))
    return [...pages, ...cos].slice(0, 10)
  }, [q, companies])
}

function SiteSearch({ onGo, autoFocus = false }: { onGo?: () => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const hits = useSearch(q, open || q.length > 0)
  const navigate = useNavigate()
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (h: Hit) => {
    navigate(h.to)
    setQ('')
    setOpen(false)
    onGo?.()
  }

  return (
    <div ref={box} className="relative w-full">
      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={e => { setQ(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' && hits[active]) go(hits[active])
          else if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur() }
        }}
        placeholder="Search companies and pages"
        aria-label="Search companies and pages"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls="site-search-results"
        className="w-full bg-gray-100 border border-transparent rounded-lg pl-9 pr-3 h-10 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:bg-white focus:border-teal-500"
      />
      {open && q.trim() && (
        <ul id="site-search-results" role="listbox" className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-30 max-h-80 overflow-y-auto">
          {hits.length === 0 && <li className="px-3 py-2 text-sm text-gray-500">No matches</li>}
          {hits.map((h, i) => (
            <li key={h.to} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(h)}
                className={`w-full text-left px-3 py-2 min-h-11 flex items-center justify-between gap-3 ${i === active ? 'bg-teal-50' : ''}`}
              >
                <span className="text-sm text-gray-900 truncate">{h.label}</span>
                <span className="text-xs text-gray-500 shrink-0">{h.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Desktop menus ─────────────────────────────────────────────────────────────

function GroupMenu({ group, open, setOpen }: { group: Group; open: boolean; setOpen: (o: boolean) => void }) {
  const { pathname } = useLocation()
  const current = group.pages.some(p => isIn(pathname, p))
  const id = `menu-${group.label.toLowerCase()}`
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className={`flex items-center gap-1 px-3 h-10 rounded-lg text-sm font-medium transition-colors ${
          current ? 'text-teal-700 bg-teal-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        {group.label}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} className="absolute left-0 top-full pt-1 z-30">
          <div className="w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-1.5">
            {group.pages.map(p => (
              <NavLink
                key={p.to}
                to={p.to}
                end={p.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `flex items-start gap-3 rounded-lg px-3 py-2 ${isActive ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
              >
                {({ isActive }) => (
                  <>
                    <p.icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? 'text-teal-600' : 'text-gray-400'}`} />
                    <span>
                      <span className={`block text-sm ${isActive ? 'text-teal-700 font-medium' : 'text-gray-900'}`}>{p.label}</span>
                      <span className="block text-xs text-gray-500">{p.blurb}</span>
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mobile drawer ─────────────────────────────────────────────────────────────

function MobileMenu({ onClose }: { onClose: () => void }) {
  const { pathname } = useLocation()
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', esc) }
  }, [onClose])
  const item = (p: Page) => {
    const active = isIn(pathname, p)
    return (
      <Link
        key={p.to}
        to={p.to}
        onClick={onClose}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-lg px-3 min-h-12 ${active ? 'bg-teal-50 text-teal-700 font-medium' : 'text-gray-800 active:bg-gray-100'}`}
      >
        <p.icon className={`w-5 h-5 shrink-0 ${active ? 'text-teal-600' : 'text-gray-400'}`} />
        <span className="text-[15px]">{p.label}</span>
      </Link>
    )
  }
  return (
    <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Site menu">
      <div className="absolute inset-0 bg-gray-900/30" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-[min(22rem,88vw)] bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 shrink-0">
          <span className="font-semibold text-gray-900">Menu</span>
          <button onClick={onClose} aria-label="Close menu" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain p-3 space-y-4">
          <SiteSearch onGo={onClose} />
          <div>{item(HOME)}</div>
          {GROUPS.map(g => (
            <div key={g.label}>
              <div className="px-3 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{g.label}</div>
              {g.pages.map(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Bar ───────────────────────────────────────────────────────────────────────

export default function NavBar() {
  const { pathname } = useLocation()
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [drawer, setDrawer] = useState(false)
  const bar = useRef<HTMLElement>(null)
  const closeDrawer = useCallback(() => setDrawer(false), [])

  useEffect(() => { setOpenGroup(null); setDrawer(false) }, [pathname])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (bar.current && !bar.current.contains(e.target as Node)) setOpenGroup(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroup(null) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [])

  const current = ALL_PAGES.find(p => isIn(pathname, p))

  return (
    <header ref={bar} className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-[88rem] mx-auto px-4 sm:px-6 h-14 flex items-center gap-2 lg:gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0 min-h-11 pr-2" aria-label="Quantum Everything home">
          <Atom className="w-6 h-6 text-teal-600" />
          <span className="font-semibold text-gray-900">Quantum Everything</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1" aria-label="Main">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `px-3 h-10 flex items-center rounded-lg text-sm font-medium ${isActive ? 'text-teal-700 bg-teal-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            Overview
          </NavLink>
          {GROUPS.map(g => (
            <GroupMenu key={g.label} group={g} open={openGroup === g.label} setOpen={o => setOpenGroup(o ? g.label : null)} />
          ))}
        </nav>

        <div className="hidden lg:block ml-auto w-72">
          <SiteSearch />
        </div>

        <div className="lg:hidden ml-auto flex items-center gap-1 min-w-0">
          {current && current !== HOME && (
            <span className="hidden sm:block text-sm text-gray-500 truncate">{current.label}</span>
          )}
          <button
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            aria-expanded={drawer}
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
      {/* portal: the header's backdrop blur would otherwise trap the fixed drawer inside it */}
      {drawer && createPortal(<MobileMenu onClose={closeDrawer} />, document.body)}
    </header>
  )
}
