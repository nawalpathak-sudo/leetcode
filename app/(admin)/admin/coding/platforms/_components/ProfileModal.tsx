'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  X, RefreshCw, MapPin, Zap, CalendarDays, TrendingUp,
  Star, GitFork, FolderGit2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const BUCKET_COLORS = ['#22ACD1', '#3BC3E2', '#0D1E56', '#6B7280', '#D1D5DB']
const CHART_TOOLTIP = { background: '#FFFFFF', border: '1px solid #3BC3E2', borderRadius: 8, color: '#0D1E56' }

// ============================================================
// SCORE CALCULATION (ported from src/lib/scoring.js)
// ============================================================

function calculateLeetCodeScore(data: any) {
  if (!data || !data.matchedUser) return 0
  const user = data.matchedUser
  const contest = data.userContestRanking
  const solvedStats: Record<string, number> = {}
  for (const item of user.submitStats.acSubmissionNum) solvedStats[item.difficulty] = item.count
  const easy = solvedStats.Easy || 0
  const medium = solvedStats.Medium || 0
  const hard = solvedStats.Hard || 0
  const problemScore = (easy * 1) + (medium * 3) + (hard * 5)
  const normalizedProblemScore = Math.min(problemScore / 10, 400)
  let contestScore = 0
  if (contest?.rating) contestScore = Math.min(contest.rating / 10, 300)
  const contestsAttended = contest?.attendedContestsCount || 0
  const consistencyScore = Math.min(contestsAttended * 2, 200)
  let rankingScore = 0
  const ranking = user.profile?.ranking
  if (ranking) {
    if (ranking <= 1000) rankingScore = 100
    else if (ranking <= 10000) rankingScore = 80
    else if (ranking <= 50000) rankingScore = 60
    else if (ranking <= 100000) rankingScore = 40
    else rankingScore = 20
  }
  return Math.round((normalizedProblemScore + contestScore + consistencyScore + rankingScore) * 100) / 100
}

function calculateCodeforcesScore(data: any) {
  if (!data || !data.user) return 0
  const user = data.user
  const ratingHistory = data.ratingHistory || []
  const submissions = data.submissions || []
  const maxRating = user.maxRating || user.rating || 0
  const ratingScore = Math.min(maxRating / 7.5, 400)
  const contestScore = Math.min(ratingHistory.length * 3, 300)
  const solvedProblems = new Set<string>()
  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      const problem = sub.problem || {}
      if (problem.contestId && problem.index) solvedProblems.add(`${problem.contestId}-${problem.index}`)
    }
  }
  const problemScore = Math.min(solvedProblems.size * 2, 200)
  const rankScores: Record<string, number> = {
    'legendary grandmaster': 100, 'international grandmaster': 95, grandmaster: 90,
    'international master': 80, master: 70, 'candidate master': 60,
    expert: 50, specialist: 40, pupil: 30, newbie: 20,
  }
  const rank = (user.rank || '').toLowerCase()
  const rankBonus = rankScores[rank] || 10
  return Math.round((ratingScore + contestScore + problemScore + rankBonus) * 100) / 100
}

// ============================================================
// ACTIVITY COMPUTATION
// ============================================================

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

// ============================================================
// SUBMISSION HEATMAP (ported from SubmissionHeatmap.jsx)
// ============================================================

const HEATMAP_CELL = 11
const HEATMAP_GAP = 2
const HEATMAP_SIZE = HEATMAP_CELL + HEATMAP_GAP
const HEATMAP_LEFT_PAD = 28
const HEATMAP_TOP_PAD = 18
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtNice(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function blendWithWhite(hex: string, opacity: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * opacity + 255 * (1 - opacity))},${Math.round(g * opacity + 255 * (1 - opacity))},${Math.round(b * opacity + 255 * (1 - opacity))})`
}

function extractDayMap(rawJson: any, platform: string) {
  const dayMap: Record<string, number> = {}

  if (platform === 'leetcode') {
    const cal = rawJson?.matchedUser?.submissionCalendar
    if (cal) {
      try {
        const parsed = typeof cal === 'string' ? JSON.parse(cal) : cal
        for (const [ts, count] of Object.entries(parsed)) {
          const d = new Date(parseInt(ts) * 1000)
          const key = fmtDate(d)
          dayMap[key] = (dayMap[key] || 0) + (count as number)
        }
      } catch { /* ignore */ }
    }
    if (Object.keys(dayMap).length === 0 && rawJson?.recentSubmissionList) {
      for (const sub of rawJson.recentSubmissionList) {
        if (sub.timestamp) {
          const d = new Date(parseInt(sub.timestamp) * 1000)
          const key = fmtDate(d)
          dayMap[key] = (dayMap[key] || 0) + 1
        }
      }
    }
  }

  if (platform === 'codeforces') {
    const subs = rawJson?.submissions || []
    for (const sub of subs) {
      if (sub.creationTimeSeconds) {
        const d = new Date(sub.creationTimeSeconds * 1000)
        const key = fmtDate(d)
        dayMap[key] = (dayMap[key] || 0) + 1
      }
    }
  }

  if (platform === 'github') {
    const contribs = rawJson?.contributions
    if (contribs && typeof contribs === 'object') {
      for (const [date, count] of Object.entries(contribs)) {
        if (typeof count === 'number') dayMap[date] = count
      }
    }
  }

  return dayMap
}

function SubmissionHeatmap({ rawJson, platform, color, platformName }: { rawJson: any; platform: string; color: string; platformName: string }) {
  const [hover, setHover] = useState<{ date: string; count: number; x: number; y: number } | null>(null)

  const { weeks, monthLabels, stats, dayMap, hasData } = useMemo(() => {
    const dayMap = extractDayMap(rawJson, platform)
    if (Object.keys(dayMap).length === 0) return { weeks: [] as any[], monthLabels: [] as any[], stats: {} as any, dayMap, hasData: false }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() - 364)
    start.setDate(start.getDate() - start.getDay())

    const weeks: (({ date: string; count: number } | null)[])[] = []
    const cur = new Date(start)
    while (cur <= today) {
      const week: ({ date: string; count: number } | null)[] = []
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(cur)
        cellDate.setDate(cellDate.getDate() + d)
        if (cellDate > today) week.push(null)
        else {
          const key = fmtDate(cellDate)
          week.push({ date: key, count: dayMap[key] || 0 })
        }
      }
      weeks.push(week)
      cur.setDate(cur.getDate() + 7)
    }

    const monthLabels: { text: string; x: number }[] = []
    let lastMonth = -1
    weeks.forEach((week, wi) => {
      const firstDay = week.find(d => d)
      if (firstDay) {
        const month = new Date(firstDay.date + 'T00:00:00').getMonth()
        if (month !== lastMonth) {
          monthLabels.push({ text: MONTH_NAMES[month], x: HEATMAP_LEFT_PAD + wi * HEATMAP_SIZE })
          lastMonth = month
        }
      }
    })

    const totalSubmissions = Object.values(dayMap).reduce((a, b) => a + b, 0)
    let activeDays = 0, maxStreak = 0, curStreak = 0
    const d = new Date(start)
    while (d <= today) {
      const key = fmtDate(d)
      if (dayMap[key]) { activeDays++; curStreak++; if (curStreak > maxStreak) maxStreak = curStreak }
      else curStreak = 0
      d.setDate(d.getDate() + 1)
    }

    return { weeks, monthLabels, stats: { totalSubmissions, activeDays, maxStreak }, dayMap, hasData: true }
  }, [rawJson, platform])

  if (!hasData) return null

  const colors = ['#ebedf0', blendWithWhite(color, 0.25), blendWithWhite(color, 0.5), blendWithWhite(color, 0.75), color]
  const maxCount = Math.max(1, ...Object.values(dayMap))
  const getLevel = (count: number) => {
    if (count === 0) return 0
    if (count <= Math.ceil(maxCount * 0.25)) return 1
    if (count <= Math.ceil(maxCount * 0.5)) return 2
    if (count <= Math.ceil(maxCount * 0.75)) return 3
    return 4
  }

  const svgWidth = HEATMAP_LEFT_PAD + weeks.length * HEATMAP_SIZE + 4
  const svgHeight = HEATMAP_TOP_PAD + 7 * HEATMAP_SIZE + 4

  return (
    <div className="rounded-2xl shadow-sm border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h3 className="font-bold mb-1 flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
        {platformName} -- Submission Activity
      </h3>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        {stats.totalSubmissions} submission{stats.totalSubmissions !== 1 ? 's' : ''} in the past year
        <span className="mx-2">--</span>
        Active days: {stats.activeDays}
        <span className="mx-2">--</span>
        Max streak: {stats.maxStreak}
      </p>

      <div className="overflow-x-auto relative" onMouseLeave={() => setHover(null)}>
        <svg width={svgWidth} height={svgHeight} className="block">
          {monthLabels.map((m, i) => (
            <text key={i} x={m.x} y={11} fontSize={10} fill="#94a3b8" fontFamily="system-ui">{m.text}</text>
          ))}
          <text x={0} y={HEATMAP_TOP_PAD + 1 * HEATMAP_SIZE + HEATMAP_CELL * 0.75} fontSize={9} fill="#94a3b8" fontFamily="system-ui">Mon</text>
          <text x={0} y={HEATMAP_TOP_PAD + 3 * HEATMAP_SIZE + HEATMAP_CELL * 0.75} fontSize={9} fill="#94a3b8" fontFamily="system-ui">Wed</text>
          <text x={0} y={HEATMAP_TOP_PAD + 5 * HEATMAP_SIZE + HEATMAP_CELL * 0.75} fontSize={9} fill="#94a3b8" fontFamily="system-ui">Fri</text>

          {weeks.map((week, wi) =>
            week.map((day, di) => day && (
              <rect
                key={`${wi}-${di}`}
                x={HEATMAP_LEFT_PAD + wi * HEATMAP_SIZE}
                y={HEATMAP_TOP_PAD + di * HEATMAP_SIZE}
                width={HEATMAP_CELL}
                height={HEATMAP_CELL}
                rx={2}
                fill={colors[getLevel(day.count)]}
                className="transition-opacity"
                style={{ cursor: 'default' }}
                onMouseEnter={(e) => {
                  const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect()
                  setHover({ date: day.date, count: day.count, x: rect.left + rect.width / 2, y: rect.top })
                }}
              >
                <title>{`${fmtNice(day.date)}: ${day.count} submission${day.count !== 1 ? 's' : ''}`}</title>
              </rect>
            ))
          )}
        </svg>

        {hover && (
          <div
            className="fixed z-50 pointer-events-none px-3 py-1.5 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap"
            style={{ left: hover.x, top: hover.y - 36, transform: 'translateX(-50%)', background: 'var(--color-primary)' }}
          >
            {hover.count} submission{hover.count !== 1 ? 's' : ''} on {fmtNice(hover.date)}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-3 justify-end text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        <span>Less</span>
        {colors.map((c, i) => (
          <div key={i} className="w-[11px] h-[11px] rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

// ============================================================
// SHARED UI COMPONENTS
// ============================================================

function KPI({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl p-4 border" style={{
      background: accent ? 'rgba(59,195,226,0.1)' : 'var(--color-surface)',
      borderColor: accent ? 'rgba(59,195,226,0.3)' : 'var(--color-border)',
    }}>
      <div className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color: accent ? 'var(--color-dark-ambient)' : 'var(--color-primary)' }}>{value}</div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-6 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>{title}</h3>
      {children}
    </div>
  )
}

function ActivityStrip({ activity, label }: { activity: any; label: string }) {
  if (!activity) return null
  return (
    <div className="rounded-xl border shadow-sm p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-xs font-medium flex items-center justify-center gap-1 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            <Zap size={12} style={{ color: 'var(--color-dark-ambient)' }} /> Yesterday
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-dark-ambient)' }}>{activity.yesterday}</div>
          <div className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
        </div>
        <div className="text-center" style={{ borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}>
          <div className="text-xs font-medium flex items-center justify-center gap-1 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            <CalendarDays size={12} /> Last 7 Days
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{activity.last7}</div>
          <div className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
        </div>
        <div className="text-center">
          <div className="text-xs font-medium flex items-center justify-center gap-1 mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            <TrendingUp size={12} /> Last 30 Days
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{activity.last30}</div>
          <div className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{label}</div>
        </div>
      </div>
    </div>
  )
}

function ScoreInfo({ platform }: { platform: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <button onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 text-left font-medium flex justify-between items-center hover:opacity-80 rounded-xl transition-colors"
        style={{ color: 'var(--color-primary)' }}>
        How is the score calculated?
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--color-ambient)' }}>&#9660;</span>
      </button>
      {open && (
        <div className="px-6 pb-4 text-sm space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
          {platform === 'leetcode' ? (
            <>
              <p className="font-semibold" style={{ color: 'var(--color-primary)' }}>Overall Score (Max: 1000 points)</p>
              <p><strong>Problem Solving (400):</strong> Easy=1pt, Medium=3pt, Hard=5pt, normalized to max 400</p>
              <p><strong>Contest Rating (300):</strong> Rating / 10, capped at 300</p>
              <p><strong>Consistency (200):</strong> 2 pts per contest, capped at 200</p>
              <p><strong>Ranking Bonus (100):</strong> Top 1K=100, 10K=80, 50K=60, 100K=40, else=20</p>
            </>
          ) : platform === 'codeforces' ? (
            <>
              <p className="font-semibold" style={{ color: 'var(--color-primary)' }}>Overall Score (Max: 1000 points)</p>
              <p><strong>Rating (400):</strong> Max Rating / 7.5, capped at 400</p>
              <p><strong>Contests (300):</strong> 3 pts per contest, capped at 300</p>
              <p><strong>Problems (200):</strong> 2 pts per unique problem, capped at 200</p>
              <p><strong>Rank Bonus (100):</strong> LGM=100, IGM=95, GM=90, IM=80, M=70, CM=60, Expert=50, Specialist=40, Pupil=30, Newbie=20</p>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ============================================================
// LEETCODE PROFILE
// ============================================================

function LCProfileContent({ data }: { data: any }) {
  const user = data.matchedUser
  const profile = user.profile
  const contest = data.userContestRanking
  const history = data.userContestRankingHistory || []
  const submissions = data.recentSubmissionList || []
  const badges = user.badges || []
  const score = calculateLeetCodeScore(data)
  const activity = computeRecentActivityFromApi(data, 'leetcode')

  const solvedStats: Record<string, number> = {}
  const totalStats: Record<string, number> = {}
  for (const item of user.submitStats.acSubmissionNum) solvedStats[item.difficulty] = item.count
  for (const item of user.submitStats.totalSubmissionNum) totalStats[item.difficulty] = item.count

  const difficulties = ['Easy', 'Medium', 'Hard']
  const solved = difficulties.map(d => solvedStats[d] || 0)
  const totalSolved = solved.reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 flex gap-6 items-center text-white" style={{ background: 'var(--color-primary)' }}>
        {profile.userAvatar && (
          <img src={profile.userAvatar} alt="" className="w-20 h-20 rounded-full border-2" style={{ borderColor: 'var(--color-ambient)' }} />
        )}
        <div>
          <h2 className="text-2xl font-bold">{user.username}</h2>
          {profile.realName && <p className="text-white/70">{profile.realName}</p>}
          <p className="text-lg mt-1 font-bold" style={{ color: 'var(--color-ambient)' }}>Score: {score}/1000</p>
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
      <ActivityStrip activity={activity} label="Problems" />

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
                label={({ name, value }: any) => `${name}: ${value}`}>
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
            <LineChart data={history.filter((h: any) => h.attended).map((h: any) => ({
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
                <tr className="border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th className="py-2 text-left font-medium">Problem</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Language</th>
                  <th className="py-2 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub: any, i: number) => (
                  <tr key={i} className="border-b" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
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
                    <td className="py-1.5" style={{ color: 'var(--color-text-secondary)' }}>{sub.lang}</td>
                    <td className="py-1.5" style={{ color: 'var(--color-text-secondary)' }}>{new Date(parseInt(sub.timestamp) * 1000).toLocaleString()}</td>
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
            {badges.slice(0, 10).map((badge: any) => (
              <div key={badge.id} className="flex flex-col items-center gap-1">
                <img src={badge.icon} alt="" className="w-14 h-14" />
                <span className="text-xs text-center" style={{ color: 'var(--color-text-secondary)' }}>{badge.displayName}</span>
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

// ============================================================
// CODEFORCES PROFILE
// ============================================================

function CFProfileContent({ data }: { data: any }) {
  const user = data.user
  const ratingHistory = data.ratingHistory || []
  const submissions = data.submissions || []
  const score = calculateCodeforcesScore(data)
  const activity = computeRecentActivityFromApi(data, 'codeforces')

  const solvedProblems = new Set<string>()
  const problemRatings: number[] = []
  const tagCount: Record<string, number> = {}
  for (const sub of submissions) {
    if (sub.verdict === 'OK') {
      const problem = sub.problem || {}
      if (problem.contestId && problem.index) {
        const key = `${problem.contestId}-${problem.index}`
        if (!solvedProblems.has(key)) {
          solvedProblems.add(key)
          if (problem.rating) problemRatings.push(problem.rating)
          for (const tag of (problem.tags || [])) tagCount[tag] = (tagCount[tag] || 0) + 1
        }
      }
    }
  }
  const avgProblemRating = problemRatings.length
    ? Math.round(problemRatings.reduce((a, b) => a + b, 0) / problemRatings.length)
    : 0

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

  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, Problems: count }))

  const recentSubs = submissions.slice(0, 20)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 flex gap-6 items-center text-white" style={{ background: 'var(--color-primary)' }}>
        {user.titlePhoto && (
          <img src={user.titlePhoto} alt="" className="w-20 h-20 rounded-full border-2" style={{ borderColor: 'var(--color-ambient)' }} />
        )}
        <div>
          <h2 className="text-2xl font-bold">{user.handle}</h2>
          {(user.firstName || user.lastName) && (
            <p className="text-white/70">{[user.firstName, user.lastName].filter(Boolean).join(' ')}</p>
          )}
          <p className="text-lg mt-1 font-bold" style={{ color: 'var(--color-ambient)' }}>Score: {score}/1000</p>
          {user.country && <p className="text-white/50 text-sm flex items-center gap-1"><MapPin size={14} /> {user.country}</p>}
          {user.organization && <p className="text-white/40 text-sm">{user.organization}</p>}
          <div className="flex gap-4 mt-1 text-sm">
            <span style={{ color: 'var(--color-ambient)' }}>{(user.rank || 'unrated').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
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
                  {ratingBuckets.map((_: any, i: number) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={ratingBuckets} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="Problems"
                  label={({ name, Problems }: any) => Problems > 0 ? `${name}: ${Problems}` : ''}>
                  {ratingBuckets.map((_: any, i: number) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
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
            <LineChart data={ratingHistory.map((h: any) => ({
              date: new Date(h.ratingUpdateTimeSeconds * 1000).toLocaleDateString(),
              rating: h.newRating,
              contest: h.contestName,
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" stroke="#0D1E56" fontSize={12} />
              <YAxis stroke="#0D1E56" />
              <Tooltip contentStyle={CHART_TOOLTIP} formatter={(val: any) => [val, 'Rating']}
                labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.contest || label} />
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
                <tr className="border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  <th className="py-2 text-left font-medium">Problem</th>
                  <th className="py-2 text-right font-medium">Rating</th>
                  <th className="py-2 text-left font-medium">Verdict</th>
                  <th className="py-2 text-left font-medium">Language</th>
                  <th className="py-2 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSubs.map((sub: any, i: number) => {
                  const problem = sub.problem || {}
                  return (
                    <tr key={i} className="border-b" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
                      <td className="py-1.5">{problem.name || 'Unknown'}</td>
                      <td className="py-1.5 text-right" style={{ color: 'var(--color-text-secondary)' }}>{problem.rating || '-'}</td>
                      <td className="py-1.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          sub.verdict === 'OK'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {sub.verdict === 'OK' ? 'Accepted' : (sub.verdict || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-1.5" style={{ color: 'var(--color-text-secondary)' }}>{sub.programmingLanguage}</td>
                      <td className="py-1.5" style={{ color: 'var(--color-text-secondary)' }}>{new Date(sub.creationTimeSeconds * 1000).toLocaleString()}</td>
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
// GITHUB PROFILE
// ============================================================

function GHProfileContent({ data }: { data: any }) {
  const user = data.user || {}
  const repos = (data.repos || []).filter((r: any) => !r.fork)
  const gql = data.graphql_stats || {}

  const langMap: Record<string, number> = {}
  let totalStars = 0
  let totalForks = 0
  for (const r of repos) {
    if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1
    totalStars += r.stargazers_count || 0
    totalForks += r.forks_count || 0
  }
  const topLangs = Object.entries(langMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }))

  const contributions = data.contributions || {}
  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  const sortedDates = Object.keys(contributions).sort()
  for (const date of sortedDates) {
    if (contributions[date] > 0) {
      tempStreak++
      if (tempStreak > longestStreak) longestStreak = tempStreak
    } else tempStreak = 0
  }
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const checkDate = contributions[today] > 0 ? today : yesterday
  if (contributions[checkDate] > 0) {
    const d = new Date(checkDate + 'T00:00:00')
    while (contributions[d.toISOString().slice(0, 10)] > 0) {
      currentStreak++
      d.setDate(d.getDate() - 1)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 flex gap-6 items-center text-white" style={{ background: 'var(--color-primary)' }}>
        {user.avatar_url && (
          <img src={user.avatar_url} alt="" className="w-20 h-20 rounded-full border-2" style={{ borderColor: 'var(--color-ambient)' }} />
        )}
        <div>
          <h2 className="text-2xl font-bold">{user.login || 'Unknown'}</h2>
          {user.name && <p className="text-white/70">{user.name}</p>}
          {user.bio && <p className="text-white/50 text-sm mt-1">{user.bio}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Commits (Year)" value={gql.total_commits || 0} accent />
        <KPI label="Repositories" value={repos.length} />
        <KPI label="Stars" value={totalStars} accent />
        <KPI label="Followers" value={user.followers || 0} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Pull Requests" value={gql.total_prs || 0} />
        <KPI label="Forks" value={totalForks} />
        <KPI label="Current Streak" value={`${currentStreak}d`} accent />
        <KPI label="Longest Streak" value={`${longestStreak}d`} />
      </div>

      {gql.total_contributions_year > 0 && (
        <div className="rounded-xl px-6 py-3 text-center border" style={{ background: 'rgba(59,195,226,0.1)', borderColor: 'rgba(59,195,226,0.3)' }}>
          <span className="text-2xl font-bold" style={{ color: 'var(--color-dark-ambient)' }}>{gql.total_contributions_year}</span>
          <span className="ml-2" style={{ color: 'var(--color-text-secondary)' }}>contributions in the past year</span>
        </div>
      )}

      {/* Languages */}
      {topLangs.length > 0 && (
        <ChartCard title="Languages">
          <div className="grid md:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topLangs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#0D1E56" fontSize={12} />
                <YAxis stroke="#0D1E56" />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Bar dataKey="value" name="Repos" fill="#3BC3E2" label={{ position: 'top', fill: '#0D1E56', fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={topLangs} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value"
                  label={({ name, value }: any) => `${name}: ${value}`}>
                  {topLangs.map((_: any, i: number) => <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* Top Repos */}
      {repos.length > 0 && (
        <ChartCard title="Top Repositories">
          <div className="grid sm:grid-cols-2 gap-3">
            {repos.slice(0, 6).map((r: any) => (
              <div key={r.name} className="border rounded-lg p-4 hover:opacity-80 transition-colors" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-start justify-between">
                  <div className="font-medium text-sm" style={{ color: 'var(--color-primary)' }}>{r.name}</div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {(r.stargazers_count > 0) && <span className="flex items-center gap-0.5"><Star size={12} /> {r.stargazers_count}</span>}
                    {(r.forks_count > 0) && <span className="flex items-center gap-0.5"><GitFork size={12} /> {r.forks_count}</span>}
                  </div>
                </div>
                {r.description && <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{r.description}</p>}
                {r.language && (
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(13,30,86,0.05)', color: 'var(--color-text-secondary)' }}>{r.language}</span>
                )}
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Contribution Heatmap */}
      <SubmissionHeatmap rawJson={data} platform="github" color="#333333" platformName="GitHub" />
    </div>
  )
}

// ============================================================
// MAIN PROFILE MODAL
// ============================================================

interface ProfileModalProps {
  profile: any
  platform: string
  onClose: () => void
}

export default function ProfileModal({ profile, platform, onClose }: ProfileModalProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [currentProfile, setCurrentProfile] = useState(profile)

  useEffect(() => {
    setCurrentProfile(profile)
  }, [profile])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleRefresh = async () => {
    if (refreshing || !currentProfile) return
    setRefreshing(true)
    try {
      const supabase = createClient()
      let rawData: any = null

      if (platform === 'leetcode') {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ username: currentProfile.username }),
        })
        if (res.ok) {
          const json = await res.json()
          rawData = json.data?.matchedUser ? json.data : null
        }
      } else if (platform === 'codeforces') {
        const userRes = await fetch(`https://codeforces.com/api/user.info?handles=${currentProfile.username}`)
        if (userRes.ok) {
          const userData = await userRes.json()
          if (userData.status === 'OK') {
            const ratingRes = await fetch(`https://codeforces.com/api/user.rating?handle=${currentProfile.username}`)
            let ratingHistory: any[] = []
            if (ratingRes.ok) { const d = await ratingRes.json(); if (d.status === 'OK') ratingHistory = d.result || [] }
            const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${currentProfile.username}`)
            let submissions: any[] = []
            if (statusRes.ok) { const d = await statusRes.json(); if (d.status === 'OK') submissions = d.result || [] }
            rawData = { user: userData.result[0], ratingHistory, submissions }
          }
        }
      } else if (platform === 'github') {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ githubFull: currentProfile.username }),
        })
        if (res.ok) {
          const json = await res.json()
          rawData = json.user ? json : null
        }
      }

      if (rawData) {
        // Save updated data
        await supabase.from('coding_profiles').update({ raw_json: rawData, fetched_at: new Date().toISOString() })
          .eq('lead_id', currentProfile.lead_id).eq('platform', platform)

        // Re-fetch the profile
        const { data: updated } = await supabase.from('coding_profiles')
          .select('*, students(student_name, college, batch, email, student_username)')
          .eq('lead_id', currentProfile.lead_id).eq('platform', platform).single()

        if (updated?.raw_json) {
          setCurrentProfile({
            ...updated,
            student_name: updated.students?.student_name || '',
            college: updated.students?.college || '',
            batch: updated.students?.batch || '',
            ...(updated.stats || {}),
          })
        }
      }
    } finally {
      setRefreshing(false)
    }
  }

  const rawJson = currentProfile?.raw_json
  const platformDisplay = platform === 'leetcode' ? 'LeetCode' : platform === 'codeforces' ? 'Codeforces' : 'GitHub'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="rounded-2xl shadow-2xl w-full max-w-4xl mx-4 relative" style={{ background: 'var(--color-surface)' }}>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 rounded-t-2xl border-b px-6 py-4 flex items-center justify-between"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{platformDisplay} Profile</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {currentProfile.student_name || currentProfile.username}
              {currentProfile.college && <span className="ml-2">{currentProfile.college}</span>}
              {currentProfile.batch && <span className="ml-2">{currentProfile.batch}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: 'rgba(59,195,226,0.1)', color: 'var(--color-dark-ambient)' }}
              title="Refresh profile data">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button onClick={onClose}
              className="p-2 rounded-lg hover:opacity-80 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {rawJson ? (
            platform === 'leetcode' ? <LCProfileContent data={rawJson} /> :
            platform === 'codeforces' ? <CFProfileContent data={rawJson} /> :
            platform === 'github' ? <GHProfileContent data={rawJson} /> :
            <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Unsupported platform</div>
          ) : (
            <div className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>No profile data available</div>
          )}
        </div>
      </div>
    </div>
  )
}
