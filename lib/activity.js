// Compute recent submission activity from raw LeetCode/Codeforces API data

function startOfDayUTC(date) {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function daysBetween(a, b) {
  return Math.floor((b - a) / (86400 * 1000))
}

export function computeRecentActivity(rawJson, platform) {
  const now = startOfDayUTC(new Date())
  const result = { yesterday: 0, last7: 0, last30: 0 }

  if (platform === 'leetcode') {
    // Use submissionCalendar (full year of daily counts) for accurate 7/30 day totals
    const calendar = rawJson?.matchedUser?.submissionCalendar
    if (calendar) {
      const calData = typeof calendar === 'string' ? JSON.parse(calendar) : calendar
      for (const [ts, count] of Object.entries(calData)) {
        if (!count) continue
        const day = startOfDayUTC(new Date(parseInt(ts) * 1000))
        const diff = daysBetween(day, now)
        if (diff === 1) result.yesterday += count
        if (diff >= 0 && diff < 7) result.last7 += count
        if (diff >= 0 && diff < 30) result.last30 += count
      }
    } else {
      // Fallback to recentAcSubmissionList if calendar not available
      const acSubs = rawJson?.recentAcSubmissionList || []
      const seenYesterday = new Set()
      const seen7 = new Set()
      const seen30 = new Set()
      for (const sub of acSubs) {
        if (!sub.titleSlug || !sub.timestamp) continue
        const day = startOfDayUTC(new Date(parseInt(sub.timestamp) * 1000))
        const diff = daysBetween(day, now)
        if (diff === 1 && !seenYesterday.has(sub.titleSlug)) { seenYesterday.add(sub.titleSlug); result.yesterday++ }
        if (diff >= 0 && diff < 7 && !seen7.has(sub.titleSlug)) { seen7.add(sub.titleSlug); result.last7++ }
        if (diff >= 0 && diff < 30 && !seen30.has(sub.titleSlug)) { seen30.add(sub.titleSlug); result.last30++ }
      }
    }
  }

  if (platform === 'codeforces') {
    const subs = rawJson?.submissions || []
    const seen7 = new Set()
    const seen30 = new Set()
    const seenYesterday = new Set()

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
      if (diff === 1) result.yesterday += count
      if (diff >= 0 && diff < 7) result.last7 += count
      if (diff >= 0 && diff < 30) result.last30 += count
    }
  }

  return result
}

// Aggregate activity across multiple students
export function aggregateActivity(activities) {
  const agg = { yesterday: 0, last7: 0, last30: 0 }
  for (const a of activities) {
    agg.yesterday += a.yesterday
    agg.last7 += a.last7
    agg.last30 += a.last30
  }
  return agg
}

// Count how many students were active in each period
export function activeStudentCounts(activities) {
  return {
    yesterday: activities.filter(a => a.yesterday > 0).length,
    last7: activities.filter(a => a.last7 > 0).length,
    last30: activities.filter(a => a.last30 > 0).length,
  }
}
