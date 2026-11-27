import { HashRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import { Atom, FileText, Newspaper, Building2, LayoutGrid, BookOpen, Sparkles, LineChart, Landmark, MapPin, Banknote, Cpu, CalendarDays, TrendingUp, GraduationCap } from 'lucide-react'
import Overview from './pages/Overview'
import Papers from './pages/Papers'
import News from './pages/News'
import Companies from './pages/Companies'
import CompanyDetail from './pages/CompanyDetail'
import Stocks from './pages/Stocks'
import Policy from './pages/Policy'
import Facilities from './pages/Facilities'
import Funding from './pages/Funding'
import Hardware from './pages/Hardware'
import EventsJobs from './pages/EventsJobs'
import Trends from './pages/Trends'
import Learn from './pages/Learn'
import ReadingList from './pages/ReadingList'
import { AnalysesList, AnalysisDetail } from './pages/Analyses'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/trends', label: 'Trends', icon: TrendingUp },
  { to: '/papers', label: 'Papers', icon: FileText },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/stocks', label: 'Stocks', icon: LineChart },
  { to: '/funding', label: 'Funding', icon: Banknote },
  { to: '/hardware', label: 'Hardware', icon: Cpu },
  { to: '/policy', label: 'Policy', icon: Landmark },
  { to: '/facilities', label: 'Facilities', icon: MapPin },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/events', label: 'Events & jobs', icon: CalendarDays },
  { to: '/learn', label: 'Learn', icon: GraduationCap },
  { to: '/analyses', label: 'Analyses', icon: Sparkles },
  { to: '/reading-list', label: 'Reading list', icon: BookOpen },
]

function PageBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

export default function App() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 text-sm whitespace-nowrap transition-colors ${
      isActive ? 'text-teal-600' : 'text-gray-500 hover:text-gray-900'
    }`

  return (
    // Hash routing: GitHub Pages serves static files only, so every URL must
    // resolve to index.html. Paths live after the # (e.g. #/companies/ionq).
    <HashRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="border-b border-gray-200 bg-white/80 backdrop-blur px-4 sm:px-6 py-3 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <Atom className="w-5 h-5 text-teal-600" />
              <span className="font-semibold text-gray-900 hidden sm:inline">Quantum Everything</span>
            </Link>
            <div className="flex items-center gap-5 overflow-x-auto -my-1 py-1">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} className={linkClass}>
                  <Icon className="w-4 h-4" /> {label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <PageBoundary>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/papers" element={<Papers />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/:slug" element={<CompanyDetail />} />
            <Route path="/stocks" element={<Stocks />} />
            <Route path="/policy" element={<Policy />} />
            <Route path="/facilities" element={<Facilities />} />
            <Route path="/funding" element={<Funding />} />
            <Route path="/hardware" element={<Hardware />} />
            <Route path="/events" element={<EventsJobs />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/news" element={<News />} />
            <Route path="/analyses" element={<AnalysesList />} />
            <Route path="/analyses/:slug" element={<AnalysisDetail />} />
            <Route path="/reading-list" element={<ReadingList />} />
            <Route path="*" element={<p className="text-center text-gray-500 py-12">Page not found.</p>} />
          </Routes>
          </PageBoundary>
        </main>

        <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-8 text-xs text-gray-400">
          Papers from arXiv and OpenAlex. News from public RSS feeds. Policy from govinfo.gov and the Federal Register. Jobs from companies' public job boards. Deals, hardware, events, learning resources and historical trends are curated with sources. Company profiles are a curated list and may be incomplete. Share prices are daily closes and not investment advice.
        </footer>
      </div>
    </HashRouter>
  )
}
