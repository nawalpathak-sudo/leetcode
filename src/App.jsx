import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Eye, BookOpen, LogOut, Shield, Users, Database, FolderGit2 } from 'lucide-react'
import AdminPanel from './components/AdminPanel'
import StudentView from './components/StudentView'
import HomePage from './components/HomePage'
import StudentPortal from './components/StudentPortal'
import PublicProfile from './components/PublicProfile'
import PracticeAdmin from './components/PracticeAdmin'
import PracticePage from './components/PracticePage'
import ProjectHub from './components/ProjectHub'
import UserManagement from './components/UserManagement'
import AdminProjects from './components/AdminProjects'
import { loadPlatforms, getAdminByPhone, getAdminById, sendOtp, verifyOtp } from './lib/db'
import { AuthProvider } from './context/AuthContext'

const DEFAULT_PLATFORMS = [
  { slug: 'leetcode', display_name: 'LeetCode', base_url: 'https://leetcode.com', active: true },
  { slug: 'codeforces', display_name: 'Codeforces', base_url: 'https://codeforces.com', active: true },
  { slug: 'github', display_name: 'GitHub', base_url: 'https://github.com', active: true },
]

function formatAdminPhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length === 12) return digits
  if (digits.length === 10) return '91' + digits
  return digits
}

const MASTER_PHONE = '918770857928'
const MASTER_OTP = '060226'
const MASTER_ADMIN = { id: 'master', name: 'Master Admin', role: 'admin', campus: null, active: true }

function AdminLoginScreen({ onSuccess }) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [adminUser, setAdminUser] = useState(null)
  const timerRef = useRef(null)

  const startResendTimer = () => {
    setResendTimer(30)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true); setError('')
    const formatted = formatAdminPhone(phone)
    if (formatted.length !== 12) {
      setError('Please enter a valid 10-digit mobile number.')
      setLoading(false); return
    }
    // Master login — skip DB check and OTP send
    if (formatted === MASTER_PHONE) {
      setAdminUser(MASTER_ADMIN)
      setPhone(formatted)
      setStep(2)
      setLoading(false)
      return
    }
    const admin = await getAdminByPhone(formatted)
    if (!admin) {
      setError('No admin/faculty account found with this number.')
      setLoading(false); return
    }
    setAdminUser(admin)
    const result = await sendOtp(formatted)
    if (!result?.success) {
      setError(result?.error || 'Failed to send OTP. Please try again.')
      setLoading(false); return
    }
    setPhone(formatted)
    setStep(2)
    startResendTimer()
    setLoading(false)
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) return
    setLoading(true); setError('')
    // Master login — hardcoded OTP check
    if (phone === MASTER_PHONE) {
      if (otp === MASTER_OTP) {
        onSuccess(adminUser)
      } else {
        setError('Invalid OTP.')
      }
      setLoading(false)
      return
    }
    const result = await verifyOtp(phone, otp)
    if (!result?.success) {
      setError(result?.error || 'Invalid or expired OTP. Please try again.')
      setLoading(false); return
    }
    onSuccess(adminUser)
    setLoading(false)
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    if (phone === MASTER_PHONE) return
    setLoading(true); setError('')
    const result = await sendOtp(phone)
    if (!result?.success) {
      setError(result?.error || 'Failed to resend OTP.')
      setLoading(false); return
    }
    setOtp('')
    startResendTimer()
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary to-[#162a6b] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/alta-white-text.png" alt="ALTA" className="h-10 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Admin Login</h1>
          <p className="text-white/50">Verify via WhatsApp OTP to access the admin panel</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">Phone Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-primary/5 border border-r-0 border-primary/20 rounded-l-lg text-primary/50 text-sm">+91</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Enter your mobile number"
                    maxLength={10}
                    className="flex-1 border border-primary/20 rounded-r-lg px-4 py-3 text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
                  />
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent" /> : <><Shield size={18} /> Send OTP</>}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-primary/60 text-sm">OTP sent to <strong className="text-primary">+{phone}</strong></p>
                {adminUser && (
                  <p className="text-dark-ambient text-sm mt-1">
                    Welcome, {adminUser.name}
                    <span className="ml-1.5 px-2 py-0.5 bg-ambient/15 text-dark-ambient rounded text-xs font-medium">
                      {adminUser.role}
                    </span>
                    {adminUser.campus && <span className="text-primary/40 ml-1">({adminUser.campus})</span>}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-2">Enter 6-digit OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full border border-primary/20 rounded-lg px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono text-primary placeholder-primary/20 focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading || otp.length !== 6}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent" /> : 'Verify & Login'}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setStep(1); setError(''); setOtp('') }}
                  className="text-primary/40 hover:text-primary transition-colors">Change number</button>
                <button type="button" onClick={handleResend} disabled={resendTimer > 0}
                  className={`font-medium ${resendTimer > 0 ? 'text-primary/30' : 'text-dark-ambient hover:underline'}`}>
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const ADMIN_SESSION_TTL = 15 * 24 * 60 * 60 * 1000 // 15 days

function AdminApp() {
  const [adminUser, setAdminUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [platforms, setPlatforms] = useState([])
  const [platform, setPlatform] = useState('')
  const [section, setSection] = useState('dashboard')
  const [loading, setLoading] = useState(true)

  // Restore admin session (with 15-day expiry)
  useEffect(() => {
    const saved = localStorage.getItem('alta_admin_session')
    if (saved) {
      try {
        const { id, expiresAt } = JSON.parse(saved)
        if (expiresAt && Date.now() > expiresAt) {
          localStorage.removeItem('alta_admin_session')
          setAuthLoading(false)
          return
        }
        if (id === 'master') {
          setAdminUser(MASTER_ADMIN)
          setAuthLoading(false)
        } else {
          getAdminById(id).then(admin => {
            if (admin) setAdminUser(admin)
            else localStorage.removeItem('alta_admin_session')
            setAuthLoading(false)
          })
        }
      } catch {
        localStorage.removeItem('alta_admin_session')
        setAuthLoading(false)
      }
    } else {
      setAuthLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!adminUser) return
    loadPlatforms().then(data => {
      const result = data.length > 0 ? data : DEFAULT_PLATFORMS
      setPlatforms(result)
      setPlatform(result[0].slug)
      setLoading(false)
    })
  }, [adminUser])

  const handleAdminLogin = (admin) => {
    setAdminUser(admin)
    localStorage.setItem('alta_admin_session', JSON.stringify({
      id: admin.id, role: admin.role,
      expiresAt: Date.now() + ADMIN_SESSION_TTL,
    }))
  }

  const handleAdminLogout = () => {
    setAdminUser(null)
    localStorage.removeItem('alta_admin_session')
  }

  const current = platforms.find(p => p.slug === platform)
  const platformName = current?.display_name || platform

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
      </div>
    )
  }

  if (!adminUser) {
    return <AdminLoginScreen onSuccess={handleAdminLogin} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
      </div>
    )
  }

  const sectionTitle = section === 'users'
    ? 'Manage Admin & Faculty Users'
    : section === 'practice'
    ? 'LeetCode Corner — Manage Problems'
    : section === 'data'
    ? 'Students & Data'
    : section === 'projects'
    ? 'Student Projects'
    : `${platformName} — Dashboard`

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
          {/* Platform Dashboards */}
          {platforms.map(p => (
            <button
              key={p.slug}
              onClick={() => { setPlatform(p.slug); setSection('dashboard') }}
              className={`w-full px-5 py-3 flex items-center gap-2.5 text-left transition-colors ${
                platform === p.slug && section === 'dashboard'
                  ? 'bg-ambient text-primary font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Eye size={16} /> {p.display_name}
            </button>
          ))}

          <div className="my-2 mx-5 border-t border-white/10" />

          {/* Students & Data */}
          <button
            onClick={() => setSection('data')}
            className={`w-full px-5 py-3 flex items-center gap-2.5 text-left transition-colors ${
              section === 'data' ? 'bg-ambient text-primary font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Database size={16} /> Students & Data
          </button>

          {/* LeetCode Corner */}
          <button
            onClick={() => setSection('practice')}
            className={`w-full px-5 py-3 flex items-center gap-2.5 text-left transition-colors ${
              section === 'practice' ? 'bg-ambient text-primary font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen size={16} /> LeetCode Corner
          </button>

          {/* Projects */}
          <button
            onClick={() => setSection('projects')}
            className={`w-full px-5 py-3 flex items-center gap-2.5 text-left transition-colors ${
              section === 'projects' ? 'bg-ambient text-primary font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <FolderGit2 size={16} /> Projects
          </button>

          {/* Manage Users — master + admin only */}
          {(adminUser.id === 'master' || adminUser.role === 'admin') && (
            <>
              <div className="my-2 mx-5 border-t border-white/10" />
              <button
                onClick={() => setSection('users')}
                className={`w-full px-5 py-3 flex items-center gap-2.5 text-left transition-colors ${
                  section === 'users' ? 'bg-ambient text-primary font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Users size={16} /> Manage Users
              </button>
            </>
          )}
        </nav>

        {/* Admin user info + logout */}
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
          <button onClick={handleAdminLogout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <LogOut size={12} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="bg-white border-b border-primary/10 px-8 py-4 sticky top-0 z-40">
          <h1 className="text-xl font-bold text-primary">{sectionTitle}</h1>
        </header>

        <div className="p-8 max-w-7xl">
          {section === 'users' ? (
            <UserManagement adminUser={adminUser} />
          ) : section === 'practice' ? (
            <PracticeAdmin />
          ) : section === 'data' ? (
            <AdminPanel platforms={platforms} adminUser={adminUser} />
          ) : section === 'projects' ? (
            <AdminProjects adminUser={adminUser} />
          ) : (
            <StudentView platform={platform} platformName={platformName} adminUser={adminUser} />
          )}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/portal" element={<StudentPortal />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/projects" element={<ProjectHub />} />
        <Route path="/:slug" element={<PublicProfile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
