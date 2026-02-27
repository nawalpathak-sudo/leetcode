import { useState, useEffect, useRef } from 'react'
import { LogOut, Edit3, Save, X, ExternalLink, Trophy, Target, Users, TrendingUp, Award, ChevronRight, ChevronLeft, Link2, Check, Copy, GitBranch, Star, GitFork, Code2, Calendar, FolderGit2, Mail, Phone, Shield, ArrowRight, GitCommitHorizontal, Flame, GitPullRequest } from 'lucide-react'
import { getStudent, getStudentProfiles, loadAllProfiles, saveStudentUsername, deleteStudentProfile, generateProfileSlug, saveProfile, getStudentByEmail, getStudentByPhone, updateStudentPhone, updateStudentEmail, sendOtp, verifyOtp } from '../lib/db'
import { cleanPlatformUsername, fetchGitHubData, fetchGitHubContributions } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { StudentProjectDashboard } from './ProjectHub'
import { ActivityStrip } from './StudentView'
import { computeRecentActivity } from '../lib/activity'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
} from 'recharts'
import SubmissionHeatmap from './SubmissionHeatmap'

export const PLATFORMS = [
  { slug: 'leetcode', name: 'LeetCode', color: '#FFA116', urlTemplate: 'https://leetcode.com/u/{u}' },
  { slug: 'codeforces', name: 'Codeforces', color: '#1F8ACB', urlTemplate: 'https://codeforces.com/profile/{u}' },
  { slug: 'hackerrank', name: 'HackerRank', color: '#2EC866', urlTemplate: 'https://hackerrank.com/profile/{u}' },
  { slug: 'codechef', name: 'CodeChef', color: '#5B4638', urlTemplate: 'https://codechef.com/users/{u}' },
  { slug: 'github', name: 'GitHub', color: '#333333', urlTemplate: 'https://github.com/{u}' },
]

export const SCORED_PLATFORMS = ['leetcode', 'codeforces']

export default function StudentPortal() {
  const { student: authStudent, loading: authLoading, login, logout } = useAuth()
  const [screen, setScreen] = useState('auth')
  const [student, setStudent] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [benchmarks, setBenchmarks] = useState({})
  const [profilesLoading, setProfilesLoading] = useState(false)

  useEffect(() => {
    if (authStudent && screen === 'auth') {
      setStudent(authStudent)
      setScreen('dashboard')
      loadDashboardData(authStudent.lead_id, authStudent, null)
    }
  }, [authStudent])

  // Loads profiles + benchmarks progressively — dashboard is already visible
  const loadDashboardData = async (leadId, studentData, prefetchPromise) => {
    setProfilesLoading(true)

    let profs, leaderboards
    // Use prefetched data if available (fetched while user typed OTP)
    const prefetched = prefetchPromise ? await prefetchPromise : null
    if (prefetched) {
      ;[profs, ...leaderboards] = prefetched
    } else {
      // No prefetch — load fresh
      ;[profs, ...leaderboards] = await Promise.all([
        getStudentProfiles(leadId),
        ...SCORED_PLATFORMS.map(plat => loadAllProfiles(plat)),
      ])
    }

    setProfiles(profs)
    setProfilesLoading(false)

    const s = studentData || student
    const bm = {}
    SCORED_PLATFORMS.forEach((plat, i) => {
      const all = leaderboards[i]
      const myProfile = all.find(p => p.lead_id === leadId)
      if (myProfile && all.length > 0) {
        const sameCollege = all.filter(p => p.college && p.college === s.college)
        const sameBatch = all.filter(p => p.batch && p.batch === s.batch)
        bm[plat] = {
          myScore: myProfile.score || 0,
          myStats: myProfile,
          overall: { avg: avg(all, 'score'), rank: all.filter(p => p.score > myProfile.score).length + 1, total: all.length },
          college: sameCollege.length > 1
            ? { avg: avg(sameCollege, 'score'), rank: sameCollege.filter(p => p.score > myProfile.score).length + 1, total: sameCollege.length, name: s.college }
            : null,
          batch: sameBatch.length > 1
            ? { avg: avg(sameBatch, 'score'), rank: sameBatch.filter(p => p.score > myProfile.score).length + 1, total: sameBatch.length, name: s.batch }
            : null,
        }
      }
    })
    setBenchmarks(bm)

    // Phase 3: GitHub contributions — fire and forget
    const ghProf = profs.find(p => p.platform === 'github')
    if (ghProf?.username && ghProf.raw_json && !ghProf.raw_json.contributions) {
      fetchGitHubContributions(ghProf.username).then(contributions => {
        if (contributions) {
          ghProf.raw_json = { ...ghProf.raw_json, contributions }
          saveProfile(leadId, 'github', ghProf.username, ghProf.raw_json)
          setProfiles(prev => prev.map(p => p.platform === 'github' ? { ...p, raw_json: ghProf.raw_json } : p))
        }
      })
    }
  }

  const handleAuthSuccess = (studentData, prefetched) => {
    login(studentData)
    setStudent(studentData)
    setScreen('dashboard')
    // Load data progressively — dashboard shows immediately
    loadDashboardData(studentData.lead_id, studentData, prefetched)
  }

  const handleLogout = () => {
    logout()
    setStudent(null)
    setProfiles([])
    setBenchmarks({})
    setScreen('auth')
  }

  const handleSaveEdit = async () => {
    const s = await getStudent(student.lead_id)
    if (s) setStudent(s)
    setScreen('dashboard')
    loadDashboardData(student.lead_id, s || student)
  }

  if (authLoading) return <FullSpinner />
  if (screen === 'auth' && !authStudent) return <AuthScreen onSuccess={handleAuthSuccess} />
  if (screen === 'edit') return <EditScreen student={student} profiles={profiles} onSave={handleSaveEdit} onCancel={() => setScreen('dashboard')} />
  if (screen === 'projects') return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-6 sm:h-7" />
            <span className="text-white/30">|</span>
            <span className="text-white font-medium text-sm sm:text-base">ProjectHub</span>
          </div>
          <button onClick={handleLogout}
            className="p-2 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors">
            <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <StudentProjectDashboard leadId={student.lead_id} studentName={student.student_name} onBack={() => setScreen('dashboard')} />
      </div>
    </div>
  )

  return <DashboardScreen student={student} profiles={profiles} benchmarks={benchmarks} profilesLoading={profilesLoading} onEdit={() => setScreen('edit')} onProjects={() => setScreen('projects')} onLogout={handleLogout} />
}

// ============================================================
// AUTH (Login / Signup with WhatsApp OTP)
// ============================================================

function formatPhone(raw) {
  let cleaned = raw.replace(/\D/g, '')
  if (cleaned.length === 10) cleaned = '91' + cleaned
  return cleaned
}

function AuthScreen({ onSuccess }) {
  const [mode, setMode] = useState('login')
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [email, setEmail] = useState('')
  const [leadId, setLeadId] = useState('')
  const [signupMethod, setSignupMethod] = useState('email') // 'email' or 'leadid'
  const [foundStudent, setFoundStudent] = useState(null)
  const studentPromiseRef = useRef(null)
  const prefetchedDataRef = useRef(null)
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

  const switchMode = (newMode) => {
    setMode(newMode)
    setStep(1)
    setError('')
    setOtp('')
    setPhone('')
    setEmail('')
    setLeadId('')
    setSignupMethod('email')
    setFoundStudent(null)
  }

  // ---- Signup handlers ----
  const handleEmailCheck = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError('')
    const student = await getStudentByEmail(email.trim().toLowerCase())
    if (!student) {
      setError('No student found with this email. Please check and try again.')
      setLoading(false); return
    }
    if (student.phone) {
      setError('This account already has a phone number linked. Please use Login instead.')
      setLoading(false); return
    }
    setFoundStudent(student)
    setStep(2)
    setLoading(false)
  }

  const handleLeadIdCheck = async (e) => {
    e.preventDefault()
    if (!leadId.trim()) return
    setLoading(true); setError('')
    const student = await getStudent(leadId.trim())
    if (!student) {
      setError('No student found with this Lead ID. Please check and try again.')
      setLoading(false); return
    }
    if (student.phone) {
      setError('This account already has a phone number linked. Please use Login instead.')
      setLoading(false); return
    }
    setFoundStudent(student)
    setStep(2)
    setLoading(false)
  }

  const handleSignupSendOtp = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true); setError('')
    const formatted = formatPhone(phone)
    if (formatted.length !== 12) {
      setError('Please enter a valid 10-digit mobile number.')
      setLoading(false); return
    }
    // Check if phone already linked to someone else
    const existing = await getStudentByPhone(formatted)
    if (existing && existing.lead_id !== foundStudent.lead_id) {
      setError('This phone number is already linked to another account.')
      setLoading(false); return
    }
    const result = await sendOtp(formatted)
    if (!result?.success) {
      setError(result?.error || 'Failed to send OTP. Please try again.')
      setLoading(false); return
    }
    setPhone(formatted)
    setStep(3)
    startResendTimer()
    setLoading(false)
  }

  const handleSignupVerify = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) return
    setLoading(true); setError('')
    try {
      const result = await verifyOtp(phone, otp)
      if (!result?.success) {
        setError(result?.error || 'Invalid or expired OTP. Please try again.')
        setLoading(false); return
      }
      await updateStudentPhone(foundStudent.lead_id, phone)
      if (signupMethod === 'leadid' && !foundStudent.email && email.trim()) {
        await updateStudentEmail(foundStudent.lead_id, email.trim().toLowerCase())
      }
      const updated = await getStudent(foundStudent.lead_id)
      onSuccess(updated)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ---- Login handlers ----
  const handleLoginSendOtp = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return
    setLoading(true); setError('')
    const formatted = formatPhone(phone)
    if (formatted.length !== 12) {
      setError('Please enter a valid 10-digit mobile number.')
      setLoading(false); return
    }
    // Fire student lookup and OTP in parallel
    studentPromiseRef.current = getStudentByPhone(formatted)
    const result = await sendOtp(formatted)
    if (!result?.success) {
      setError(result?.error || 'Failed to send OTP. Please try again.')
      setLoading(false); return
    }
    // OTP sent — show entry screen instantly
    setPhone(formatted)
    setStep(2)
    startResendTimer()
    setLoading(false)
    // Resolve student lookup in background
    const student = await studentPromiseRef.current
    if (!student) {
      setStep(1)
      setError('No account found with this number. Please sign up first.')
      return
    }
    setFoundStudent(student)
    // Pre-fetch profile data while user types OTP (10-20s of idle time)
    prefetchedDataRef.current = Promise.all([
      getStudentProfiles(student.lead_id),
      ...SCORED_PLATFORMS.map(plat => loadAllProfiles(plat)),
    ]).catch(() => null)
  }

  const handleLoginVerify = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) return
    setLoading(true); setError('')
    try {
      // Fire verify + resolve student in parallel
      const [result, resolvedStudent] = await Promise.all([
        verifyOtp(phone, otp),
        foundStudent ? Promise.resolve(foundStudent) : (studentPromiseRef.current || Promise.resolve(null)),
      ])
      if (!result?.success) {
        setError(result?.error || 'Invalid or expired OTP. Please try again.')
        setLoading(false); return
      }
      if (!resolvedStudent) {
        setError('No account found with this number. Please sign up first.')
        setStep(1); setLoading(false); return
      }
      // Don't wait for prefetch — pass the promise, dashboard will handle it
      onSuccess(resolvedStudent, prefetchedDataRef.current)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
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

  const Spinner = () => <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent" />

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary to-[#162a6b] flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <img src="/alta-white-text.png" alt="ALTA" className="h-8 sm:h-10 mx-auto mb-3 sm:mb-4" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Student Portal</h1>
          <p className="text-white/50 text-sm sm:text-base">Verify via WhatsApp to access your profile</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-8">
          {/* Tab switcher */}
          <div className="flex mb-6 bg-primary/5 rounded-xl p-1">
            <button onClick={() => switchMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'login' ? 'bg-primary text-white' : 'text-primary/50 hover:text-primary'
              }`}>Login</button>
            <button onClick={() => switchMode('signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'signup' ? 'bg-primary text-white' : 'text-primary/50 hover:text-primary'
              }`}>Sign Up</button>
          </div>

          {/* ---- SIGNUP FLOW ---- */}
          {mode === 'signup' && step === 1 && (
            <div className="space-y-4">
              <div className="flex bg-primary/5 rounded-lg p-0.5 text-xs">
                <button type="button" onClick={() => { setSignupMethod('email'); setError('') }}
                  className={`flex-1 py-2 rounded-md font-semibold transition-colors ${signupMethod === 'email' ? 'bg-ambient text-white' : 'text-primary/50 hover:text-primary'}`}>
                  Email
                </button>
                <button type="button" onClick={() => { setSignupMethod('leadid'); setError('') }}
                  className={`flex-1 py-2 rounded-md font-semibold transition-colors ${signupMethod === 'leadid' ? 'bg-ambient text-white' : 'text-primary/50 hover:text-primary'}`}>
                  Lead ID
                </button>
              </div>

              {signupMethod === 'email' ? (
                <form onSubmit={handleEmailCheck} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                      <Mail size={14} /> Enter your registered email
                    </label>
                    <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                      placeholder="your.email@example.com" autoFocus
                      className="w-full px-4 py-3 border-2 border-primary/15 rounded-xl text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-2 focus:ring-ambient/20 text-lg" />
                  </div>
                  <button type="submit" disabled={loading || !email.trim()}
                    className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2">
                    {loading ? <Spinner /> : <>Continue <ArrowRight size={18} /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLeadIdCheck} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                      <Shield size={14} /> Enter your Lead ID
                    </label>
                    <input type="text" value={leadId} onChange={e => { setLeadId(e.target.value); setError('') }}
                      placeholder="e.g. ALTA-12345" autoFocus
                      className="w-full px-4 py-3 border-2 border-primary/15 rounded-xl text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-2 focus:ring-ambient/20 text-lg" />
                  </div>
                  <button type="submit" disabled={loading || !leadId.trim()}
                    className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2">
                    {loading ? <Spinner /> : <>Continue <ArrowRight size={18} /></>}
                  </button>
                </form>
              )}
            </div>
          )}

          {mode === 'signup' && step === 2 && (
            <div className="space-y-4">
              <button onClick={() => setStep(1)} className="text-sm text-primary/50 hover:text-primary flex items-center gap-1 transition-colors">
                <ChevronLeft size={16} /> Back
              </button>
              <div className="bg-ambient/10 border border-ambient/20 rounded-xl p-5 text-center">
                <p className="text-sm text-primary/60 mb-1">Is this you?</p>
                <p className="text-xl font-bold text-primary">{foundStudent.student_name}</p>
                {foundStudent.college && <p className="text-sm text-primary/50 mt-1">{foundStudent.college}</p>}
              </div>
              <form onSubmit={handleSignupSendOtp} className="space-y-4">
                {signupMethod === 'leadid' && !foundStudent.email && (
                  <div>
                    <label className="block text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                      <Mail size={14} /> Enter your email
                    </label>
                    <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                      placeholder="your.email@example.com"
                      className="w-full px-4 py-3 border-2 border-primary/15 rounded-xl text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-2 focus:ring-ambient/20 text-lg" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                    <Phone size={14} /> Enter your WhatsApp number
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-primary/40 font-medium text-lg">+91</span>
                    <input type="tel" value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }}
                      placeholder="9876543210" autoFocus maxLength={10}
                      className="flex-1 px-4 py-3 border-2 border-primary/15 rounded-xl text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-2 focus:ring-ambient/20 text-lg tracking-wider" />
                  </div>
                  <p className="text-xs text-primary/40 mt-1.5">Must be a WhatsApp-enabled number. OTP will be sent via WhatsApp.</p>
                </div>
                <button type="submit" disabled={loading || phone.replace(/\D/g, '').length !== 10 || (signupMethod === 'leadid' && !foundStudent.email && !email.trim())}
                  className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2">
                  {loading ? <Spinner /> : <>Send OTP <ArrowRight size={18} /></>}
                </button>
              </form>
            </div>
          )}

          {mode === 'signup' && step === 3 && (
            <div className="space-y-4">
              <button onClick={() => { setStep(2); setOtp('') }} className="text-sm text-primary/50 hover:text-primary flex items-center gap-1 transition-colors">
                <ChevronLeft size={16} /> Back
              </button>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-ambient/10 rounded-full mb-3">
                  <Shield size={24} className="text-dark-ambient" />
                </div>
                <p className="text-sm text-primary/60">OTP sent to WhatsApp</p>
                <p className="text-lg font-bold text-primary">+{phone}</p>
              </div>
              <form onSubmit={handleSignupVerify} className="space-y-4">
                <input type="text" value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                  placeholder="Enter 6-digit OTP" autoFocus maxLength={6}
                  className="w-full px-4 py-3 border-2 border-primary/15 rounded-xl text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-2 focus:ring-ambient/20 text-2xl text-center tracking-[0.5em] font-mono" />
                <button type="submit" disabled={loading || otp.length !== 6}
                  className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2">
                  {loading ? <Spinner /> : <>Verify & Sign Up <Check size={18} /></>}
                </button>
                <p className="text-center text-sm text-primary/40">
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : (
                    <button type="button" onClick={handleResend} className="text-ambient hover:text-dark-ambient font-medium transition-colors">Resend OTP</button>
                  )}
                </p>
              </form>
            </div>
          )}

          {/* ---- LOGIN FLOW ---- */}
          {mode === 'login' && step === 1 && (
            <form onSubmit={handleLoginSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-2 flex items-center gap-1.5">
                  <Phone size={14} /> Enter your WhatsApp number
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-primary/40 font-medium text-lg">+91</span>
                  <input type="tel" value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }}
                    placeholder="9876543210" autoFocus maxLength={10}
                    className="flex-1 px-4 py-3 border-2 border-primary/15 rounded-xl text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-2 focus:ring-ambient/20 text-lg tracking-wider" />
                </div>
                <p className="text-xs text-primary/40 mt-1.5">Must be a WhatsApp-enabled number. OTP will be sent via WhatsApp.</p>
              </div>
              <button type="submit" disabled={loading || phone.replace(/\D/g, '').length !== 10}
                className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2">
                {loading ? <Spinner /> : <>Send OTP <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {mode === 'login' && step === 2 && (
            <div className="space-y-4">
              <button onClick={() => { setStep(1); setOtp('') }} className="text-sm text-primary/50 hover:text-primary flex items-center gap-1 transition-colors">
                <ChevronLeft size={16} /> Back
              </button>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-ambient/10 rounded-full mb-3">
                  <Shield size={24} className="text-dark-ambient" />
                </div>
                <p className="text-sm text-primary/60">OTP sent to WhatsApp</p>
                <p className="text-lg font-bold text-primary">+{phone}</p>
              </div>
              <form onSubmit={handleLoginVerify} className="space-y-4">
                <input type="text" value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                  placeholder="Enter 6-digit OTP" autoFocus maxLength={6}
                  className="w-full px-4 py-3 border-2 border-primary/15 rounded-xl text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-2 focus:ring-ambient/20 text-2xl text-center tracking-[0.5em] font-mono" />
                <button type="submit" disabled={loading || otp.length !== 6}
                  className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-xl font-semibold text-lg transition-colors flex items-center justify-center gap-2">
                  {loading ? <Spinner /> : <>Verify & Login <Check size={18} /></>}
                </button>
                <p className="text-center text-sm text-primary/40">
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : (
                    <button type="button" onClick={handleResend} className="text-ambient hover:text-dark-ambient font-medium transition-colors">Resend OTP</button>
                  )}
                </p>
              </form>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}
        </div>

        <p className="text-center text-white/30 text-sm mt-6">ALTA School of Technology</p>
      </div>
    </div>
  )
}

// ============================================================
// DASHBOARD
// ============================================================

function SectionSkeleton({ lines = 3 }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-8 animate-pulse">
      <div className="h-5 bg-primary/10 rounded w-1/3 mb-4" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 bg-primary/5 rounded mb-3" style={{ width: `${80 - i * 15}%` }} />
      ))}
    </div>
  )
}

function DashboardScreen({ student, profiles, benchmarks, profilesLoading, onEdit, onProjects, onLogout }) {
  const profileMap = {}
  for (const p of profiles) profileMap[p.platform] = p
  const [copied, setCopied] = useState(false)

  const profileSlug = generateProfileSlug(student)
  const shareUrl = `${window.location.origin}/${profileSlug}`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-primary sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-6 sm:h-7" />
            <span className="text-white/30 hidden sm:inline">|</span>
            <span className="text-white font-medium hidden sm:inline">Student Portal</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button onClick={onProjects}
              className="p-2 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors">
              <FolderGit2 size={14} /> <span className="hidden sm:inline">My Projects</span>
            </button>
            <button onClick={onEdit}
              className="p-2 sm:px-4 sm:py-2 bg-ambient hover:bg-dark-ambient text-primary rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors">
              <Edit3 size={14} /> <span className="hidden sm:inline">Edit Profile</span>
            </button>
            <button onClick={onLogout}
              className="p-2 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors">
              <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Student Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-8">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-3xl font-bold text-primary truncate">{student.student_name || student.lead_id}</h2>
              <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 sm:mt-3 text-xs sm:text-sm text-primary/60">
                {student.college && <span className="flex items-center gap-1.5 bg-primary/5 px-2 sm:px-3 py-1 rounded-full">{student.college}</span>}
                {student.batch && <span className="flex items-center gap-1.5 bg-ambient/10 text-dark-ambient px-2 sm:px-3 py-1 rounded-full">{student.batch}</span>}
                {student.email && <span className="text-primary/40 truncate">{student.email}</span>}
              </div>
            </div>
            <span className="text-primary/20 text-xs sm:text-sm font-mono shrink-0">{student.lead_id}</span>
          </div>

          {/* Shareable Link */}
          <div className="mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-primary/10">
            <div className="flex items-center gap-2 text-sm text-primary/50 mb-2">
              <Link2 size={14} /> Shareable Profile Link
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-primary/5 rounded-lg px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-primary font-mono truncate">
                {shareUrl}
              </div>
              <button onClick={handleCopy}
                className={`shrink-0 px-3 sm:px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-1.5 transition-all ${
                  copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-ambient hover:bg-dark-ambient text-primary'
                }`}>
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
          </div>
        </div>

        {/* Platform Scores — skeleton while benchmarks loading */}
        {profilesLoading ? (
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-6">
            <SectionSkeleton lines={2} />
            <SectionSkeleton lines={2} />
          </div>
        ) : SCORED_PLATFORMS.some(p => benchmarks[p]) ? (
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-6">
            {SCORED_PLATFORMS.map(plat => {
              const bm = benchmarks[plat]
              if (!bm) return null
              const platInfo = PLATFORMS.find(p => p.slug === plat)
              return <ScoreCard key={plat} platform={platInfo} benchmark={bm} />
            })}
          </div>
        ) : null}

        {/* Recent Activity */}
        {SCORED_PLATFORMS.map(plat => {
          const prof = profileMap[plat]
          if (!prof?.raw_json) return null
          const activity = computeRecentActivity(prof.raw_json, plat)
          if (!activity.last30) return null
          const platInfo = PLATFORMS.find(p => p.slug === plat)
          return (
            <div key={`act-${plat}`}>
              <h3 className="text-sm font-semibold text-primary/50 mb-2 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: platInfo.color }} />
                {platInfo.name} — Recent Activity
              </h3>
              <ActivityStrip activity={activity} label={plat === 'codeforces' ? 'Problems Solved' : 'Submissions'} />
            </div>
          )
        })}

        {/* Benchmark Charts */}
        {SCORED_PLATFORMS.map(plat => {
          const bm = benchmarks[plat]
          if (!bm) return null
          const platInfo = PLATFORMS.find(p => p.slug === plat)
          return <BenchmarkChart key={plat} platform={platInfo} benchmark={bm} />
        })}

        {/* Detailed Stats */}
        {profilesLoading ? (
          <SectionSkeleton lines={4} />
        ) : SCORED_PLATFORMS.map(plat => {
          const bm = benchmarks[plat]
          if (!bm?.myStats) return null
          const platInfo = PLATFORMS.find(p => p.slug === plat)
          return <DetailedStats key={plat} platform={platInfo} stats={bm.myStats} />
        })}

        {/* Submission Heatmaps */}
        {SCORED_PLATFORMS.map(plat => {
          const prof = profileMap[plat]
          if (!prof?.raw_json) return null
          const platInfo = PLATFORMS.find(p => p.slug === plat)
          return <SubmissionHeatmap key={`hm-${plat}`} rawJson={prof.raw_json} platform={plat} color={platInfo.color} platformName={platInfo.name} />
        })}

        {/* GitHub Contribution Heatmap */}
        {profileMap.github?.raw_json?.contributions && (
          <SubmissionHeatmap rawJson={profileMap.github.raw_json} platform="github" color="#333333" platformName="GitHub" />
        )}

        {/* GitHub Analytics */}
        {profileMap.github?.stats && (
          <GitHubStats stats={profileMap.github.stats} username={profileMap.github.username} />
        )}

        {/* All Platform Links */}
        {profilesLoading ? (
          <SectionSkeleton lines={3} />
        ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-8">
          <h3 className="text-base sm:text-lg font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2">
            <ExternalLink size={20} /> Platform Profiles
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {PLATFORMS.map(plat => {
              const prof = profileMap[plat.slug]
              const hasUsername = prof?.username
              return (
                <div key={plat.slug} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                  hasUsername ? 'border-primary/10 bg-white' : 'border-dashed border-primary/10 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plat.color }} />
                    <div>
                      <div className="font-medium text-primary text-sm">{plat.name}</div>
                      {hasUsername ? (
                        <div className="text-dark-ambient text-sm">@{prof.username}</div>
                      ) : (
                        <div className="text-primary/30 text-sm">Not linked</div>
                      )}
                    </div>
                  </div>
                  {hasUsername && (
                    <a href={plat.urlTemplate.replace('{u}', prof.username)} target="_blank" rel="noopener noreferrer"
                      className="text-ambient hover:text-dark-ambient transition-colors">
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={onEdit}
            className="mt-4 text-sm text-ambient hover:text-dark-ambient font-medium flex items-center gap-1 transition-colors">
            <Edit3 size={14} /> Manage platform profiles
          </button>
        </div>
        )}

        {/* No data message */}
        {!profilesLoading && !SCORED_PLATFORMS.some(p => benchmarks[p]) && profiles.length === 0 && (
          <div className="bg-ambient/10 border border-ambient/30 text-primary px-6 py-4 rounded-xl text-center">
            <p className="font-medium mb-1">No coding profiles linked yet</p>
            <p className="text-sm">Click "Edit Profile" to add your platform usernames. Your admin will fetch your data.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Score Card ----

export function ScoreCard({ platform, benchmark }) {
  const { myScore, overall } = benchmark
  const pct = overall.total > 1 ? Math.round(((overall.total - overall.rank) / (overall.total - 1)) * 100) : 100

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-3 sm:mb-4">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: platform.color }} />
        <h3 className="font-bold text-primary text-base sm:text-lg">{platform.name}</h3>
      </div>

      <div className="flex items-end justify-between mb-4 sm:mb-6">
        <div>
          <div className="text-3xl sm:text-4xl font-bold text-primary">{myScore}</div>
          <div className="text-primary/40 text-xs sm:text-sm">/ 1000 score</div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-dark-ambient font-bold text-base sm:text-lg">
            <Trophy size={18} /> #{overall.rank}
          </div>
          <div className="text-primary/40 text-xs sm:text-sm">of {overall.total} students</div>
        </div>
      </div>

      {/* Percentile bar */}
      <div>
        <div className="flex justify-between text-xs text-primary/50 mb-1">
          <span>Percentile</span>
          <span className="font-semibold text-dark-ambient">Top {100 - pct > 0 ? 100 - pct : 1}%</span>
        </div>
        <div className="w-full bg-primary/10 rounded-full h-2.5">
          <div className="bg-gradient-to-r from-ambient to-dark-ambient h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ---- Benchmark Chart ----

export function BenchmarkChart({ platform, benchmark }) {
  const { myScore, overall, college, batch } = benchmark

  const chartData = [
    { name: 'You', score: myScore },
    { name: 'Overall Avg', score: Math.round(overall.avg * 10) / 10 },
  ]
  if (batch) chartData.push({ name: `${batch.name} Avg`, score: Math.round(batch.avg * 10) / 10 })
  if (college) chartData.push({ name: `${college.name} Avg`, score: Math.round(college.avg * 10) / 10 })

  const colors = [platform.color, '#0D1E56', '#3BC3E2', '#22ACD1']

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-6">
      <h3 className="font-bold text-primary mb-1 flex items-center gap-2 text-sm sm:text-base">
        <TrendingUp size={18} /> {platform.name} — You vs Averages
      </h3>
      <p className="text-primary/40 text-xs sm:text-sm mb-4">Compare your score against different groups</p>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="name" stroke="#0D1E56" fontSize={11} tick={{ fontSize: 10 }} />
            <YAxis stroke="#0D1E56" domain={[0, 'auto']} width={35} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #3BC3E2', borderRadius: 8, color: '#0D1E56' }} />
            <Bar dataKey="score" label={{ position: 'top', fill: '#0D1E56', fontSize: 11, fontWeight: 600 }}>
              {chartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="space-y-2 sm:space-y-3 flex flex-col justify-center">
          <RankBadge label="Overall Rank" rank={overall.rank} total={overall.total} />
          {batch && <RankBadge label={`${batch.name} Rank`} rank={batch.rank} total={batch.total} accent />}
          {college && <RankBadge label={`${college.name} Rank`} rank={college.rank} total={college.total} />}
        </div>
      </div>
    </div>
  )
}

export function RankBadge({ label, rank, total, accent }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${
      accent ? 'bg-ambient/10 border border-ambient/20' : 'bg-primary/5 border border-primary/10'
    }`}>
      <span className="text-sm text-primary/60 font-medium">{label}</span>
      <span className={`font-bold ${accent ? 'text-dark-ambient' : 'text-primary'}`}>
        #{rank} <span className="text-primary/30 font-normal text-sm">/ {total}</span>
      </span>
    </div>
  )
}

// ---- Detailed Stats ----

export function DetailedStats({ platform, stats }) {
  const isLC = platform.slug === 'leetcode'

  const items = isLC ? [
    { label: 'Easy', value: stats.easy || 0, color: '#3BC3E2' },
    { label: 'Medium', value: stats.medium || 0, color: '#FFA116' },
    { label: 'Hard', value: stats.hard || 0, color: '#EF4444' },
    { label: 'Total Solved', value: stats.total_solved || 0, bold: true },
    { label: 'Contest Rating', value: stats.contest_rating || 0 },
    { label: 'Contests', value: stats.contests_attended || 0 },
  ] : [
    { label: 'Rating', value: stats.rating || 0, bold: true },
    { label: 'Max Rating', value: stats.max_rating || 0 },
    { label: 'Rank', value: (stats.rank || 'unrated').replace(/\b\w/g, c => c.toUpperCase()) },
    { label: 'Problems Solved', value: stats.problems_solved || 0 },
    { label: 'Contests', value: stats.contests_attended || 0 },
    { label: 'Avg Problem Rating', value: stats.avg_problem_rating || 0 },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-6">
      <h3 className="font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
        <Award size={18} /> {platform.name} Stats
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {items.map(item => (
          <div key={item.label} className="bg-gray-50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="text-[10px] sm:text-xs text-primary/50 font-medium">{item.label}</div>
            <div className={`text-lg sm:text-xl ${item.bold ? 'font-bold text-primary' : 'font-semibold text-primary/80'}`}>
              {item.color && <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: item.color }} />}
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- GitHub Analytics ----

export function GitHubStats({ stats, username }) {
  if (!stats) return null

  const langColors = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
    'C++': '#f34b7d', C: '#555555', Go: '#00ADD8', Rust: '#dea584', Ruby: '#701516',
    PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
    HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Lua: '#000080',
  }

  const topLangs = (stats.languages || []).slice(0, 8)
  const totalLangRepos = topLangs.reduce((s, l) => s + l.count, 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded-full bg-[#333]" />
        <h3 className="font-bold text-primary text-lg">GitHub Analytics</h3>
        {username && (
          <a href={`https://github.com/${username}`} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-ambient hover:text-dark-ambient transition-colors">
            <ExternalLink size={16} />
          </a>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {[
          { icon: <GitCommitHorizontal size={16} />, label: 'Commits', value: stats.total_commits || stats.recent_commits || 0, color: 'text-green-600' },
          { icon: <Code2 size={16} />, label: 'Repos', value: stats.own_repos, color: 'text-primary' },
          { icon: <Star size={16} />, label: 'Stars', value: stats.total_stars, color: 'text-amber-500' },
          { icon: <Users size={16} />, label: 'Followers', value: stats.followers, color: 'text-purple-500' },
        ].map(item => (
          <div key={item.label} className="bg-gray-50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-center">
            <div className={`flex items-center justify-center gap-1.5 ${item.color} mb-1`}>
              {item.icon}
              <span className="text-[10px] sm:text-xs font-medium text-primary/50">{item.label}</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-primary">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Secondary stats: PRs, Forks, Streaks */}
      {(stats.total_prs > 0 || stats.total_forks > 0 || stats.current_streak > 0 || stats.longest_streak > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {stats.total_prs > 0 && (
            <div className="bg-gray-50 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-purple-500 mb-1">
                <GitPullRequest size={16} />
                <span className="text-xs font-medium text-primary/50">Pull Requests</span>
              </div>
              <div className="text-lg font-bold text-primary">{stats.total_prs}</div>
            </div>
          )}
          {stats.total_forks > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-blue-500 mb-1">
                <GitFork size={16} />
                <span className="text-xs font-medium text-primary/50">Forks</span>
              </div>
              <div className="text-lg font-bold text-primary">{stats.total_forks}</div>
            </div>
          )}
          {stats.current_streak > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-orange-500 mb-1">
                <Flame size={16} />
                <span className="text-xs font-medium text-primary/50">Current Streak</span>
              </div>
              <div className="text-lg font-bold text-orange-600">{stats.current_streak}d</div>
            </div>
          )}
          {stats.longest_streak > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-amber-500 mb-1">
                <Trophy size={16} />
                <span className="text-xs font-medium text-primary/50">Max Streak</span>
              </div>
              <div className="text-lg font-bold text-primary">{stats.longest_streak}d</div>
            </div>
          )}
        </div>
      )}

      {/* Contributions summary */}
      {stats.total_contributions_year > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Calendar size={18} className="text-green-600 shrink-0" />
          <div>
            <div className="text-sm font-medium text-green-800">
              {stats.total_contributions_year} contribution{stats.total_contributions_year !== 1 ? 's' : ''} in the past year
            </div>
            <div className="text-xs text-green-600/70">Commits, PRs, issues, and reviews</div>
          </div>
        </div>
      )}

      {/* Languages */}
      {topLangs.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-primary mb-3">Languages</div>
          {/* Bar */}
          <div className="h-3 rounded-full overflow-hidden flex mb-3">
            {topLangs.map(l => (
              <div key={l.name} className="h-full transition-all"
                style={{ width: `${(l.count / totalLangRepos) * 100}%`, backgroundColor: langColors[l.name] || '#8b8b8b' }}
                title={`${l.name}: ${l.count} repos`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {topLangs.map(l => (
              <div key={l.name} className="flex items-center gap-1.5 text-xs text-primary/60">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: langColors[l.name] || '#8b8b8b' }} />
                {l.name} <span className="text-primary/30">({l.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top repos */}
      {stats.top_repos?.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-primary mb-3">Top Repositories</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {stats.top_repos.map(r => (
              <a key={r.name} href={`https://github.com/${username}/${r.name}`}
                target="_blank" rel="noopener noreferrer"
                className="bg-gray-50 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors group border border-transparent hover:border-primary/10">
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch size={14} className="text-primary/40 group-hover:text-ambient transition-colors" />
                  <span className="text-sm font-semibold text-primary truncate group-hover:text-ambient transition-colors">{r.name}</span>
                </div>
                {r.description && (
                  <p className="text-xs text-primary/40 mb-2 line-clamp-2">{r.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-primary/40">
                  {r.language && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: langColors[r.language] || '#8b8b8b' }} />
                      {r.language}
                    </span>
                  )}
                  {r.stars > 0 && <span className="flex items-center gap-0.5"><Star size={10} /> {r.stars}</span>}
                  {r.forks > 0 && <span className="flex items-center gap-0.5"><GitFork size={10} /> {r.forks}</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// EDIT PROFILE
// ============================================================

function EditScreen({ student, profiles, onSave, onCancel }) {
  const profileMap = {}
  for (const p of profiles) profileMap[p.platform] = p

  const [fields, setFields] = useState(() => {
    const f = {}
    for (const plat of PLATFORMS) {
      f[plat.slug] = profileMap[plat.slug]?.username || ''
    }
    return f
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)

  const handleChange = (slug, value) => {
    setFields(f => ({ ...f, [slug]: value }))
    setSaveResult(null)
    // Validate on change
    if (value.trim()) {
      const { error } = cleanPlatformUsername(slug, value)
      setErrors(e => ({ ...e, [slug]: error }))
    } else {
      setErrors(e => ({ ...e, [slug]: null }))
    }
  }

  const handleSave = async () => {
    // Validate all
    const newErrors = {}
    for (const plat of PLATFORMS) {
      if (fields[plat.slug].trim()) {
        const { error } = cleanPlatformUsername(plat.slug, fields[plat.slug])
        if (error) newErrors[plat.slug] = error
      }
    }
    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors)
      return
    }

    setSaving(true)
    let saved = 0
    let removed = 0

    for (const plat of PLATFORMS) {
      const raw = fields[plat.slug].trim()
      const existing = profileMap[plat.slug]?.username

      if (raw) {
        const { username } = cleanPlatformUsername(plat.slug, raw)
        if (username && username !== existing) {
          const ok = await saveStudentUsername(student.lead_id, plat.slug, username)
          if (ok) {
            saved++
            // Auto-fetch GitHub data immediately
            if (plat.slug === 'github') {
              const ghData = await fetchGitHubData(username)
              if (ghData) await saveProfile(student.lead_id, 'github', username, ghData)
            }
          }
        }
      } else if (existing) {
        await deleteStudentProfile(student.lead_id, plat.slug)
        removed++
      }
    }

    setSaving(false)
    setSaveResult(`Updated ${saved} profile(s)${removed ? `, removed ${removed}` : ''}.`)
    setTimeout(() => onSave(), 800)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary sticky top-0 z-50 shadow-lg">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-6 sm:h-7" />
            <span className="text-white/30">|</span>
            <span className="text-white font-medium text-sm sm:text-base">Edit Profile</span>
          </div>
          <button onClick={onCancel}
            className="p-2 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium text-sm flex items-center gap-1.5 transition-colors">
            <X size={14} /> <span className="hidden sm:inline">Cancel</span>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-8 space-y-5 sm:space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-primary">Platform Profiles</h2>
            <p className="text-primary/50 text-xs sm:text-sm mt-1">
              Enter your username or paste a full profile URL. We'll extract the username automatically.
            </p>
          </div>

          <div className="space-y-5">
            {PLATFORMS.map(plat => (
              <div key={plat.slug}>
                <label className="flex items-center gap-2 text-sm font-semibold text-primary mb-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: plat.color }} />
                  {plat.name}
                </label>
                <input
                  type="text"
                  value={fields[plat.slug]}
                  onChange={e => handleChange(plat.slug, e.target.value)}
                  placeholder={`Username or ${plat.urlTemplate.replace('{u}', 'username')}`}
                  className={`w-full px-4 py-3 border-2 rounded-xl text-primary placeholder-primary/25 focus:outline-none transition-colors ${
                    errors[plat.slug]
                      ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                      : 'border-primary/10 focus:border-ambient focus:ring-2 focus:ring-ambient/20'
                  }`}
                />
                {errors[plat.slug] && (
                  <p className="mt-1 text-red-500 text-sm">{errors[plat.slug]}</p>
                )}
                {fields[plat.slug].trim() && !errors[plat.slug] && (
                  <p className="mt-1 text-green-600 text-sm">
                    Username: {cleanPlatformUsername(plat.slug, fields[plat.slug]).username || fields[plat.slug]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {saveResult && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">{saveResult}</div>
          )}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-8 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors">
              {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={onCancel}
              className="px-6 py-3 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl font-medium transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SHARED
// ============================================================

export function FullSpinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
        <p className="text-primary/50 text-sm">Loading your profile...</p>
      </div>
    </div>
  )
}

export function avg(arr, key) {
  if (!arr.length) return 0
  return arr.reduce((sum, p) => sum + (p[key] || 0), 0) / arr.length
}
