'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Filter, Trophy, Target, Award, Zap, CalendarDays, TrendingUp,
  Star, GitFork, RefreshCw, X, User
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'
import ProfileModal from './ProfileModal'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const BUCKET_COLORS = ['#22ACD1', '#3BC3E2', '#0D1E56', '#6B7280', '#D1D5DB']
const LANG_COLORS: Record<string, string> = {
  HTML: '#E34C26', JavaScript: '#F7DF1E', Python: '#3572A5', TypeScript: '#3178C6',
  CSS: '#563D7C', Java: '#B07219', 'C++': '#F34B7D', C: '#555555',
  Go: '#00ADD8', Rust: '#DEA584', PHP: '#4F5D95', Other: '#94A3B8',
}
const CHART_TOOLTIP = { background: '#FFFFFF', border: '1px solid #3BC3E2', borderRadius: 8, color: '#0D1E56' }

interface Platform {
  slug: string
  display_name: string
}

// --- API fetch functions ---
async function fetchLeetCodeData(username: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ username }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.matchedUser ? json.data : null
  } catch { return null }
}

async function fetchCodeforcesData(username: string) {
  try {
    const userRes = await fetch(`https://codeforces.com/api/user.info?handles=${username}`)
    if (!userRes.ok) return null
    const userData = await userRes.json()
    if (userData.status !== 'OK') return null
    const ratingRes = await fetch(`https://codeforces.com/api/user.rating?handle=${username}`)
    let ratingHistory: any[] = []
    if (ratingRes.ok) { const d = await ratingRes.json(); if (d.status === 'OK') ratingHistory = d.result || [] }
    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${username}`)
    let submissions: any[] = []
    if (statusRes.ok) { const d = await statusRes.json(); if (d.status === 'OK') submissions = d.result || [] }
    return { user: userData.result[0], ratingHistory, submissions }
  } catch { return null }
}

async function fetchGitHubData(username: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ githubFull: username }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.user ? json : null
  } catch { return null }
}

function getFetcher(platform: string) {
  if (platform === 'leetcode') return fetchLeetCodeData
  if (platform === 'codeforces') return fetchCodeforcesData
  if (platform === 'github') return fetchGitHubData
  return null
}

// --- Activity computation ---
function startOfDayUTC(date: Date) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (86400 * 1000))
}

function computeRecentActivityFromApi(rawJson: any, platform: string) {
  const now = startOfDayUTC(new Date())
  const result = { yesterday: 0, last7: 0, last30: 0 }

  if (platform === 'leetcode') {
    const acList = rawJson?.recentAcSubmissionList || []
    const seen1 = new Set<string>()
    const seen7 = new Set<string>()
    const seen30 = new Set<string>()
    for (const sub of acList) {
      const ts = parseInt(sub.timestamp)
      const slug = sub.titleSlug
      if (!slug || !ts) continue
      const day = startOfDayUTC(new Date(ts * 1000))
      const diff = daysBetween(day, now)
      if (diff === 1 && !seen1.has(slug)) { seen1.add(slug); result.yesterday++ }
      if (diff >= 0 && diff < 7 && !seen7.has(slug)) { seen7.add(slug); result.last7++ }
      if (diff >= 0 && diff < 30 && !seen30.has(slug)) { seen30.add(slug); result.last30++ }
    }
  }

  if (platform === 'codeforces') {
    const subs = rawJson?.submissions || []
    const seen7 = new Set<string>()
    const seen30 = new Set<string>()
    const seenYesterday = new Set<string>()
    for (const sub of subs) {
      if (sub.verdict !== 'OK') continue
      const problem = sub.problem
      if (!problem?.contestId || !problem?.index) continue
      const key = `${problem.contestId}-${problem.index}`
      const day = startOfDayUTC(new Date(sub.creationTimeSeconds * 1000))
      const diff = daysBetween(day, now)
      if (diff === 1 && !seenYesterday.has(key)) { seenYesterday.add(key); result.yesterday++ }
      if (diff >= 0 && diff < 7 && !seen7.has(key)) { seen7.add(key); result.last7++ }
      if (diff >= 0 && diff < 30 && !seen30.has(key)) { seen30.add(key); result.last30++ }
    }
  }

  if (platform === 'github') {
    const contributions = rawJson?.contributions || {}
    for (const [dateStr, count] of Object.entries(contributions)) {
      if (!count) continue
      const day = startOfDayUTC(new Date(dateStr + 'T00:00:00'))
      const diff = daysBetween(day, now)
      if (diff === 1) result.yesterday += count as number
      if (diff >= 0 && diff < 7) result.last7 += count as number
      if (diff >= 0 && diff < 30) result.last30 += count as number
    }
  }

  return result
}

// Compute activity from daily_snapshots for a single student
function computeActivityFromSnapshots(
  snapshots: { snapshot_date: string; cumulative_total: number }[]
): { yesterday: number; last7: number; last30: number } | null {
  if (!snapshots || snapshots.length < 2) return null
  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  const latest = sorted[sorted.length - 1]
  const today = new Date().toISOString().slice(0, 10)
  const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)

  // Find the closest snapshot on or before target dates
  function findClosest(targetDate: string) {
    let best: typeof sorted[0] | null = null
    for (const s of sorted) {
      if (s.snapshot_date <= targetDate) best = s
    }
    return best
  }

  const yesterdaySnap = findClosest(yesterdayDate)
  const twoDaysAgoSnap = findClosest(twoDaysAgo)
  const sevenDaysAgoSnap = findClosest(sevenDaysAgo)
  const thirtyDaysAgoSnap = findClosest(thirtyDaysAgo)

  const yesterday = (yesterdaySnap && twoDaysAgoSnap)
    ? Math.max(0, yesterdaySnap.cumulative_total - twoDaysAgoSnap.cumulative_total)
    : 0
  const last7 = (latest && sevenDaysAgoSnap)
    ? Math.max(0, latest.cumulative_total - sevenDaysAgoSnap.cumulative_total)
    : 0
  const last30 = (latest && thirtyDaysAgoSnap)
    ? Math.max(0, latest.cumulative_total - thirtyDaysAgoSnap.cumulative_total)
    : 0

  return { yesterday, last7, last30 }
}

// Batch fetch daily_snapshots for all lead_ids in a platform
async function fetchDailySnapshots(platform: string): Promise<Map<string, { snapshot_date: string; cumulative_total: number }[]>> {
  const supabase = createClient()
  const thirtyDaysAgo = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('daily_snapshots')
    .select('lead_id, snapshot_date, cumulative_total')
    .eq('platform', platform)
    .gte('snapshot_date', thirtyDaysAgo)
    .order('snapshot_date')
  if (error || !data) return new Map()
  const map = new Map<string, { snapshot_date: string; cumulative_total: number }[]>()
  for (const row of data) {
    if (!map.has(row.lead_id)) map.set(row.lead_id, [])
    map.get(row.lead_id)!.push({ snapshot_date: row.snapshot_date, cumulative_total: row.cumulative_total })
  }
  return map
}

// --- Helpers ---
function avg(data: any[], key: string) {
  const vals = data.map(d => d[key]).filter((v: any) => typeof v === 'number')
  return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0
}

function makeBuckets(data: any[], key: string, ranges: { label: string; min: number; max: number }[]) {
  return ranges.map(r => ({
    name: r.label,
    Students: data.filter(d => (d[key] || 0) >= r.min && (d[key] || 0) < r.max).length,
  }))
}

// --- Components ---
function Spinner() {
  return (
    <div className="text-center py-16">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-ambient)', borderRightColor: 'transparent' }} />
    </div>
  )
}

function KPI({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl p-4 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="text-2xl font-bold" style={{ color: accent ? 'var(--color-dark-ambient)' : 'var(--color-primary)' }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h3 className="font-semibold text-lg mb-4" style={{ color: 'var(--color-primary)' }}>{title}</h3>
      {children}
    </div>
  )
}

function BucketBar({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="name" stroke="#0D1E56" fontSize={12} />
        <YAxis stroke="#0D1E56" />
        <Tooltip contentStyle={CHART_TOOLTIP} />
        <Bar dataKey="Students" fill="#0D1E56" label={{ position: 'top', fill: '#0D1E56', fontSize: 12 }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function BucketPie({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="Students"
          label={({ name, Students }: any) => Students > 0 ? `${name}: ${Students}` : ''}>
          {data.map((_: any, i: number) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

function Histogram({ values }: { values: number[] }) {
  if (!values.length) return null
  const max = Math.max(...values)
  const step = max <= 100 ? 20 : max <= 500 ? 50 : 100
  const buckets: Record<string, number> = {}
  const labels: string[] = []
  for (let i = 0; i <= max; i += step) {
    const label = `${i}-${i + step}`
    labels.push(label)
    buckets[label] = 0
  }
  values.forEach(v => {
    const idx = Math.min(Math.floor(v / step), labels.length - 1)
    buckets[labels[idx]]++
  })
  const chartData = labels.map(l => ({ range: l, count: buckets[l] }))
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="range" stroke="#0D1E56" fontSize={11} />
        <YAxis stroke="#0D1E56" />
        <Tooltip contentStyle={CHART_TOOLTIP} />
        <Bar dataKey="count" name="Students" fill="#3BC3E2" label={{ position: 'top', fill: '#0D1E56', fontSize: 12 }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function SortTh({ label, field, sortKey, sortDir, onSort, align = 'left' }: any) {
  const active = sortKey === field
  return (
    <th
      className={`py-2 font-medium cursor-pointer select-none transition-colors hover:text-[var(--color-primary)] ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: active ? 'var(--color-dark-ambient)' : undefined }}
      onClick={() => onSort(field)}
    >
      {label}
      {active && <span className="ml-1 text-xs">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
    </th>
  )
}

function useSortable(defaultKey = 'score', defaultDir = 'desc') {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [sortDir, setSortDir] = useState(defaultDir)
  const toggle = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(defaultDir) }
  }
  const sortFn = (data: any[]) => [...data].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })
  return { sortKey, sortDir, toggle, sortFn }
}

// --- Monthly Progression ---
function MonthlyProgression({ filterCollege, filterBatch, platform = 'leetcode' }: any) {
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profile_snapshots')
        .select('lead_id, platform, month, new_problems, cumulative_total, easy, medium, hard, students(student_name, college, batch)')
        .eq('platform', platform)
        .order('month')
      if (error) { setLoading(false); return }
      setSnapshots((data || []).map((row: any) => ({
        ...row,
        college: row.students?.college || '',
        batch: row.students?.batch || '',
        student_name: row.students?.student_name || '',
      })))
      setLoading(false)
    })()
  }, [platform])

  if (loading) return (
    <ChartCard title="Monthly Progression">
      <div className="text-center py-8">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-ambient)', borderRightColor: 'transparent' }} />
      </div>
    </ChartCard>
  )
  if (!snapshots.length) return null

  const filtered = snapshots.filter((s: any) => {
    if (filterCollege !== 'All' && s.college !== filterCollege) return false
    if (filterBatch !== 'All' && s.batch !== filterBatch) return false
    return true
  })

  const groups: Record<string, any> = {}
  for (const s of filtered) {
    const key = `${s.college}|${s.batch}`
    if (!groups[key]) groups[key] = { campus: s.college, batch: s.batch }
    groups[key][s.month] = (groups[key][s.month] || 0) + (s.new_problems || 0)
  }

  const months = [...new Set(filtered.map((s: any) => s.month))].sort()
  const MONTH_LABELS: Record<string, string> = {
    '2025-12': 'Dec 25', '2026-01': 'Jan 26', '2026-02': 'Feb 26', '2026-03': 'Mar 26',
    '2026-04': 'Apr 26', '2026-05': 'May 26', '2026-06': 'Jun 26',
  }
  const groupList = Object.values(groups).sort((a: any, b: any) =>
    a.campus !== b.campus ? a.campus.localeCompare(b.campus) : a.batch.localeCompare(b.batch)
  )
  const chartData = months.map(m => {
    const entry: any = { month: MONTH_LABELS[m] || m }
    for (const g of groupList) entry[`${g.campus} ${g.batch}`] = g[m] || 0
    return entry
  })
  const BAR_COLORS = ['#0D1E56', '#3BC3E2', '#22ACD1', '#6B7280', '#D1D5DB']

  return (
    <ChartCard title="Monthly Progression -- New Problems Solved (Campus x Batch)">
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="month" stroke="#0D1E56" fontSize={13} fontWeight={600} />
          <YAxis stroke="#0D1E56" />
          <Tooltip contentStyle={CHART_TOOLTIP} />
          <Legend />
          {groupList.map((g: any, i: number) => (
            <Bar key={`${g.campus} ${g.batch}`} dataKey={`${g.campus} ${g.batch}`}
              fill={BAR_COLORS[i % BAR_COLORS.length]}
              label={{ position: 'top', fill: '#0D1E56', fontSize: 11 }} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

// --- Activity Dashboard ---
function ActivityDashboard({ data, platform }: { data: any[]; platform: string }) {
  const activities = data.map((p: any) => p.activity || { yesterday: 0, last7: 0, last30: 0 })
  const totals = { yesterday: 0, last7: 0, last30: 0 }
  const active = { yesterday: 0, last7: 0, last30: 0 }
  for (const a of activities) {
    totals.yesterday += a.yesterday; totals.last7 += a.last7; totals.last30 += a.last30
    if (a.yesterday > 0) active.yesterday++
    if (a.last7 > 0) active.last7++
    if (a.last30 > 0) active.last30++
  }

  const sorted = [...data].filter((p: any) => (p.activity?.last30 || 0) > 0)
    .sort((a: any, b: any) => (b.activity?.last30 || 0) - (a.activity?.last30 || 0))
    .slice(0, 10)

  return (
    <ChartCard title="Recent Activity">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl p-4 border" style={{ background: 'rgba(59,195,226,0.05)', borderColor: 'rgba(59,195,226,0.2)' }}>
          <div className="flex items-center gap-2 text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            <Zap size={14} style={{ color: 'var(--color-dark-ambient)' }} /> Yesterday
          </div>
          <div className="text-3xl font-bold" style={{ color: 'var(--color-dark-ambient)' }}>{totals.yesterday}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{active.yesterday} active student{active.yesterday !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'rgba(13,30,86,0.03)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2 text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            <CalendarDays size={14} style={{ color: 'var(--color-primary)' }} /> Last 7 Days
          </div>
          <div className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>{totals.last7}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{active.last7} active student{active.last7 !== 1 ? 's' : ''}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: 'rgba(13,30,86,0.03)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2 text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            <TrendingUp size={14} style={{ color: 'var(--color-primary)' }} /> Last 30 Days
          </div>
          <div className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>{totals.last30}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{active.last30} active student{active.last30 !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {sorted.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>Most Active Students (30 days)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th className="py-2 text-left font-medium">Student</th>
                  <th className="py-2 text-right font-medium">Yesterday</th>
                  <th className="py-2 text-right font-medium">7 Days</th>
                  <th className="py-2 text-right font-medium">30 Days</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p: any) => (
                  <tr key={p.username} className="border-b hover:opacity-80 transition-colors" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
                    <td className="py-1.5">
                      <span className="font-medium" style={{ color: 'var(--color-primary)' }}>{p.student_name || p.username}</span>
                      {p.college && <span className="text-xs ml-2" style={{ color: 'var(--color-text-secondary)' }}>{p.college}</span>}
                    </td>
                    <td className="py-1.5 text-right font-semibold">{p.activity?.yesterday || 0}</td>
                    <td className="py-1.5 text-right font-semibold">{p.activity?.last7 || 0}</td>
                    <td className="py-1.5 text-right font-bold" style={{ color: 'var(--color-dark-ambient)' }}>{p.activity?.last30 || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ChartCard>
  )
}

// --- Profile Lookup ---
function ProfileLookup({ platform, platformName }: { platform: string; platformName: string }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<any[] | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<any>(null)

  const handleSearch = async (searchOverride?: string) => {
    const searchQuery = searchOverride || query
    if (!searchQuery.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    setSelectedProfile(null)
    const supabase = createClient()
    const [{ data: byUser }, { data: byName }] = await Promise.all([
      supabase.from('coding_profiles').select('*, students(student_name, college, batch, email, student_username)')
        .eq('platform', platform).ilike('username', `%${searchQuery.trim()}%`).order('score', { ascending: false }).limit(10),
      supabase.from('coding_profiles').select('*, students!inner(student_name, college, batch, email, student_username)')
        .eq('platform', platform).ilike('students.student_name', `%${searchQuery.trim()}%`).order('score', { ascending: false }).limit(10),
    ])
    const merged = new Map<string, any>()
    for (const row of [...(byUser || []), ...(byName || [])]) {
      if (!merged.has(row.lead_id)) {
        merged.set(row.lead_id, { ...row, student_name: row.students?.student_name || '', college: row.students?.college || '', batch: row.students?.batch || '', ...(row.stats || {}) })
      }
    }
    const matches = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 10)
    if (matches.length === 1 && matches[0].raw_json) setSelectedProfile(matches[0])
    else if (matches.length > 0) setResults(matches)
    else setError(`No profiles found for '${query.trim()}'.`)
    setLoading(false)
  }

  const openProfile = async (row: any) => {
    const supabase = createClient()
    const { data } = await supabase.from('coding_profiles').select('*, students(student_name, college, batch, email, student_username)')
      .eq('platform', platform).ilike('username', row.username).single()
    if (data?.raw_json) {
      setSelectedProfile({ ...data, student_name: data.students?.student_name || '', college: data.students?.college || '', batch: data.students?.batch || '', ...(data.stats || {}) })
      setResults(null)
    }
  }

  return (
    <div>
      <div className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={20} style={{ color: 'var(--color-text-secondary)' }} />
          <input type="text" placeholder="Search by username or student name..."
            value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }} />
        </div>
        <button onClick={() => handleSearch()} disabled={loading}
          className="px-6 py-3 rounded-xl font-medium text-sm text-white transition-colors disabled:opacity-50"
          style={{ background: 'var(--color-primary)' }}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && <div className="px-4 py-3 rounded-lg text-sm mb-4" style={{ background: 'rgba(239,68,68,0.05)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      {results && (
        <div className="rounded-xl border shadow-sm overflow-hidden mb-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="px-4 py-3 text-sm font-medium" style={{ background: 'rgba(13,30,86,0.03)', color: 'var(--color-primary)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </div>
          {results.map((r: any) => (
            <div key={r.lead_id} onClick={() => openProfile(r)}
              className="px-4 py-3 border-t cursor-pointer hover:bg-[var(--color-hover)] transition-colors flex items-center justify-between"
              style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
              <div>
                <span className="font-medium" style={{ color: 'var(--color-dark-ambient)' }}>{r.username}</span>
                <span className="text-sm ml-3" style={{ color: 'var(--color-text-secondary)' }}>{r.student_name}</span>
                {r.college && <span className="text-xs ml-2" style={{ color: 'var(--color-text-secondary)' }}>{r.college}</span>}
              </div>
              <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{r.score}</span>
            </div>
          ))}
        </div>
      )}

      {selectedProfile && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
              {selectedProfile.student_name || selectedProfile.username}
              <span className="text-sm font-normal ml-2" style={{ color: 'var(--color-text-secondary)' }}>{selectedProfile.college} {selectedProfile.batch}</span>
            </h3>
            <button onClick={() => { setSelectedProfile(null); setResults(null) }}
              className="p-2 rounded hover:bg-[var(--color-hover)]"><X size={18} /></button>
          </div>
          <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Score: <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{selectedProfile.score}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// --- LeetCode Batch Charts ---
function LCBatchCharts({ data, platform, platformName, filterCollege, filterBatch, onStudentClick }: any) {
  const { sortKey, sortDir, toggle, sortFn } = useSortable('score', 'desc')
  const buckets = makeBuckets(data, 'total_solved', [
    { label: '35+', min: 35, max: Infinity },
    { label: '20-34', min: 20, max: 35 },
    { label: '10-19', min: 10, max: 20 },
    { label: '5-9', min: 5, max: 10 },
    { label: '< 5', min: 0, max: 5 },
  ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPI label="Total Students" value={data.length} />
        <KPI label="Avg Solved" value={avg(data, 'total_solved').toFixed(1)} />
        <KPI label="Avg Rating" value={avg(data, 'contest_rating').toFixed(1)} />
        <KPI label="Avg Score" value={avg(data, 'score').toFixed(1)} />
        <KPI label="Avg Contests" value={avg(data, 'contests_attended').toFixed(1)} />
      </div>

      <MonthlyProgression filterCollege={filterCollege} filterBatch={filterBatch} />
      <ActivityDashboard data={data} platform="leetcode" />

      <ChartCard title="Students by Problems Solved">
        <div className="grid md:grid-cols-2 gap-6">
          <BucketBar data={buckets} />
          <BucketPie data={buckets} />
        </div>
      </ChartCard>

      <ChartCard title="Difficulty Breakdown per Student">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KPI label="Avg Easy" value={avg(data, 'easy').toFixed(1)} accent />
          <KPI label="Avg Medium" value={avg(data, 'medium').toFixed(1)} accent />
          <KPI label="Avg Hard" value={avg(data, 'hard').toFixed(1)} accent />
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data.map((p: any) => ({ name: p.username, Easy: p.easy, Medium: p.medium, Hard: p.hard }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="name" stroke="#0D1E56" fontSize={11} angle={-45} textAnchor="end" height={80} />
            <YAxis stroke="#0D1E56" />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Legend />
            <Bar dataKey="Easy" stackId="a" fill="#3BC3E2" />
            <Bar dataKey="Medium" stackId="a" fill="#0D1E56" />
            <Bar dataKey="Hard" stackId="a" fill="#22ACD1" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Score Distribution">
        <Histogram values={data.map((p: any) => p.score)} />
      </ChartCard>

      <ChartCard title="All Students">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <SortTh label="Name" field="student_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Username" field="username" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="College" field="college" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Easy" field="easy" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Med" field="medium" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Hard" field="hard" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Total" field="total_solved" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Rating" field="contest_rating" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Score" field="score" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortFn(data).map((p: any, i: number) => (
                <tr key={p.username} className={`border-b hover:opacity-80 cursor-pointer transition-colors ${i < 3 ? 'bg-[rgba(59,195,226,0.05)]' : ''}`}
                  style={{ borderColor: 'rgba(13,30,86,0.05)' }}
                  onClick={() => onStudentClick?.(p.username)}>
                  <td className="py-1.5 font-medium" style={{ color: 'var(--color-dark-ambient)' }}>{p.student_name || p.username}</td>
                  <td className="py-1.5" style={{ color: 'var(--color-dark-ambient)' }}>{p.username}</td>
                  <td className="py-1.5">{p.college}</td>
                  <td className="py-1.5 text-right">{p.easy}</td>
                  <td className="py-1.5 text-right">{p.medium}</td>
                  <td className="py-1.5 text-right">{p.hard}</td>
                  <td className="py-1.5 text-right font-semibold">{p.total_solved}</td>
                  <td className="py-1.5 text-right">{p.contest_rating}</td>
                  <td className="py-1.5 text-right font-bold" style={{ color: 'var(--color-primary)' }}>{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}

// --- Codeforces Batch Charts ---
function CFBatchCharts({ data, platform, platformName, filterCollege, filterBatch, onStudentClick }: any) {
  const { sortKey, sortDir, toggle, sortFn } = useSortable('score', 'desc')

  const rankOrder = ['legendary grandmaster', 'international grandmaster', 'grandmaster', 'international master', 'master', 'candidate master', 'expert', 'specialist', 'pupil', 'newbie', 'unrated']
  const rankData = rankOrder
    .map(r => ({ name: r.replace(/\b\w/g, c => c.toUpperCase()), Students: data.filter((p: any) => (p.rank || '').toLowerCase() === r).length }))
    .filter(r => r.Students > 0)

  const buckets = makeBuckets(data, 'problems_solved', [
    { label: '50+', min: 50, max: Infinity },
    { label: '30-49', min: 30, max: 50 },
    { label: '15-29', min: 15, max: 30 },
    { label: '5-14', min: 5, max: 15 },
    { label: '< 5', min: 0, max: 5 },
  ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <KPI label="Students" value={data.length} />
        <KPI label="Avg Problems" value={avg(data, 'problems_solved').toFixed(1)} />
        <KPI label="Avg Rating" value={avg(data, 'rating').toFixed(1)} />
        <KPI label="Avg Max Rating" value={avg(data, 'max_rating').toFixed(1)} />
        <KPI label="Avg Score" value={avg(data, 'score').toFixed(1)} />
        <KPI label="Avg Contests" value={avg(data, 'contests_attended').toFixed(1)} />
      </div>

      <MonthlyProgression filterCollege={filterCollege} filterBatch={filterBatch} platform="codeforces" />
      <ActivityDashboard data={data} platform="codeforces" />

      {rankData.length > 0 && (
        <ChartCard title="Students by Rank">
          <div className="grid md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={rankData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#0D1E56" fontSize={11} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#0D1E56" />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Bar dataKey="Students" fill="#0D1E56" label={{ position: 'top', fill: '#0D1E56', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={rankData} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="Students"
                  label={({ name, Students }: any) => Students > 0 ? `${name}: ${Students}` : ''}>
                  {rankData.map((_: any, i: number) => <Cell key={i} fill={i % 2 === 0 ? '#0D1E56' : '#3BC3E2'} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      <ChartCard title="Students by Problems Solved">
        <div className="grid md:grid-cols-2 gap-6">
          <BucketBar data={buckets} />
          <BucketPie data={buckets} />
        </div>
      </ChartCard>

      <ChartCard title="Score Distribution">
        <Histogram values={data.map((p: any) => p.score)} />
      </ChartCard>

      <ChartCard title="All Students">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <SortTh label="Name" field="student_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Username" field="username" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="College" field="college" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Rating" field="rating" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Max" field="max_rating" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Rank" field="rank" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Problems" field="problems_solved" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Score" field="score" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortFn(data).map((p: any, i: number) => (
                <tr key={p.username} className={`border-b hover:opacity-80 cursor-pointer transition-colors ${i < 3 ? 'bg-[rgba(59,195,226,0.05)]' : ''}`}
                  style={{ borderColor: 'rgba(13,30,86,0.05)' }}
                  onClick={() => onStudentClick?.(p.username)}>
                  <td className="py-1.5 font-medium" style={{ color: 'var(--color-dark-ambient)' }}>{p.student_name || p.username}</td>
                  <td className="py-1.5" style={{ color: 'var(--color-dark-ambient)' }}>{p.username}</td>
                  <td className="py-1.5">{p.college}</td>
                  <td className="py-1.5 text-right">{p.rating}</td>
                  <td className="py-1.5 text-right">{p.max_rating}</td>
                  <td className="py-1.5" style={{ color: 'var(--color-dark-ambient)' }}>{(p.rank || '').replace(/\b\w/g, (c: string) => c.toUpperCase())}</td>
                  <td className="py-1.5 text-right">{p.problems_solved}</td>
                  <td className="py-1.5 text-right font-bold" style={{ color: 'var(--color-primary)' }}>{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}

// --- Helper: extract repo languages from raw_json ---
function extractRepoLangs(rawJson: any): Record<string, number> {
  const repos = rawJson?.repos || []
  const langs: Record<string, number> = {}
  repos.forEach((r: any) => { if (r.language) langs[r.language] = (langs[r.language] || 0) + 1 })
  return langs
}

function getLangColor(lang: string): string {
  return LANG_COLORS[lang] || LANG_COLORS['Other']
}

// --- GitHub Batch Charts ---
function GHBatchCharts({ data, platform, platformName, onStudentClick }: any) {
  const { sortKey, sortDir, toggle, sortFn } = useSortable('total_commits', 'desc')

  // Compute per-student repo languages from raw_json
  const studentLangs = data.map((p: any) => ({
    ...p,
    repoLangs: extractRepoLangs(p.raw_json),
  }))

  // Existing language totals from stats
  const langTotals: Record<string, number> = {}
  for (const p of data) {
    for (const l of (p.languages || [])) {
      langTotals[l.name] = (langTotals[l.name] || 0) + l.count
    }
  }
  const topLangs = Object.entries(langTotals).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, Repos]) => ({ name, Repos }))

  // --- Tech Stack: Overall language distribution from raw_json repos ---
  const globalLangCounts: Record<string, number> = {}
  for (const s of studentLangs) {
    for (const [lang, count] of Object.entries(s.repoLangs)) {
      globalLangCounts[lang] = (globalLangCounts[lang] || 0) + (count as number)
    }
  }
  const sortedGlobalLangs = Object.entries(globalLangCounts).sort((a, b) => b[1] - a[1])
  const totalReposWithLang = sortedGlobalLangs.reduce((sum, [, c]) => sum + c, 0)
  const pieData = sortedGlobalLangs.slice(0, 8).map(([name, value]) => ({
    name, value, pct: totalReposWithLang > 0 ? ((value / totalReposWithLang) * 100).toFixed(1) : '0',
  }))
  const otherCount = sortedGlobalLangs.slice(8).reduce((sum, [, c]) => sum + c, 0)
  if (otherCount > 0) pieData.push({ name: 'Other', value: otherCount, pct: ((otherCount / totalReposWithLang) * 100).toFixed(1) })

  // --- Tech Stack: Campus x Batch stacked bar ---
  const TOP_LANG_COUNT = 6
  const topLangNames = sortedGlobalLangs.slice(0, TOP_LANG_COUNT).map(([name]) => name)
  const campusBatchGroups: Record<string, Record<string, number>> = {}
  for (const s of studentLangs) {
    const key = `${s.college || 'Unknown'} ${s.batch || 'Unknown'}`
    if (!campusBatchGroups[key]) campusBatchGroups[key] = {}
    for (const [lang, count] of Object.entries(s.repoLangs)) {
      const bucket = topLangNames.includes(lang) ? lang : 'Other'
      campusBatchGroups[key][bucket] = (campusBatchGroups[key][bucket] || 0) + (count as number)
    }
  }
  const stackedBarData = Object.entries(campusBatchGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, langs]) => ({ name, ...langs }))
  const stackedLangKeys = [...topLangNames]
  if (Object.values(campusBatchGroups).some(g => g['Other'])) stackedLangKeys.push('Other')

  const buckets = makeBuckets(data, 'total_contributions_year', [
    { label: '500+', min: 500, max: Infinity },
    { label: '200-499', min: 200, max: 500 },
    { label: '100-199', min: 100, max: 200 },
    { label: '50-99', min: 50, max: 100 },
    { label: '< 50', min: 0, max: 50 },
  ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPI label="Students" value={data.length} />
        <KPI label="Avg Repos" value={avg(data, 'own_repos').toFixed(1)} />
        <KPI label="Avg Commits" value={avg(data, 'total_commits').toFixed(1)} accent />
        <KPI label="Avg Contributions (Year)" value={avg(data, 'total_contributions_year').toFixed(0)} accent />
        <KPI label="Avg Streak" value={avg(data, 'longest_streak').toFixed(1)} />
      </div>

      <ChartCard title="Students by Contributions (Past Year)">
        <div className="grid md:grid-cols-2 gap-6">
          <BucketBar data={buckets} />
          <BucketPie data={buckets} />
        </div>
      </ChartCard>

      {/* Tech Stack: Campus x Batch Overview */}
      {stackedBarData.length > 0 && (
        <ChartCard title="Tech Stack — Campus × Batch Overview">
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Language distribution across repos per campus and batch (top {TOP_LANG_COUNT} languages, rest grouped as Other)
          </p>
          <ResponsiveContainer width="100%" height={Math.max(300, stackedBarData.length * 50)}>
            <BarChart data={stackedBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" stroke="#0D1E56" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#0D1E56" fontSize={12} width={160} />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Legend />
              {stackedLangKeys.map(lang => (
                <Bar key={lang} dataKey={lang} stackId="techstack" fill={getLangColor(lang)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Tech Stack: Overall Language Distribution */}
      {pieData.length > 0 && (
        <ChartCard title="Overall Language Distribution">
          <div className="grid md:grid-cols-2 gap-6 items-center">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={120} innerRadius={60} dataKey="value"
                  label={({ name, pct }: any) => `${name} ${pct}%`} labelLine>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={getLangColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(value: number, name: string) => [`${value} repos`, name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {pieData.map(entry => (
                <div key={entry.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getLangColor(entry.name) }} />
                  <span className="text-sm font-medium flex-1" style={{ color: 'var(--color-primary)' }}>{entry.name}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{entry.value} repos</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(13,30,86,0.05)', color: 'var(--color-primary)' }}>{entry.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      )}

      {topLangs.length > 0 && (
        <ChartCard title="Most Used Languages (All Students)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topLangs} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" stroke="#0D1E56" />
              <YAxis dataKey="name" type="category" stroke="#0D1E56" fontSize={12} width={120} />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Bar dataKey="Repos" fill="#3BC3E2" label={{ position: 'right', fill: '#0D1E56', fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      <ChartCard title="All Students">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <SortTh label="Name" field="student_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Username" field="username" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="College" field="college" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <th className="py-2 text-left font-medium" style={{ color: 'var(--color-text-secondary)' }}>Languages</th>
                <SortTh label="Repos" field="own_repos" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Commits" field="total_commits" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="PRs" field="total_prs" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Stars" field="total_stars" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Followers" field="followers" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Year" field="total_contributions_year" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortFn(studentLangs).map((p: any, i: number) => {
                const langEntries = Object.entries(p.repoLangs as Record<string, number>).sort((a, b) => b[1] - a[1])
                return (
                  <tr key={p.username} className={`border-b hover:opacity-80 cursor-pointer transition-colors ${i < 3 ? 'bg-[rgba(59,195,226,0.05)]' : ''}`}
                    style={{ borderColor: 'rgba(13,30,86,0.05)' }}
                    onClick={() => onStudentClick?.(p.username)}>
                    <td className="py-1.5 font-medium" style={{ color: 'var(--color-dark-ambient)' }}>{p.student_name || p.username}</td>
                    <td className="py-1.5" style={{ color: 'var(--color-dark-ambient)' }}>{p.username}</td>
                    <td className="py-1.5">{p.college}</td>
                    <td className="py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {langEntries.slice(0, 5).map(([lang, count]) => (
                          <span key={lang} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: getLangColor(lang) + '20', color: getLangColor(lang), border: `1px solid ${getLangColor(lang)}40` }}>
                            {lang}
                          </span>
                        ))}
                        {langEntries.length > 5 && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{ background: 'rgba(13,30,86,0.05)', color: 'var(--color-text-secondary)' }}>
                            +{langEntries.length - 5}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 text-right">{p.own_repos || 0}</td>
                    <td className="py-1.5 text-right font-semibold">{p.total_commits || 0}</td>
                    <td className="py-1.5 text-right">{p.total_prs || 0}</td>
                    <td className="py-1.5 text-right">{p.total_stars || 0}</td>
                    <td className="py-1.5 text-right">{p.followers || 0}</td>
                    <td className="py-1.5 text-right font-bold" style={{ color: 'var(--color-primary)' }}>{p.total_contributions_year || 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}

// --- Batch Dashboard ---
function BatchDashboard({ platform, platformName, onStudentClick }: { platform: string; platformName: string; onStudentClick?: (username: string) => void }) {
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCollege, setFilterCollege] = useState('All')
  const [filterBatch, setFilterBatch] = useState('All')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const supabase = createClient()
      const [{ data, error }, snapshotsMap] = await Promise.all([
        supabase
          .from('coding_profiles')
          .select('lead_id, platform, username, score, stats, raw_json, fetched_at, students(student_name, college, batch, email, student_username)')
          .eq('platform', platform)
          .order('score', { ascending: false }),
        fetchDailySnapshots(platform),
      ])
      if (error) { setLoading(false); return }

      const result = (data || []).map((row: any) => {
        // Prefer daily_snapshots for activity; fall back to API data
        const snaps = snapshotsMap.get(row.lead_id)
        const snapshotActivity = snaps ? computeActivityFromSnapshots(snaps) : null
        const activity = snapshotActivity || computeRecentActivityFromApi(row.raw_json, platform)
        return {
          lead_id: row.lead_id, platform: row.platform, username: row.username, score: row.score,
          fetched_at: row.fetched_at, student_name: row.students?.student_name || '',
          college: row.students?.college || '', batch: row.students?.batch || '',
          ...(row.stats || {}),
          raw_json: row.raw_json,
          activity,
        }
      })
      setProfiles(result)
      setLoading(false)
    })()
  }, [platform])

  if (loading) return <Spinner />
  if (!profiles.length) {
    return (
      <div className="px-6 py-4 rounded-lg text-center" style={{ background: 'rgba(59,195,226,0.1)', border: '1px solid rgba(59,195,226,0.3)', color: 'var(--color-primary)' }}>
        No profiles available yet. Ask your admin to upload data.
      </div>
    )
  }

  const colleges = ['All', ...new Set(profiles.map(p => p.college).filter(Boolean))]
  const batches = ['All', ...new Set(profiles.map(p => p.batch).filter(Boolean))]
  const filtered = profiles.filter(p => {
    if (filterCollege !== 'All' && p.college !== filterCollege) return false
    if (filterBatch !== 'All' && p.batch !== filterBatch) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4 flex-wrap rounded-xl p-4" style={{ background: 'rgba(13,30,86,0.03)' }}>
        <Filter size={20} style={{ color: 'var(--color-text-secondary)' }} className="mb-2" />
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>College</label>
          <select value={filterCollege} onChange={e => setFilterCollege(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
            {colleges.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Batch</label>
          <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
            {batches.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <span className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>{filtered.length} of {profiles.length} students</span>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', color: '#92400E' }}>
          No profiles match the selected filters.
        </div>
      ) : platform === 'leetcode' ? (
        <LCBatchCharts data={filtered} platform={platform} platformName={platformName} filterCollege={filterCollege} filterBatch={filterBatch} onStudentClick={onStudentClick} />
      ) : platform === 'github' ? (
        <GHBatchCharts data={filtered} platform={platform} platformName={platformName} onStudentClick={onStudentClick} />
      ) : (
        <CFBatchCharts data={filtered} platform={platform} platformName={platformName} filterCollege={filterCollege} filterBatch={filterBatch} onStudentClick={onStudentClick} />
      )}
    </div>
  )
}

// --- Main Component ---
export default function PlatformsClient({ platforms }: { platforms: Platform[] }) {
  const [platform, setPlatform] = useState(platforms[0]?.slug || '')
  const [tab, setTab] = useState<'dashboard' | 'lookup'>('dashboard')
  const [selectedProfile, setSelectedProfile] = useState<any>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const current = platforms.find(p => p.slug === platform)

  const openStudentModal = async (username: string) => {
    setModalLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('coding_profiles')
      .select('*, students(student_name, college, batch, email, student_username)')
      .eq('platform', platform).ilike('username', username).single()
    setModalLoading(false)
    if (data?.raw_json) {
      setSelectedProfile({
        ...data,
        student_name: data.students?.student_name || '',
        college: data.students?.college || '',
        batch: data.students?.batch || '',
        ...(data.stats || {}),
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Profile Modal */}
      {selectedProfile && (
        <ProfileModal
          profile={selectedProfile}
          platform={platform}
          onClose={() => setSelectedProfile(null)}
        />
      )}

      {/* Modal loading overlay */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-xl p-8 shadow-xl flex flex-col items-center gap-3" style={{ background: 'var(--color-surface)' }}>
            <div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-ambient)', borderRightColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading profile...</p>
          </div>
        </div>
      )}

      {/* Platform selector */}
      <div className="flex gap-2 flex-wrap">
        {platforms.map(p => (
          <button key={p.slug} onClick={() => setPlatform(p.slug)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: platform === p.slug ? 'var(--color-primary)' : 'var(--color-surface)',
              color: platform === p.slug ? 'var(--color-white)' : 'var(--color-text-secondary)',
              border: platform === p.slug ? 'none' : '1px solid var(--color-border)',
            }}>
            {p.display_name}
          </button>
        ))}
      </div>

      {/* Tab selector */}
      <div className="flex gap-2">
        <button onClick={() => setTab('dashboard')}
          className="px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          style={{
            background: tab === 'dashboard' ? 'var(--color-primary)' : 'rgba(13,30,86,0.03)',
            color: tab === 'dashboard' ? 'var(--color-white)' : 'var(--color-text-secondary)',
            border: tab === 'dashboard' ? 'none' : '1px solid var(--color-border)',
          }}>
          Batch Dashboard
        </button>
        <button onClick={() => setTab('lookup')}
          className="px-4 py-2 rounded-lg font-medium transition-colors text-sm"
          style={{
            background: tab === 'lookup' ? 'var(--color-primary)' : 'rgba(13,30,86,0.03)',
            color: tab === 'lookup' ? 'var(--color-white)' : 'var(--color-text-secondary)',
            border: tab === 'lookup' ? 'none' : '1px solid var(--color-border)',
          }}>
          Profile Lookup
        </button>
      </div>

      {tab === 'dashboard' && <BatchDashboard platform={platform} platformName={current?.display_name || platform} onStudentClick={openStudentModal} />}
      {tab === 'lookup' && <ProfileLookup platform={platform} platformName={current?.display_name || platform} />}
    </div>
  )
}
