import { useState, useMemo } from 'react'

const CELL = 11
const GAP = 2
const SIZE = CELL + GAP
const LEFT_PAD = 28
const TOP_PAD = 18
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtNice(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function blendWithWhite(hex, opacity) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `rgb(${Math.round(r*opacity+255*(1-opacity))},${Math.round(g*opacity+255*(1-opacity))},${Math.round(b*opacity+255*(1-opacity))})`
}

function extractDayMap(rawJson, platform) {
  const dayMap = {}

  if (platform === 'leetcode') {
    // Primary: submissionCalendar (JSON string of { timestamp: count })
    const cal = rawJson?.matchedUser?.submissionCalendar
    if (cal) {
      try {
        const parsed = typeof cal === 'string' ? JSON.parse(cal) : cal
        for (const [ts, count] of Object.entries(parsed)) {
          const d = new Date(parseInt(ts) * 1000)
          const key = fmt(d)
          dayMap[key] = (dayMap[key] || 0) + count
        }
      } catch { /* ignore parse errors */ }
    }
    // Fallback: recentSubmissionList (sparse)
    if (Object.keys(dayMap).length === 0 && rawJson?.recentSubmissionList) {
      for (const sub of rawJson.recentSubmissionList) {
        if (sub.timestamp) {
          const d = new Date(parseInt(sub.timestamp) * 1000)
          const key = fmt(d)
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
        const key = fmt(d)
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

function computeStats(dayMap, start, today) {
  const totalSubmissions = Object.values(dayMap).reduce((a, b) => a + b, 0)
  let activeDays = 0
  let maxStreak = 0
  let curStreak = 0

  const d = new Date(start)
  while (d <= today) {
    const key = fmt(d)
    if (dayMap[key]) {
      activeDays++
      curStreak++
      if (curStreak > maxStreak) maxStreak = curStreak
    } else {
      curStreak = 0
    }
    d.setDate(d.getDate() + 1)
  }

  return { totalSubmissions, activeDays, maxStreak }
}

export default function SubmissionHeatmap({ rawJson, platform, color, platformName }) {
  const [hover, setHover] = useState(null)

  const { weeks, monthLabels, stats, dayMap, hasData } = useMemo(() => {
    const dayMap = extractDayMap(rawJson, platform)
    if (Object.keys(dayMap).length === 0) return { weeks: [], monthLabels: [], stats: {}, dayMap, hasData: false }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const start = new Date(today)
    start.setDate(start.getDate() - 364)
    start.setDate(start.getDate() - start.getDay()) // Align to Sunday

    const weeks = []
    const cur = new Date(start)
    while (cur <= today) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(cur)
        cellDate.setDate(cellDate.getDate() + d)
        if (cellDate > today) {
          week.push(null)
        } else {
          const key = fmt(cellDate)
          week.push({ date: key, count: dayMap[key] || 0 })
        }
      }
      weeks.push(week)
      cur.setDate(cur.getDate() + 7)
    }

    // Month labels
    const monthLabels = []
    let lastMonth = -1
    weeks.forEach((week, wi) => {
      const firstDay = week.find(d => d)
      if (firstDay) {
        const month = new Date(firstDay.date + 'T00:00:00').getMonth()
        if (month !== lastMonth) {
          monthLabels.push({ text: MONTHS[month], x: LEFT_PAD + wi * SIZE })
          lastMonth = month
        }
      }
    })

    const stats = computeStats(dayMap, start, today)
    return { weeks, monthLabels, stats, dayMap, hasData: true }
  }, [rawJson, platform])

  if (!hasData) return null

  // Color scale: 4 levels based on platform color
  const colors = [
    '#ebedf0',
    blendWithWhite(color, 0.25),
    blendWithWhite(color, 0.5),
    blendWithWhite(color, 0.75),
    color,
  ]

  // Determine thresholds based on max count
  const maxCount = Math.max(1, ...Object.values(dayMap))
  const getLevel = (count) => {
    if (count === 0) return 0
    if (count <= Math.ceil(maxCount * 0.25)) return 1
    if (count <= Math.ceil(maxCount * 0.5)) return 2
    if (count <= Math.ceil(maxCount * 0.75)) return 3
    return 4
  }

  const svgWidth = LEFT_PAD + weeks.length * SIZE + 4
  const svgHeight = TOP_PAD + 7 * SIZE + 4

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-6">
      <h3 className="font-bold text-primary mb-1 flex items-center gap-2">
        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
        {platformName || platform} — Submission Activity
      </h3>
      <p className="text-primary/40 text-sm mb-4">
        {stats.totalSubmissions} submission{stats.totalSubmissions !== 1 ? 's' : ''} in the past year
        <span className="mx-2">·</span>
        Active days: {stats.activeDays}
        <span className="mx-2">·</span>
        Max streak: {stats.maxStreak}
      </p>

      <div className="overflow-x-auto relative" onMouseLeave={() => setHover(null)}>
        <svg width={svgWidth} height={svgHeight} className="block">
          {/* Month labels */}
          {monthLabels.map((m, i) => (
            <text key={i} x={m.x} y={11} fontSize={10} fill="#94a3b8" fontFamily="system-ui">{m.text}</text>
          ))}

          {/* Day labels */}
          <text x={0} y={TOP_PAD + 1 * SIZE + CELL * 0.75} fontSize={9} fill="#94a3b8" fontFamily="system-ui">Mon</text>
          <text x={0} y={TOP_PAD + 3 * SIZE + CELL * 0.75} fontSize={9} fill="#94a3b8" fontFamily="system-ui">Wed</text>
          <text x={0} y={TOP_PAD + 5 * SIZE + CELL * 0.75} fontSize={9} fill="#94a3b8" fontFamily="system-ui">Fri</text>

          {/* Cells */}
          {weeks.map((week, wi) =>
            week.map((day, di) => day && (
              <rect
                key={`${wi}-${di}`}
                x={LEFT_PAD + wi * SIZE}
                y={TOP_PAD + di * SIZE}
                width={CELL}
                height={CELL}
                rx={2}
                fill={colors[getLevel(day.count)]}
                className="transition-opacity"
                style={{ cursor: 'default' }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setHover({ date: day.date, count: day.count, x: rect.left + rect.width / 2, y: rect.top })
                }}
              >
                <title>{`${fmtNice(day.date)}: ${day.count} submission${day.count !== 1 ? 's' : ''}`}</title>
              </rect>
            ))
          )}
        </svg>

        {/* Floating tooltip */}
        {hover && (
          <div
            className="fixed z-50 pointer-events-none px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap"
            style={{ left: hover.x, top: hover.y - 36, transform: 'translateX(-50%)' }}
          >
            {hover.count} submission{hover.count !== 1 ? 's' : ''} on {fmtNice(hover.date)}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-3 justify-end text-xs text-primary/40">
        <span>Less</span>
        {colors.map((c, i) => (
          <div key={i} className="w-[11px] h-[11px] rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
