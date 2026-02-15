#!/usr/bin/env node
// One-time script to refresh all LeetCode & Codeforces profiles
// Usage: node refresh-now.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ifkkhwumimawacqaujop.supabase.co'
const SERVICE_KEY = process.argv[2] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlma2tod3VtaW1hd2FjcWF1am9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5MTc1OSwiZXhwIjoyMDg2NDY3NzU5fQ.BB3cqEO73Oot2ovkPRZ8l3eTxnq7ltJB1PtMmbh98RQ'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlma2tod3VtaW1hd2FjcWF1am9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4OTE3NTksImV4cCI6MjA4NjQ2Nzc1OX0.rmPKoWFi1iJLHyb1ozHgqI75t51alDwTqZZGcnBZu1I'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ---- Scoring (mirrors src/lib/scoring.js) ----

function calcLeetCodeScore(data) {
  if (!data?.matchedUser) return 0
  const user = data.matchedUser
  const contest = data.userContestRanking
  const s = {}
  for (const item of user.submitStats.acSubmissionNum) s[item.difficulty] = item.count
  const easy = s.Easy || 0, medium = s.Medium || 0, hard = s.Hard || 0
  const problemScore = Math.min(((easy * 1) + (medium * 3) + (hard * 5)) / 10, 400)
  const contestScore = contest?.rating ? Math.min(contest.rating / 10, 300) : 0
  const consistencyScore = Math.min((contest?.attendedContestsCount || 0) * 2, 200)
  const ranking = user.profile?.ranking
  const rankingScore = !ranking ? 0 : ranking <= 1000 ? 100 : ranking <= 10000 ? 80 : ranking <= 50000 ? 60 : ranking <= 100000 ? 40 : 20
  return Math.round((problemScore + contestScore + consistencyScore + rankingScore) * 100) / 100
}

function calcCodeforcesScore(data) {
  if (!data?.user) return 0
  const user = data.user
  const ratingHistory = data.ratingHistory || []
  const submissions = data.submissions || []
  const ratingScore = Math.min((user.maxRating || user.rating || 0) / 7.5, 400)
  const contestScore = Math.min(ratingHistory.length * 3, 300)
  const solved = new Set()
  for (const sub of submissions) {
    if (sub.verdict === 'OK' && sub.problem?.contestId && sub.problem?.index)
      solved.add(`${sub.problem.contestId}-${sub.problem.index}`)
  }
  const problemScore = Math.min(solved.size * 2, 200)
  const rankScores = { 'legendary grandmaster': 100, 'international grandmaster': 95, grandmaster: 90, 'international master': 80, master: 70, 'candidate master': 60, expert: 50, specialist: 40, pupil: 30, newbie: 20 }
  const rankScore = rankScores[(user.rank || '').toLowerCase()] || 10
  return Math.round((ratingScore + contestScore + problemScore + rankScore) * 100) / 100
}

function extractStats(platform, rawData) {
  if (platform === 'leetcode') {
    if (!rawData?.matchedUser) return null
    const user = rawData.matchedUser
    const contest = rawData.userContestRanking
    const s = {}
    for (const item of user.submitStats.acSubmissionNum) s[item.difficulty] = item.count
    const easy = s.Easy || 0, medium = s.Medium || 0, hard = s.Hard || 0
    const solvedSlugs = [...new Set([
      ...(rawData.recentAcSubmissionList || []).map(x => x.titleSlug),
      ...(rawData.recentSubmissionList || []).filter(x => x.statusDisplay === 'Accepted').map(x => x.titleSlug),
    ])]
    return {
      easy, medium, hard, total_solved: easy + medium + hard,
      contest_rating: contest?.rating ? Math.round(contest.rating * 100) / 100 : 0,
      contests_attended: contest?.attendedContestsCount || 0,
      global_ranking: user.profile?.ranking || 0,
      solved_slugs: solvedSlugs,
    }
  }
  if (platform === 'codeforces') {
    if (!rawData?.user) return null
    const user = rawData.user
    const ratingHistory = rawData.ratingHistory || []
    const submissions = rawData.submissions || []
    const solved = new Set()
    const ratings = []
    for (const sub of submissions) {
      if (sub.verdict === 'OK' && sub.problem?.contestId && sub.problem?.index) {
        solved.add(`${sub.problem.contestId}-${sub.problem.index}`)
        if (sub.problem.rating) ratings.push(sub.problem.rating)
      }
    }
    return {
      rating: user.rating || 0, max_rating: user.maxRating || user.rating || 0,
      rank: user.rank || 'unrated', problems_solved: solved.size,
      contests_attended: ratingHistory.length,
      avg_problem_rating: ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0,
    }
  }
  return {}
}

// ---- API fetchers ----

async function fetchLeetCode(username) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ username }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.matchedUser ? json.data : null
  } catch { return null }
}

async function fetchCodeforces(username) {
  try {
    const userRes = await fetch(`https://codeforces.com/api/user.info?handles=${username}`)
    if (!userRes.ok) return null
    const userData = await userRes.json()
    if (userData.status !== 'OK') return null

    const ratingRes = await fetch(`https://codeforces.com/api/user.rating?handle=${username}`)
    const ratingHistory = ratingRes.ok ? ((await ratingRes.json()).result || []) : []

    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${username}`)
    const submissions = statusRes.ok ? ((await statusRes.json()).result || []) : []

    return { user: userData.result[0], ratingHistory, submissions }
  } catch { return null }
}

// ---- Main ----

async function main() {
  const { data: profiles, error } = await supabase
    .from('coding_profiles')
    .select('lead_id, platform, username')
    .not('username', 'is', null)
    .neq('username', '')

  if (error) { console.error('Load profiles failed:', error.message); process.exit(1) }

  const list = (profiles || []).filter(p => p.platform === 'leetcode' || p.platform === 'codeforces')
  console.log(`Found ${list.length} profiles to refresh\n`)

  let updated = 0, failed = 0

  for (const profile of list) {
    const { lead_id, platform, username } = profile
    process.stdout.write(`[${platform}] ${username}... `)

    const rawData = platform === 'leetcode' ? await fetchLeetCode(username) : await fetchCodeforces(username)

    if (!rawData) { console.log('SKIP (no data)'); failed++; continue }

    const stats = extractStats(platform, rawData)
    if (!stats) { console.log('SKIP (stats failed)'); failed++; continue }

    const score = platform === 'leetcode' ? calcLeetCodeScore(rawData) : calcCodeforcesScore(rawData)

    const { error: uErr } = await supabase
      .from('coding_profiles')
      .update({ score, stats, raw_json: rawData, fetched_at: new Date().toISOString() })
      .eq('lead_id', lead_id)
      .eq('platform', platform)

    if (uErr) { console.log(`ERR: ${uErr.message}`); failed++ }
    else { console.log(`OK (score: ${score})`); updated++ }

    // Rate limit
    await new Promise(r => setTimeout(r, 600))
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`)
}

main()
