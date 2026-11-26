import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Atom, FileText, Newspaper, Library as LibraryIcon, Building2 } from 'lucide-react'
import Analyze from './pages/Analyze'
import Papers from './pages/Papers'
import News from './pages/News'
import Library from './pages/Library'
import Companies from './pages/Companies'
import CompanyDetail from './pages/CompanyDetail'

export default function App() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 text-sm transition-colors ${
      isActive ? 'text-teal-600' : 'text-gray-500 hover:text-gray-900'
    }`

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="border-b border-gray-200 bg-white/80 backdrop-blur px-6 py-3 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto flex items-center gap-8">
            <div className="flex items-center gap-2 mr-4">
              <Atom className="w-5 h-5 text-teal-600" />
              <span className="font-semibold text-gray-900">Quantum Everything</span>
            </div>
            <NavLink to="/" end className={linkClass}>
              <Atom className="w-4 h-4" /> Analyze
            </NavLink>
            <NavLink to="/papers" className={linkClass}>
              <FileText className="w-4 h-4" /> Papers
            </NavLink>
            <NavLink to="/companies" className={linkClass}>
              <Building2 className="w-4 h-4" /> Companies
            </NavLink>
            <NavLink to="/library" className={linkClass}>
              <LibraryIcon className="w-4 h-4" /> Library
            </NavLink>
            <NavLink to="/news" className={linkClass}>
              <Newspaper className="w-4 h-4" /> News
            </NavLink>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Analyze />} />
            <Route path="/papers" element={<Papers />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/:slug" element={<CompanyDetail />} />
            <Route path="/library" element={<Library />} />
            <Route path="/news" element={<News />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
