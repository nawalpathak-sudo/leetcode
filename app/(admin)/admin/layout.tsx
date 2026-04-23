'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Code2, GraduationCap, CalendarCheck, IndianRupee,
  Users, Settings, ChevronDown, ChevronRight, LogOut, Menu, X, Newspaper
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/admin',
  },
  {
    label: 'Coding',
    icon: Code2,
    items: [
      { label: 'Platforms', href: '/admin/coding/platforms' },
      { label: 'Students & Data', href: '/admin/coding/students' },
      { label: 'Practice', href: '/admin/coding/practice' },
      { label: 'Projects', href: '/admin/coding/projects' },
      { label: 'AMCAT', href: '/admin/coding/amcat' },
      { label: 'AMCAT Comparison', href: '/admin/coding/amcat-comparison' },
      { label: 'Weekly Report', href: '/admin/coding/weekly-report' },
    ],
  },
  {
    label: 'Academics',
    icon: GraduationCap,
    items: [
      { label: 'Board of Studies', href: '/admin/academics/bos' },
      { label: 'LeetCode Problems', href: '/admin/academics/problems' },
      { label: 'Faculties', href: '/admin/academics/faculties' },
      { label: 'Timetable', href: '/admin/academics/timetable' },
    ],
  },
  {
    label: 'Attendance',
    icon: CalendarCheck,
    href: '/admin/attendance',
  },
  {
    label: 'Fees',
    icon: IndianRupee,
    href: '/admin/fees',
  },
  {
    label: 'CMS',
    icon: Newspaper,
    items: [
      { label: 'Homepage', href: '/admin/cms' },
      { label: 'Clubs', href: '/admin/cms/clubs' },
      { label: 'Events', href: '/admin/cms/events' },
    ],
  },
  {
    label: 'Users',
    icon: Users,
    href: '/admin/users',
  },
  {
    label: 'Settings',
    icon: Settings,
    href: '/admin/settings',
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('admin_nav_collapsed')
    if (saved) setCollapsed(JSON.parse(saved))
  }, [])

  // Login page gets no sidebar/topbar
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  function toggleGroup(label: string) {
    const next = { ...collapsed, [label]: !collapsed[label] }
    setCollapsed(next)
    localStorage.setItem('admin_nav_collapsed', JSON.stringify(next))
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await fetch('/api/verify-otp', { method: 'DELETE' }).catch(() => {})
    document.cookie = 'alta_session=; Path=/; Max-Age=0'
    router.push('/admin/login')
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'} transition-all duration-200 flex flex-col border-r bg-white`}
        style={{ borderColor: 'var(--color-border)' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <img src="/alta-icon.png" alt="ALTA" className="h-8" />
          <span className="ml-3 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
            AlgoArena
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {NAV_GROUPS.map(group => {
            const Icon = group.icon
            if (group.href) {
              return (
                <Link
                  key={group.label}
                  href={group.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors ${
                    isActive(group.href) ? 'text-[var(--color-dark-ambient)] bg-[var(--color-active-bg)] border-l-3 border-[var(--color-dark-ambient)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]'
                  }`}
                >
                  <Icon size={18} />
                  {group.label}
                </Link>
              )
            }

            const isGroupActive = group.items?.some(item => isActive(item.href))
            const isOpen = !collapsed[group.label]

            return (
              <div key={group.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isGroupActive ? 'text-[var(--color-dark-ambient)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="flex-1 text-left">{group.label}</span>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {isOpen && group.items && (
                  <div className="ml-8 mt-1 space-y-0.5">
                    {group.items.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive(item.href) ? 'text-[var(--color-dark-ambient)] bg-[var(--color-active-bg)] font-medium' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]'
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center px-6 border-b bg-white" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mr-4 text-[var(--color-text-secondary)]">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
            {getPageTitle(pathname)}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

function getPageTitle(pathname: string): string {
  const titles: Record<string, string> = {
    '/admin': 'Dashboard',
    '/admin/coding/platforms': 'Platform Dashboards',
    '/admin/coding/students': 'Students & Data',
    '/admin/coding/practice': 'Practice Problems',
    '/admin/coding/projects': 'Projects',
    '/admin/coding/amcat': 'AMCAT',
    '/admin/coding/amcat-comparison': 'AMCAT Comparison',
    '/admin/academics/bos': 'Board of Studies',
    '/admin/academics/problems': 'LeetCode Problems',
    '/admin/academics/faculties': 'Faculties',
    '/admin/academics/timetable': 'Timetable',
    '/admin/attendance': 'Attendance',
    '/admin/fees': 'Fees',
    '/admin/users': 'Users',
    '/admin/settings': 'Settings',
  }
  return titles[pathname] || 'Admin'
}
