import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Code2, Users, GraduationCap, CalendarCheck, IndianRupee,
  Eye, Database, BookOpen, FolderGit2, ClipboardList, UserCog, ChevronDown,
  LogOut, Beaker, Settings
} from 'lucide-react'
import { loadPlatforms } from '../lib/db'

const DEFAULT_PLATFORMS = [
  { slug: 'leetcode', display_name: 'LeetCode', base_url: 'https://leetcode.com', active: true },
  { slug: 'codeforces', display_name: 'Codeforces', base_url: 'https://codeforces.com', active: true },
  { slug: 'github', display_name: 'GitHub', base_url: 'https://github.com', active: true },
]

const PAGE_TITLES = {
  '/admin': 'Dashboard',
  '/admin/coding/platforms': 'Platform Dashboards',
  '/admin/coding/students': 'Students & Data',
  '/admin/coding/practice': 'LeetCode Corner',
  '/admin/coding/projects': 'Student Projects',
  '/admin/coding/amcat': 'AMCAT Assessments',
  '/admin/academics/problems': 'LeetCode Problems',
  '/admin/academics/bos': 'Board of Studies',
  '/admin/academics/faculties': 'Faculties',
  '/admin/attendance': 'Attendance',
  '/admin/fees': 'Fees',
  '/admin/users': 'Manage Users',
  '/admin/settings': 'Master Data',
}

export default function AdminLayout({ adminUser, onLogout }) {
  const location = useLocation()
  const [platforms, setPlatforms] = useState([])
  const [platform, setPlatform] = useState('')
  const [openGroups, setOpenGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin_nav_groups') || '{}') } catch { return {} }
  })

  useEffect(() => {
    loadPlatforms().then(data => {
      const result = data.length > 0 ? data : DEFAULT_PLATFORMS
      setPlatforms(result)
      setPlatform(result[0]?.slug || '')
    })
  }, [])

  const toggleGroup = (key) => {
    const next = { ...openGroups, [key]: !openGroups[key] }
    setOpenGroups(next)
    localStorage.setItem('admin_nav_groups', JSON.stringify(next))
  }

  const isGroupOpen = (key) => openGroups[key] !== false // default open

  const pageTitle = PAGE_TITLES[location.pathname] || (location.pathname.startsWith('/admin/academics/bos/') ? 'Board of Studies' : 'Admin')

  const linkClass = ({ isActive }) =>
    `w-full px-5 py-2.5 flex items-center gap-2.5 text-left text-sm transition-all ${
      isActive
        ? 'bg-ambient/10 text-dark-ambient font-semibold border-l-[3px] border-dark-ambient'
        : 'text-white/50 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
    }`

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Sidebar */}
      <aside className="w-[260px] bg-primary min-h-screen flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-7" />
            <span className="text-white/20">|</span>
            <span className="text-white/70 font-medium text-xs tracking-wide">Experience Center</span>
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto space-y-0.5">
          {/* Dashboard */}
          <NavLink to="/admin" end className={linkClass}>
            <LayoutDashboard size={16} /> Dashboard
          </NavLink>

          <div className="my-2 mx-5 border-t border-white/8" />

          {/* Coding */}
          <button
            onClick={() => toggleGroup('coding')}
            className="w-full px-5 py-2 flex items-center justify-between text-white/30 text-[10px] font-bold uppercase tracking-widest hover:text-white/50 transition-colors"
          >
            Coding
            <ChevronDown size={12} className={`transition-transform ${isGroupOpen('coding') ? '' : '-rotate-90'}`} />
          </button>
          {isGroupOpen('coding') && (
            <>
              <NavLink to="/admin/coding/platforms" className={linkClass}>
                <Eye size={16} /> Platforms
              </NavLink>
              <NavLink to="/admin/coding/students" className={linkClass}>
                <Database size={16} /> Students & Data
              </NavLink>
              <NavLink to="/admin/coding/practice" className={linkClass}>
                <BookOpen size={16} /> Practice
              </NavLink>
              <NavLink to="/admin/coding/projects" className={linkClass}>
                <FolderGit2 size={16} /> Projects
              </NavLink>
              <NavLink to="/admin/coding/amcat" className={linkClass}>
                <ClipboardList size={16} /> AMCAT
              </NavLink>
            </>
          )}

          <div className="my-2 mx-5 border-t border-white/8" />

          {/* Academics */}
          <button
            onClick={() => toggleGroup('academics')}
            className="w-full px-5 py-2 flex items-center justify-between text-white/30 text-[10px] font-bold uppercase tracking-widest hover:text-white/50 transition-colors"
          >
            Academics
            <ChevronDown size={12} className={`transition-transform ${isGroupOpen('academics') ? '' : '-rotate-90'}`} />
          </button>
          {isGroupOpen('academics') && (
            <>
              <NavLink to="/admin/academics/bos" className={linkClass}>
                <BookOpen size={16} /> Board of Studies
              </NavLink>
              <NavLink to="/admin/academics/problems" className={linkClass}>
                <Beaker size={16} /> LeetCode Problems
              </NavLink>
              <NavLink to="/admin/academics/faculties" className={linkClass}>
                <GraduationCap size={16} /> Faculties
              </NavLink>
            </>
          )}

          <div className="my-2 mx-5 border-t border-white/8" />

          {/* Operations */}
          <button
            onClick={() => toggleGroup('operations')}
            className="w-full px-5 py-2 flex items-center justify-between text-white/30 text-[10px] font-bold uppercase tracking-widest hover:text-white/50 transition-colors"
          >
            Operations
            <ChevronDown size={12} className={`transition-transform ${isGroupOpen('operations') ? '' : '-rotate-90'}`} />
          </button>
          {isGroupOpen('operations') && (
            <>
              <NavLink to="/admin/attendance" className={linkClass}>
                <CalendarCheck size={16} /> Attendance
              </NavLink>
              <NavLink to="/admin/fees" className={linkClass}>
                <IndianRupee size={16} /> Fees
              </NavLink>
            </>
          )}

          {/* Manage Users — admin/master only */}
          {(adminUser.id === 'master' || adminUser.role === 'admin') && (
            <>
              <div className="my-2 mx-5 border-t border-white/8" />
              <NavLink to="/admin/users" className={linkClass}>
                <UserCog size={16} /> Manage Users
              </NavLink>
              <NavLink to="/admin/settings" className={linkClass}>
                <Settings size={16} /> Master Data
              </NavLink>
            </>
          )}
        </nav>

        {/* User info + logout */}
        <div className="px-5 py-4 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-ambient/20 flex items-center justify-center text-xs font-bold text-ambient shrink-0">
              {(adminUser.name || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">{adminUser.name}</div>
              <div className="text-white/30 text-xs capitalize">{adminUser.role}{adminUser.campus ? ` — ${adminUser.campus}` : ''}</div>
            </div>
          </div>
          <button onClick={onLogout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <LogOut size={12} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-primary/8 px-8 py-4 sticky top-0 z-40">
          <h1 className="text-xl font-bold text-primary">{pageTitle}</h1>
        </header>

        <div className="p-8 max-w-[1400px]">
          <Outlet context={{ adminUser, platforms, platform, setPlatform }} />
        </div>
      </main>
    </div>
  )
}
