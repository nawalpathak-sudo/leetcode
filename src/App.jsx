import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Upload, Eye, ChevronDown, ChevronRight, BookOpen } from 'lucide-react'
import AdminPanel from './components/AdminPanel'
import StudentView from './components/StudentView'
import HomePage from './components/HomePage'
import StudentPortal from './components/StudentPortal'
import PublicProfile from './components/PublicProfile'
import PracticeAdmin from './components/PracticeAdmin'
import PracticePage from './components/PracticePage'
import ProjectHub from './components/ProjectHub'
import { loadPlatforms } from './lib/db'

const DEFAULT_PLATFORMS = [
  { slug: 'leetcode', display_name: 'LeetCode', base_url: 'https://leetcode.com', active: true },
  { slug: 'codeforces', display_name: 'Codeforces', base_url: 'https://codeforces.com', active: true },
]

function AdminApp() {
  const [platforms, setPlatforms] = useState([])
  const [platform, setPlatform] = useState('')
  const [section, setSection] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [expandedPlatform, setExpandedPlatform] = useState('')

  useEffect(() => {
    loadPlatforms().then(data => {
      const result = data.length > 0 ? data : DEFAULT_PLATFORMS
      setPlatforms(result)
      setPlatform(result[0].slug)
      setExpandedPlatform(result[0].slug)
      setLoading(false)
    })
  }, [])

  const current = platforms.find(p => p.slug === platform)
  const platformName = current?.display_name || platform

  const handleNav = (plat, sec) => {
    setPlatform(plat)
    setSection(sec)
    setExpandedPlatform(plat)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex">
      <aside className="w-60 bg-primary min-h-screen flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-7" />
            <span className="text-white/30">|</span>
            <span className="text-white font-medium text-sm">Admin Panel</span>
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {platforms.map(p => {
            const isExpanded = expandedPlatform === p.slug
            return (
              <div key={p.slug}>
                <button
                  onClick={() => setExpandedPlatform(isExpanded ? '' : p.slug)}
                  className={`w-full px-5 py-3 flex items-center justify-between text-left transition-colors ${
                    platform === p.slug ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="font-semibold text-[15px]">{p.display_name}</span>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {isExpanded && (
                  <div className="bg-white/5">
                    <button
                      onClick={() => handleNav(p.slug, 'dashboard')}
                      className={`w-full px-5 pl-10 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                        platform === p.slug && section === 'dashboard'
                          ? 'bg-ambient text-primary font-semibold'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Eye size={14} /> Dashboard
                    </button>
                    <button
                      onClick={() => handleNav(p.slug, 'admin')}
                      className={`w-full px-5 pl-10 py-2.5 text-left text-sm flex items-center gap-2 transition-colors ${
                        platform === p.slug && section === 'admin'
                          ? 'bg-ambient text-primary font-semibold'
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Upload size={14} /> Upload Data
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          {/* Divider */}
          <div className="my-2 mx-5 border-t border-white/10" />

          {/* LeetCode Corner */}
          <button
            onClick={() => { setSection('practice'); setExpandedPlatform('') }}
            className={`w-full px-5 py-3 flex items-center gap-2.5 text-left transition-colors ${
              section === 'practice' ? 'bg-ambient text-primary font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen size={16} /> LeetCode Corner
          </button>
        </nav>

        <div className="px-5 py-4 border-t border-white/10 text-white/30 text-xs">
          ALTA School of Technology
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-primary/10 px-8 py-4 sticky top-0 z-40">
          <h1 className="text-xl font-bold text-primary">
            {section === 'practice'
              ? 'LeetCode Corner — Manage Problems'
              : `${platformName} — ${section === 'dashboard' ? 'Dashboard' : 'Upload Data'}`}
          </h1>
        </header>

        <div className="p-8 max-w-7xl">
          {section === 'practice' ? (
            <PracticeAdmin />
          ) : section === 'admin' ? (
            <AdminPanel platform={platform} platformName={platformName} platforms={platforms} />
          ) : (
            <StudentView platform={platform} platformName={platformName} />
          )}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/portal" element={<StudentPortal />} />
      <Route path="/admin" element={<AdminApp />} />
      <Route path="/practice" element={<PracticePage />} />
      <Route path="/projects" element={<ProjectHub />} />
      <Route path="/:slug" element={<PublicProfile />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
