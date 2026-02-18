import { useState, useEffect } from 'react'
import { Search, User, MapPin, Trophy, Target, Award, Clock, Code, Star, Filter, X, Zap, CalendarDays, TrendingUp } from 'lucide-react'
import { loadAllProfiles, loadProfile, searchProfiles } from '../lib/db'
import { calculateLeetCodeScore, calculateCodeforcesScore } from '../lib/scoring'
import { computeRecentActivity, aggregateActivity, activeStudentCounts } from '../lib/activity'
import SubmissionHeatmap from './SubmissionHeatmap'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts'

const BUCKET_COLORS = ['#22ACD1', '#3BC3E2', '#0D1E56', '#6B7280', '#D1D5DB']
const CHART_TOOLTIP = { background: '#FFFFFF', border: '1px solid #3BC3E2', borderRadius: 8, color: '#0D1E56' }

export default function StudentView({ platform, platformName, adminUser }) {
  const [tab, setTab] = useState('dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Student Dashboard</h2>
        <p className="text-primary/60 mt-1">View batch analytics or look up individual profiles.</p>
      </div>

      <div className="flex gap-2">
        <TabBtn active={tab === 'dashboard'} onClick={() => setTab('dashboard')} label="Batch Dashboard" />
        <TabBtn active={tab === 'lookup'} onClick={() => setTab('lookup')} label="Profile Lookup" />
      </div>

      {tab === 'dashboard' && <BatchDashboard platform={platform} platformName={platformName} adminUser={adminUser} />}
      {tab === 'lookup' && <ProfileLookup platform={platform} platformName={platformName} adminUser={adminUser} />}
    </div>
  )
}

function TabBtn({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'bg-primary/5 text-primary/60 hover:bg-primary/10 border border-primary/10'
      }`}
    >
      {label}
    </button>
  )
}

// ============================================================
// BATCH DASHBOARD
// ============================================================

function BatchDashboard({ platform, platformName, adminUser }) {
  const isFaculty = adminUser?.role === 'faculty'
  const facultyCampus = adminUser?.campus
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCollege, setFilterCollege] = useState(isFaculty && facultyCampus ? facultyCampus : 'All')
  const [filterBatch, setFilterBatch] = useState('All')

  useEffect(() => {
    (async () => {
      setLoading(true)
      const data = await loadAllProfiles(platform, { includeRaw: true })
      // Compute activity for each student
      const withActivity = data.map(p => ({
        ...p,
        activity: computeRecentActivity(p.raw_json, platform),
      }))
      // Faculty can only see their campus
      if (isFaculty && facultyCampus) {
        setProfiles(withActivity.filter(p => p.college === facultyCampus))
      } else {
        setProfiles(withActivity)
      }
      setLoading(false)
    })()
  }, [platform])

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
      </div>
    )
  }

  if (!profiles.length) {
    return (
      <div className="bg-ambient/10 border border-ambient/30 text-primary px-6 py-4 rounded-lg text-center">
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
      {/* Filters */}
      <div className="flex items-end gap-4 flex-wrap bg-primary/5 rounded-xl p-4">
        <Filter size={20} className="text-primary/40 mb-2" />
        <div>
          <label className="block text-xs text-primary/50 font-medium mb-1">College</label>
          <select value={filterCollege} onChange={e => setFilterCollege(e.target.value)}
            disabled={isFaculty && facultyCampus}
            className={`bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-ambient ${isFaculty && facultyCampus ? 'opacity-60 cursor-not-allowed' : ''}`}>
            {colleges.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-primary/50 font-medium mb-1">Batch</label>
          <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
            className="bg-white border border-primary/20 rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-ambient">
            {batches.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
        <span className="text-sm text-primary/50 mb-1">{filtered.length} of {profiles.length} students</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg">
          No profiles match the selected filters.
        </div>
      ) : platform === 'leetcode' ? (
        <LCBatchCharts data={filtered} platform={platform} platformName={platformName} />
      ) : (
        <CFBatchCharts data={filtered} platform={platform} platformName={platformName} />
      )}
    </div>
  )
}

// ---- Activity Dashboard ----

function ActivityDashboard({ data, platform }) {
  const activities = data.map(p => p.activity || { today: 0, last7: 0, last30: 0 })
  const totals = aggregateActivity(activities)
  const active = activeStudentCounts(activities)
  const label = 'Problems Solved'

  return (
    <ChartCard title={`Recent Activity — ${label}`}>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gradient-to-br from-ambient/10 to-ambient/5 rounded-xl p-4 border border-ambient/20">
          <div className="flex items-center gap-2 text-xs text-primary/50 font-medium mb-1">
            <Zap size={14} className="text-dark-ambient" /> Today
          </div>
          <div className="text-3xl font-bold text-dark-ambient">{totals.today}</div>
          <div className="text-xs text-primary/40 mt-1">{active.today} active student{active.today !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-gradient-to-br from-primary/5 to-primary/3 rounded-xl p-4 border border-primary/10">
          <div className="flex items-center gap-2 text-xs text-primary/50 font-medium mb-1">
            <CalendarDays size={14} className="text-primary" /> Last 7 Days
          </div>
          <div className="text-3xl font-bold text-primary">{totals.last7}</div>
          <div className="text-xs text-primary/40 mt-1">{active.last7} active student{active.last7 !== 1 ? 's' : ''}</div>
        </div>
        <div className="bg-gradient-to-br from-primary/5 to-ambient/5 rounded-xl p-4 border border-primary/10">
          <div className="flex items-center gap-2 text-xs text-primary/50 font-medium mb-1">
            <TrendingUp size={14} className="text-primary" /> Last 30 Days
          </div>
          <div className="text-3xl font-bold text-primary">{totals.last30}</div>
          <div className="text-xs text-primary/40 mt-1">{active.last30} active student{active.last30 !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Per-student activity table (top active students) */}
      {(() => {
        const sorted = [...data].filter(p => (p.activity?.last30 || 0) > 0)
          .sort((a, b) => (b.activity?.last30 || 0) - (a.activity?.last30 || 0))
          .slice(0, 10)
        if (!sorted.length) return null
        return (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-primary/60 mb-2">Most Active Students (30 days)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary/10 text-primary/50 text-xs">
                    <th className="py-2 text-left font-medium">Student</th>
                    <th className="py-2 text-right font-medium">Today</th>
                    <th className="py-2 text-right font-medium">7 Days</th>
                    <th className="py-2 text-right font-medium">30 Days</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => (
                    <tr key={p.username} className="border-b border-primary/5 hover:bg-ambient/5 transition-colors">
                      <td className="py-1.5">
                        <span className="font-medium text-primary">{p.student_name || p.username}</span>
                        {p.college && <span className="text-xs text-primary/30 ml-2">{p.college}</span>}
                        {p.batch && <span className="text-xs text-primary/30 ml-2">{p.batch}</span>}
                      </td>
                      <td className="py-1.5 text-right font-semibold">{p.activity?.today || 0}</td>
                      <td className="py-1.5 text-right font-semibold">{p.activity?.last7 || 0}</td>
                      <td className="py-1.5 text-right font-bold text-dark-ambient">{p.activity?.last30 || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}
    </ChartCard>
  )
}

// ---- LeetCode Batch ----

function SortTh({ label, field, sortKey, sortDir, onSort, align = 'left' }) {
  const active = sortKey === field
  return (
    <th
      className={`py-2 font-medium cursor-pointer select-none transition-colors hover:text-primary ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${active ? 'text-dark-ambient' : 'text-primary/50'}`}
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
  const toggle = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(defaultDir) }
  }
  const sortFn = (data) => [...data].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })
  return { sortKey, sortDir, toggle, sortFn }
}

function LCBatchCharts({ data, platform, platformName }) {
  const [modalProfile, setModalProfile] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const { sortKey, sortDir, toggle, sortFn } = useSortable('score', 'desc')

  const openProfile = async (username) => {
    setModalLoading(true)
    const full = await loadProfile(platform, username)
    setModalLoading(false)
    if (full?.raw_json) setModalProfile(full)
  }

  const buckets = makeBuckets(data, 'total_solved', [
    { label: '35+', min: 35, max: Infinity },
    { label: '20-34', min: 20, max: 35 },
    { label: '10-19', min: 10, max: 20 },
    { label: '5-9', min: 5, max: 10 },
    { label: '< 5', min: 0, max: 5 },
  ])

  return (
    <div className="space-y-6">
      {modalProfile && (
        <ProfileModal onClose={() => setModalProfile(null)} platform={platformName || 'LeetCode'}>
          <LCProfile data={modalProfile.raw_json} />
        </ProfileModal>
      )}
      {modalLoading && <ModalLoader />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPI label="Total Students" value={data.length} />
        <KPI label="Avg Solved" value={avg(data, 'total_solved').toFixed(1)} />
        <KPI label="Avg Rating" value={avg(data, 'contest_rating').toFixed(1)} />
        <KPI label="Avg Score" value={avg(data, 'score').toFixed(1)} />
        <KPI label="Avg Contests" value={avg(data, 'contests_attended').toFixed(1)} />
      </div>

      {/* Recent Activity */}
      <ActivityDashboard data={data} platform="leetcode" />

      {/* Problems bucket */}
      <ChartCard title="Students by Problems Solved">
        <div className="grid md:grid-cols-2 gap-6">
          <BucketBar data={buckets} />
          <BucketPie data={buckets} />
        </div>
      </ChartCard>

      {/* Difficulty breakdown */}
      <ChartCard title="Difficulty Breakdown per Student">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <KPI label="Avg Easy" value={avg(data, 'easy').toFixed(1)} accent />
          <KPI label="Avg Medium" value={avg(data, 'medium').toFixed(1)} accent />
          <KPI label="Avg Hard" value={avg(data, 'hard').toFixed(1)} accent />
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data.map(p => ({ name: p.username, Easy: p.easy, Medium: p.medium, Hard: p.hard }))}>
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

      {/* Score distribution */}
      <ChartCard title="Score Distribution">
        <Histogram values={data.map(p => p.score)} />
      </ChartCard>

      {/* Full table */}
      <ChartCard title="All Students">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10">
                <SortTh label="Name" field="student_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Username" field="username" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="College" field="college" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Batch" field="batch" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Easy" field="easy" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Med" field="medium" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Hard" field="hard" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Total" field="total_solved" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Rating" field="contest_rating" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Score" field="score" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortFn(data).map((p, i) => (
                <tr key={p.username} className={`border-b border-primary/5 ${i < 3 ? 'bg-ambient/5' : ''} hover:bg-ambient/10 cursor-pointer transition-colors`}
                  onClick={() => openProfile(p.username)}>
                  <td className="py-1.5 text-dark-ambient font-medium underline decoration-ambient/30">{p.student_name || p.username}</td>
                  <td className="py-1.5 text-dark-ambient">{p.username}</td>
                  <td className="py-1.5">{p.college}</td>
                  <td className="py-1.5">{p.batch}</td>
                  <td className="py-1.5 text-right">{p.easy}</td>
                  <td className="py-1.5 text-right">{p.medium}</td>
                  <td className="py-1.5 text-right">{p.hard}</td>
                  <td className="py-1.5 text-right font-semibold">{p.total_solved}</td>
                  <td className="py-1.5 text-right">{p.contest_rating}</td>
                  <td className="py-1.5 text-right font-bold text-primary">{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}

// ---- Codeforces Batch ----

function CFBatchCharts({ data, platform, platformName }) {
  const [modalProfile, setModalProfile] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const { sortKey, sortDir, toggle, sortFn } = useSortable('score', 'desc')

  const openProfile = async (username) => {
    setModalLoading(true)
    const full = await loadProfile(platform, username)
    setModalLoading(false)
    if (full?.raw_json) setModalProfile(full)
  }

  const rankOrder = [
    'legendary grandmaster', 'international grandmaster', 'grandmaster',
    'international master', 'master', 'candidate master',
    'expert', 'specialist', 'pupil', 'newbie', 'unrated',
  ]
  const rankData = rankOrder
    .map(r => ({
      name: r.replace(/\b\w/g, c => c.toUpperCase()),
      Students: data.filter(p => (p.rank || '').toLowerCase() === r).length,
    }))
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
      {modalProfile && (
        <ProfileModal onClose={() => setModalProfile(null)} platform={platformName || 'Codeforces'}>
          <CFProfile data={modalProfile.raw_json} />
        </ProfileModal>
      )}
      {modalLoading && <ModalLoader />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <KPI label="Students" value={data.length} />
        <KPI label="Avg Problems" value={avg(data, 'problems_solved').toFixed(1)} />
        <KPI label="Avg Rating" value={avg(data, 'rating').toFixed(1)} />
        <KPI label="Avg Max Rating" value={avg(data, 'max_rating').toFixed(1)} />
        <KPI label="Avg Score" value={avg(data, 'score').toFixed(1)} />
        <KPI label="Avg Contests" value={avg(data, 'contests_attended').toFixed(1)} />
      </div>

      {/* Recent Activity */}
      <ActivityDashboard data={data} platform="codeforces" />

      {/* Rank distribution */}
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
                  label={({ name, Students }) => Students > 0 ? `${name}: ${Students}` : ''}>
                  {rankData.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#0D1E56' : '#3BC3E2'} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* Problems bucket */}
      <ChartCard title="Students by Problems Solved">
        <div className="grid md:grid-cols-2 gap-6">
          <BucketBar data={buckets} />
          <BucketPie data={buckets} />
        </div>
      </ChartCard>

      {/* Problems per student */}
      <ChartCard title="Problems Solved per Student">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data.map(p => ({ name: p.username, Problems: p.problems_solved }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="name" stroke="#0D1E56" fontSize={11} angle={-45} textAnchor="end" height={80} />
            <YAxis stroke="#0D1E56" />
            <Tooltip contentStyle={CHART_TOOLTIP} />
            <Bar dataKey="Problems" fill="#3BC3E2" label={{ position: 'top', fill: '#0D1E56', fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Score distribution */}
      <ChartCard title="Score Distribution">
        <Histogram values={data.map(p => p.score)} />
      </ChartCard>

      {/* Full table */}
      <ChartCard title="All Students">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10">
                <SortTh label="Name" field="student_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Username" field="username" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="College" field="college" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Batch" field="batch" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Rating" field="rating" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Max" field="max_rating" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Rank" field="rank" sortKey={sortKey} sortDir={sortDir} onSort={toggle} />
                <SortTh label="Problems" field="problems_solved" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Contests" field="contests_attended" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
                <SortTh label="Score" field="score" sortKey={sortKey} sortDir={sortDir} onSort={toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortFn(data).map((p, i) => (
                <tr key={p.username} className={`border-b border-primary/5 ${i < 3 ? 'bg-ambient/5' : ''} hover:bg-ambient/10 cursor-pointer transition-colors`}
                  onClick={() => openProfile(p.username)}>
                  <td className="py-1.5 text-dark-ambient font-medium underline decoration-ambient/30">{p.student_name || p.username}</td>
                  <td className="py-1.5 text-dark-ambient">{p.username}</td>
                  <td className="py-1.5">{p.college}</td>
                  <td className="py-1.5">{p.batch}</td>
                  <td className="py-1.5 text-right">{p.rating}</td>
                  <td className="py-1.5 text-right">{p.max_rating}</td>
                  <td className="py-1.5 text-dark-ambient">{(p.rank || '').replace(/\b\w/g, c => c.toUpperCase())}</td>
                  <td className="py-1.5 text-right">{p.problems_solved}</td>
                  <td className="py-1.5 text-right">{p.contests_attended}</td>
                  <td className="py-1.5 text-right font-bold text-primary">{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}

// ============================================================
// PROFILE LOOKUP
// ============================================================

function ProfileLookup({ platform, platformName, adminUser }) {
  const isFaculty = adminUser?.role === 'faculty'
  const facultyCampus = adminUser?.campus
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)
  const [selectedProfile, setSelectedProfile] = useState(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults(null)
    setSelectedProfile(null)

    let matches = await searchProfiles(platform, query.trim())
    // Faculty can only see their campus
    if (isFaculty && facultyCampus) {
      matches = matches.filter(m => m.college === facultyCampus)
    }

    if (matches.length === 1 && matches[0].raw_json) {
      setSelectedProfile(matches[0])
    } else if (matches.length > 0) {
      setResults(matches)
    } else {
      setError(`No profiles found for '${query.trim()}'. Make sure data has been uploaded by admin.`)
    }
    setLoading(false)
  }

  const openProfile = async (row) => {
    const full = await loadProfile(platform, row.username)
    if (full?.raw_json) {
      setSelectedProfile(full)
      setResults(null)
    }
  }

  return (
    <div>
      <div className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" size={20} />
          <input
            type="text"
            placeholder="Search by username or student name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-3 bg-white border border-primary/20 rounded-lg text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-3 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
      )}

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
          <p className="mt-4 text-primary/50">Searching...</p>
        </div>
      )}

      {results && (
        <div className="bg-white rounded-xl border border-primary/10 p-4">
          <p className="text-sm text-primary/50 mb-3">{results.length} result{results.length !== 1 ? 's' : ''} found. Click to view profile.</p>
          <div className="space-y-2">
            {results.map(r => (
              <button key={r.username} onClick={() => openProfile(r)}
                className="w-full text-left px-4 py-3 rounded-lg border border-primary/10 hover:bg-ambient/10 hover:border-ambient/30 transition-colors flex justify-between items-center">
                <div>
                  <span className="font-medium text-primary">{r.student_name || r.username}</span>
                  {r.student_name && <span className="text-primary/40 ml-2">@{r.username}</span>}
                </div>
                <div className="text-sm text-primary/50">
                  {r.college && <span className="mr-3">{r.college}</span>}
                  <span className="font-semibold text-primary">Score: {r.score}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedProfile?.raw_json && platform === 'leetcode' && <LCProfile data={selectedProfile.raw_json} />}
      {selectedProfile?.raw_json && platform === 'codeforces' && <CFProfile data={selectedProfile.raw_json} />}
    </div>
  )
}

// ---- LeetCode Profile ----

function LCProfile({ data }) {
  const user = data.matchedUser
  const profile = user.profile
  const contest = data.userContestRanking
  const history = data.userContestRankingHistory || []
  const submissions = data.recentSubmissionList || []
  const badges = user.badges || []
  const score = calculateLeetCodeScore(data)
  const activity = computeRecentActivity(data, 'leetcode')

  const solvedStats = {}
  const totalStats = {}
  for (const item of user.submitStats.acSubmissionNum) solvedStats[item.difficulty] = item.count
  for (const item of user.submitStats.totalSubmissionNum) totalStats[item.difficulty] = item.count

  const difficulties = ['Easy', 'Medium', 'Hard']
  const solved = difficulties.map(d => solvedStats[d] || 0)
  const totalSolved = solved.reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-primary rounded-xl p-6 flex gap-6 items-center text-white">
        {profile.userAvatar && (
          <img src={profile.userAvatar} alt="" className="w-20 h-20 rounded-full border-2 border-ambient" />
        )}
        <div>
          <h2 className="text-2xl font-bold">{user.username}</h2>
          {profile.realName && <p className="text-white/70">{profile.realName}</p>}
          <p className="text-lg mt-1 text-ambient font-bold">Score: {score}/1000</p>
          {profile.countryName && <p className="text-white/50 text-sm flex items-center gap-1"><MapPin size={14} /> {profile.countryName}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Problems Solved" value={totalSolved} accent />
        <KPI label="Global Ranking" value={profile.ranking ? profile.ranking.toLocaleString() : 'N/A'} />
        <KPI label="Contest Rating" value={contest?.rating ? Math.round(contest.rating * 100) / 100 : 'N/A'} accent />
        <KPI label="Contests Attended" value={contest?.attendedContestsCount || 0} />
      </div>

      {/* Recent Activity */}
      <ActivityStrip activity={activity} label="Submissions" />

      {/* Problem Breakdown */}
      <ChartCard title="Problem Solving Breakdown">
        <div className="grid md:grid-cols-2 gap-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={difficulties.map((d, i) => ({ name: d, Solved: solved[i], Attempted: totalStats[d] || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" stroke="#0D1E56" />
              <YAxis stroke="#0D1E56" />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Legend />
              <Bar dataKey="Solved" fill="#3BC3E2" />
              <Bar dataKey="Attempted" fill="#0D1E56" opacity={0.3} />
            </BarChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={difficulties.map((d, i) => ({ name: d, value: solved[i] }))} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}>
                <Cell fill="#3BC3E2" />
                <Cell fill="#0D1E56" />
                <Cell fill="#22ACD1" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Contest Rating History */}
      {contest && history.length > 0 && (
        <ChartCard title="Contest Rating History">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KPI label="Current Rating" value={Math.round(contest.rating || 0)} accent />
            <KPI label="Global Ranking" value={(contest.globalRanking || 0).toLocaleString()} />
            <KPI label="Top %" value={`${(contest.topPercentage || 0).toFixed(2)}%`} accent />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={history.filter(h => h.attended).map(h => ({
              date: new Date(h.contest.startTime * 1000).toLocaleDateString(),
              rating: Math.round(h.rating),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" stroke="#0D1E56" fontSize={12} />
              <YAxis stroke="#0D1E56" />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Line type="monotone" dataKey="rating" stroke="#22ACD1" strokeWidth={2} dot={{ r: 3, fill: '#0D1E56' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Recent Submissions */}
      {submissions.length > 0 && (
        <ChartCard title="Recent Submissions">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-primary/50">
                  <th className="py-2 text-left font-medium">Problem</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Language</th>
                  <th className="py-2 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, i) => (
                  <tr key={i} className="border-b border-primary/5">
                    <td className="py-1.5">{sub.title}</td>
                    <td className="py-1.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        sub.statusDisplay === 'Accepted'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {sub.statusDisplay}
                      </span>
                    </td>
                    <td className="py-1.5 text-primary/50">{sub.lang}</td>
                    <td className="py-1.5 text-primary/50">{new Date(parseInt(sub.timestamp) * 1000).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <ChartCard title="Badges">
          <div className="flex flex-wrap gap-4">
            {badges.slice(0, 10).map(badge => (
              <div key={badge.id} className="flex flex-col items-center gap-1">
                <img src={badge.icon} alt="" className="w-14 h-14" />
                <span className="text-xs text-primary/50 text-center">{badge.displayName}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Submission Heatmap */}
      <SubmissionHeatmap rawJson={data} platform="leetcode" color="#FFA116" platformName="LeetCode" />

      <ScoreInfo platform="leetcode" />
    </div>
  )
}

// ---- Codeforces Profile ----

function CFProfile({ data }) {
  const user = data.user
  const ratingHistory = data.ratingHistory || []
  const submissions = data.submissions || []
  const score = calculateCodeforcesScore(data)
  const activity = computeRecentActivity(data, 'codeforces')

  const solvedProblems = new Set()
  const problemRatings = []
  const tagCount = {}
  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      const problem = sub.problem || {}
      if (problem.contestId && problem.index) {
        const key = `${problem.contestId}-${problem.index}`
        if (!solvedProblems.has(key)) {
          solvedProblems.add(key)
          if (problem.rating) problemRatings.push(problem.rating)
          for (const tag of (problem.tags || [])) {
            tagCount[tag] = (tagCount[tag] || 0) + 1
          }
        }
      }
    }
  }
  const avgProblemRating = problemRatings.length
    ? Math.round(problemRatings.reduce((a, b) => a + b, 0) / problemRatings.length)
    : 0

  // Problem rating distribution buckets
  const ratingBuckets = [
    { label: '800-1000', min: 800, max: 1001 },
    { label: '1000-1200', min: 1001, max: 1201 },
    { label: '1200-1400', min: 1201, max: 1401 },
    { label: '1400-1600', min: 1401, max: 1601 },
    { label: '1600-1800', min: 1601, max: 1801 },
    { label: '1800-2000', min: 1801, max: 2001 },
    { label: '2000+', min: 2001, max: Infinity },
  ].map(b => ({
    name: b.label,
    Problems: problemRatings.filter(r => r >= b.min && r < b.max).length,
  })).filter(b => b.Problems > 0)

  // Top tags
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, Problems: count }))

  // Recent submissions (last 20)
  const recentSubs = submissions.slice(0, 20)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-primary rounded-xl p-6 flex gap-6 items-center text-white">
        {user.titlePhoto && (
          <img src={user.titlePhoto} alt="" className="w-20 h-20 rounded-full border-2 border-ambient" />
        )}
        <div>
          <h2 className="text-2xl font-bold">{user.handle}</h2>
          {(user.firstName || user.lastName) && (
            <p className="text-white/70">{[user.firstName, user.lastName].filter(Boolean).join(' ')}</p>
          )}
          <p className="text-lg mt-1 text-ambient font-bold">Score: {score}/1000</p>
          {user.country && <p className="text-white/50 text-sm flex items-center gap-1"><MapPin size={14} /> {user.country}</p>}
          {user.organization && <p className="text-white/40 text-sm">{user.organization}</p>}
          <div className="flex gap-4 mt-1 text-sm">
            <span className="text-ambient">{(user.rank || 'unrated').replace(/\b\w/g, c => c.toUpperCase())}</span>
            <span className="text-white/60">Rating: {user.rating || 0} (max: {user.maxRating || user.rating || 0})</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPI label="Problems Solved" value={solvedProblems.size} accent />
        <KPI label="Contests" value={ratingHistory.length} />
        <KPI label="Avg Problem Rating" value={avgProblemRating} accent />
        <KPI label="Max Rating" value={user.maxRating || user.rating || 0} />
        <KPI label="Contribution" value={user.contribution || 0} />
      </div>

      {/* Recent Activity */}
      <ActivityStrip activity={activity} label="Problems Solved" />

      {/* Problem Rating Distribution */}
      {ratingBuckets.length > 0 && (
        <ChartCard title="Problems by Difficulty Rating">
          <div className="grid md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ratingBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#0D1E56" fontSize={12} />
                <YAxis stroke="#0D1E56" />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Bar dataKey="Problems" label={{ position: 'top', fill: '#0D1E56', fontSize: 12 }}>
                  {ratingBuckets.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={ratingBuckets} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="Problems"
                  label={({ name, Problems }) => Problems > 0 ? `${name}: ${Problems}` : ''}>
                  {ratingBuckets.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* Top Tags */}
      {topTags.length > 0 && (
        <ChartCard title="Top Problem Tags">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topTags} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" stroke="#0D1E56" />
              <YAxis dataKey="name" type="category" stroke="#0D1E56" fontSize={12} width={120} />
              <Tooltip contentStyle={CHART_TOOLTIP} />
              <Bar dataKey="Problems" fill="#3BC3E2" label={{ position: 'right', fill: '#0D1E56', fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Rating History */}
      {ratingHistory.length > 0 && (
        <ChartCard title="Rating History">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <KPI label="Current Rating" value={user.rating || 0} accent />
            <KPI label="Best Rating" value={user.maxRating || 0} />
            <KPI label="Contests Played" value={ratingHistory.length} accent />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={ratingHistory.map(h => ({
              date: new Date(h.ratingUpdateTimeSeconds * 1000).toLocaleDateString(),
              rating: h.newRating,
              contest: h.contestName,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" stroke="#0D1E56" fontSize={12} />
              <YAxis stroke="#0D1E56" />
              <Tooltip contentStyle={CHART_TOOLTIP} formatter={(val, name, props) => [val, 'Rating']}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.contest || label} />
              <Line type="monotone" dataKey="rating" stroke="#22ACD1" strokeWidth={2} dot={{ r: 3, fill: '#0D1E56' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Recent Submissions */}
      {recentSubs.length > 0 && (
        <ChartCard title="Recent Submissions">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-primary/50">
                  <th className="py-2 text-left font-medium">Problem</th>
                  <th className="py-2 text-right font-medium">Rating</th>
                  <th className="py-2 text-left font-medium">Verdict</th>
                  <th className="py-2 text-left font-medium">Language</th>
                  <th className="py-2 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSubs.map((sub, i) => {
                  const problem = sub.problem || {}
                  return (
                    <tr key={i} className="border-b border-primary/5">
                      <td className="py-1.5">{problem.name || 'Unknown'}</td>
                      <td className="py-1.5 text-right text-primary/60">{problem.rating || '-'}</td>
                      <td className="py-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          sub.verdict === 'OK'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {sub.verdict === 'OK' ? 'Accepted' : (sub.verdict || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-1.5 text-primary/50">{sub.programmingLanguage}</td>
                      <td className="py-1.5 text-primary/50">{new Date(sub.creationTimeSeconds * 1000).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* Submission Heatmap */}
      <SubmissionHeatmap rawJson={data} platform="codeforces" color="#1F8ACB" platformName="Codeforces" />

      <ScoreInfo platform="codeforces" />
    </div>
  )
}

// ============================================================
// MODAL
// ============================================================

function ProfileModal({ onClose, platform, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 relative">
        <div className="sticky top-0 z-10 bg-white rounded-t-2xl border-b border-primary/10 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-primary">{platform} Profile</h3>
          <button onClick={onClose}
            className="p-2 rounded-lg hover:bg-primary/10 text-primary/50 hover:text-primary transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

function ModalLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl p-8 shadow-xl flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
        <p className="text-primary/60 text-sm">Loading profile...</p>
      </div>
    </div>
  )
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function ActivityStrip({ activity, label }) {
  if (!activity) return null
  return (
    <div className="bg-white rounded-xl border border-primary/10 shadow-sm p-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-xs text-primary/50 font-medium flex items-center justify-center gap-1 mb-1">
            <Zap size={12} className="text-dark-ambient" /> Today
          </div>
          <div className="text-2xl font-bold text-dark-ambient">{activity.today}</div>
          <div className="text-[10px] text-primary/30">{label}</div>
        </div>
        <div className="text-center border-x border-primary/10">
          <div className="text-xs text-primary/50 font-medium flex items-center justify-center gap-1 mb-1">
            <CalendarDays size={12} /> Last 7 Days
          </div>
          <div className="text-2xl font-bold text-primary">{activity.last7}</div>
          <div className="text-[10px] text-primary/30">{label}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-primary/50 font-medium flex items-center justify-center gap-1 mb-1">
            <TrendingUp size={12} /> Last 30 Days
          </div>
          <div className="text-2xl font-bold text-primary">{activity.last30}</div>
          <div className="text-[10px] text-primary/30">{label}</div>
        </div>
      </div>
    </div>
  )
}

export { ActivityStrip }

function KPI({ label, value, accent }) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? 'bg-ambient/10 border-ambient/30' : 'bg-white border-primary/10'}`}>
      <div className="text-xs text-primary/50 font-medium">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-dark-ambient' : 'text-primary'}`}>{value}</div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-primary/10 shadow-sm">
      <h3 className="text-lg font-semibold text-primary mb-4">{title}</h3>
      {children}
    </div>
  )
}

function BucketBar({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="name" stroke="#0D1E56" fontSize={12} />
        <YAxis stroke="#0D1E56" />
        <Tooltip contentStyle={CHART_TOOLTIP} />
        <Bar dataKey="Students" label={{ position: 'top', fill: '#0D1E56', fontSize: 12 }}>
          {data.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function BucketPie({ data }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="Students"
          label={({ name, Students }) => Students > 0 ? `${name}: ${Students}` : ''}>
          {data.map((_, i) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

function Histogram({ values }) {
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return <p className="text-primary/50">All values are {min}</p>
  const bins = 15
  const binWidth = (max - min) / bins
  const histData = []
  for (let i = 0; i < bins; i++) {
    const lo = min + i * binWidth
    const hi = lo + binWidth
    const count = values.filter(v => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length
    if (count > 0) histData.push({ label: `${Math.round(lo)}-${Math.round(hi)}`, count })
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={histData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="label" stroke="#0D1E56" fontSize={12} />
        <YAxis stroke="#0D1E56" />
        <Tooltip contentStyle={CHART_TOOLTIP} />
        <Bar dataKey="count" fill="#0D1E56" />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ScoreInfo({ platform }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-xl border border-primary/10">
      <button onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 text-left font-medium text-primary flex justify-between items-center hover:bg-primary/5 rounded-xl transition-colors">
        How is the score calculated?
        <span className={`transition-transform text-ambient ${open ? 'rotate-180' : ''}`}>&#9660;</span>
      </button>
      {open && (
        <div className="px-6 pb-4 text-sm text-primary/70 space-y-1">
          {platform === 'leetcode' ? (
            <>
              <p className="font-semibold text-primary">Overall Score (Max: 1000 points)</p>
              <p><strong>Problem Solving (400):</strong> Easy=1pt, Medium=3pt, Hard=5pt, normalized to max 400</p>
              <p><strong>Contest Rating (300):</strong> Rating / 10, capped at 300</p>
              <p><strong>Consistency (200):</strong> 2 pts per contest, capped at 200</p>
              <p><strong>Ranking Bonus (100):</strong> Top 1K=100, 10K=80, 50K=60, 100K=40, else=20</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-primary">Overall Score (Max: 1000 points)</p>
              <p><strong>Rating (400):</strong> Max Rating / 7.5, capped at 400</p>
              <p><strong>Contests (300):</strong> 3 pts per contest, capped at 300</p>
              <p><strong>Problems (200):</strong> 2 pts per unique problem, capped at 200</p>
              <p><strong>Rank Bonus (100):</strong> LGM=100, IGM=95, GM=90, IM=80, M=70, CM=60, Expert=50, Specialist=40, Pupil=30, Newbie=20</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Helpers ----

function avg(arr, key) {
  if (!arr.length) return 0
  return arr.reduce((sum, p) => sum + (p[key] || 0), 0) / arr.length
}

function makeBuckets(data, key, ranges) {
  return ranges.map((b, i) => ({
    name: `${b.label}`,
    Students: data.filter(p => (p[key] || 0) >= b.min && (p[key] || 0) < b.max).length,
  }))
}
