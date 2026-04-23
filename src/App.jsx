import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { getAdminByPhone, getAdminById, sendOtp, verifyOtp } from './lib/db'
import { AuthProvider } from './context/AuthContext'

const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const Dashboard = lazy(() => import('./admin/pages/Dashboard'))
const Platforms = lazy(() => import('./admin/pages/coding/Platforms'))
const CodingStudents = lazy(() => import('./admin/pages/coding/Students'))
const Practice = lazy(() => import('./admin/pages/coding/Practice'))
const CodingProjects = lazy(() => import('./admin/pages/coding/Projects'))
const Amcat = lazy(() => import('./admin/pages/coding/Amcat'))
const LeetCodeProblems = lazy(() => import('./admin/pages/academics/LeetCodeProblems'))
const BOSPage = lazy(() => import('./admin/pages/academics/BOS'))
const Faculties = lazy(() => import('./admin/pages/academics/Faculties'))
const AttendancePage = lazy(() => import('./admin/pages/attendance/AttendancePage'))
const FeesPage = lazy(() => import('./admin/pages/fees/FeesPage'))
const UsersPage = lazy(() => import('./admin/pages/users/UsersPage'))
const Settings = lazy(() => import('./admin/pages/Settings'))

const HomePage = lazy(() => import('./components/HomePage'))
const StudentPortal = lazy(() => import('./components/StudentPortal'))
const PublicProfile = lazy(() => import('./components/PublicProfile'))
const PracticePage = lazy(() => import('./components/PracticePage'))
const ProjectHub = lazy(() => import('./components/ProjectHub'))

function PageSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
    </div>
  )
}

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

  return <AdminLayout adminUser={adminUser} onLogout={handleAdminLogout} />
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/portal" element={<StudentPortal />} />
          <Route path="/admin" element={<AdminApp />}>
            <Route index element={<Dashboard />} />
            <Route path="coding/platforms" element={<Platforms />} />
            <Route path="coding/students" element={<CodingStudents />} />
            <Route path="coding/practice" element={<Practice />} />
            <Route path="coding/projects" element={<CodingProjects />} />
            <Route path="coding/amcat" element={<Amcat />} />
            <Route path="academics/problems" element={<LeetCodeProblems />} />
            <Route path="academics/bos" element={<BOSPage />} />
            <Route path="academics/bos/:bosId" element={<BOSPage />} />
            <Route path="academics/faculties" element={<Faculties />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="fees" element={<FeesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/projects" element={<ProjectHub />} />
          <Route path="/:slug" element={<PublicProfile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
