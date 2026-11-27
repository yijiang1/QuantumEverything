import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import NavBar from './components/NavBar'
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

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function PageBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>
}

export default function App() {
  return (
    // Hash routing: GitHub Pages serves static files only, so every URL must
    // resolve to index.html. Paths live after the # (e.g. #/companies/ionq).
    <HashRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900 overflow-x-clip">
        <ScrollToTop />
        <NavBar />

        <main className="max-w-[88rem] mx-auto px-4 sm:px-6 py-6 sm:py-8">
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

        <footer className="max-w-[88rem] mx-auto px-4 sm:px-6 pb-8 text-xs text-gray-400">
          Papers from arXiv and OpenAlex. News from public RSS feeds. Policy from govinfo.gov and the Federal Register. Jobs from companies' public job boards. Deals, hardware, events, learning resources and historical trends are curated with sources. Company profiles are a curated list and may be incomplete. Stock quotes link to Yahoo Finance and are not investment advice.
        </footer>
      </div>
    </HashRouter>
  )
}
