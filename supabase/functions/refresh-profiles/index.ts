import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ---- LeetCode GraphQL ----

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql'

const LEETCODE_QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      ranking
      reputation
      starRating
      realName
      aboutMe
      userAvatar
      skillTags
      countryName
    }
    submitStats {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
      totalSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    submissionCalendar
    badges {
      id
      displayName
      icon
      creationDate
    }
    upcomingBadges {
      name
      icon
    }
  }
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
  }
  userContestRankingHistory(username: $username) {
    attended
    rating
    ranking
    contest {
      title
      startTime
    }
  }
  recentSubmissionList(username: $username, limit: 20) {
    title
    titleSlug
    timestamp
    statusDisplay
    lang
  }
  matchedUserStats: matchedUser(username: $username) {
    submitStatsGlobal {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
}
`

async function fetchLeetCode(username: string) {
  try {
    const res = await fetch(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://leetcode.com',
        'Origin': 'https://leetcode.com',
      },
      body: JSON.stringify({ query: LEETCODE_QUERY, variables: { username } }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.matchedUser ? json.data : null
  } catch {
    return null
  }
}

// ---- Codeforces API ----

async function fetchCodeforces(username: string) {
  try {
    const userRes = await fetch(`https://codeforces.com/api/user.info?handles=${username}`)
    if (!userRes.ok) return null
    const userData = await userRes.json()
    if (userData.status !== 'OK') return null

    const ratingRes = await fetch(`https://codeforces.com/api/user.rating?handle=${username}`)
    let ratingHistory: unknown[] = []
    if (ratingRes.ok) {
      const rd = await ratingRes.json()
      if (rd.status === 'OK') ratingHistory = rd.result || []
    }

    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${username}`)
    let submissions: unknown[] = []
    if (statusRes.ok) {
      const sd = await statusRes.json()
      if (sd.status === 'OK') submissions = sd.result || []
    }

    return { user: userData.result[0], ratingHistory, submissions }
  } catch {
    return null
  }
}

// ---- Scoring (mirrors src/lib/scoring.js exactly) ----

function calculateLeetCodeScore(data: any): number {
  if (!data?.matchedUser) return 0
  const user = data.matchedUser
  const contest = data.userContestRanking

  const solvedStats: Record<string, number> = {}
  for (const item of user.submitStats.acSubmissionNum) {
    solvedStats[item.difficulty] = item.count
  }
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

function calculateCodeforcesScore(data: any): number {
  if (!data?.user) return 0
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
      if (problem.contestId && problem.index) {
        solvedProblems.add(`${problem.contestId}-${problem.index}`)
      }
    }
  }
  const problemScore = Math.min(solvedProblems.size * 2, 200)

  const rankScores: Record<string, number> = {
    'legendary grandmaster': 100, 'international grandmaster': 95,
    grandmaster: 90, 'international master': 80, master: 70,
    'candidate master': 60, expert: 50, specialist: 40, pupil: 30, newbie: 20,
  }
  const rank = (user.rank || '').toLowerCase()
  const rankScore = rankScores[rank] || 10

  return Math.round((ratingScore + contestScore + problemScore + rankScore) * 100) / 100
}

// ---- Stats extraction (mirrors src/lib/db.js extractStats) ----

function extractStats(platform: string, rawData: any) {
  if (platform === 'leetcode') {
    if (!rawData?.matchedUser) return null
    const user = rawData.matchedUser
    const contest = rawData.userContestRanking
    const solvedStats: Record<string, number> = {}
    for (const item of user.submitStats.acSubmissionNum) {
      solvedStats[item.difficulty] = item.count
    }
    const easy = solvedStats.Easy || 0
    const medium = solvedStats.Medium || 0
    const hard = solvedStats.Hard || 0
    return {
      easy, medium, hard,
      total_solved: easy + medium + hard,
      contest_rating: contest?.rating ? Math.round(contest.rating * 100) / 100 : 0,
      contests_attended: contest?.attendedContestsCount || 0,
      global_ranking: user.profile?.ranking || 0,
    }
  }

  if (platform === 'codeforces') {
    if (!rawData?.user) return null
    const user = rawData.user
    const ratingHistory = rawData.ratingHistory || []
    const submissions = rawData.submissions || []
    const solvedProblems = new Set<string>()
    const problemRatings: number[] = []
    for (const sub of submissions) {
      if (sub.verdict === 'OK') {
        const problem = sub.problem || {}
        if (problem.contestId && problem.index) {
          solvedProblems.add(`${problem.contestId}-${problem.index}`)
          if (problem.rating) problemRatings.push(problem.rating)
        }
      }
    }
    return {
      rating: user.rating || 0,
      max_rating: user.maxRating || user.rating || 0,
      rank: user.rank || 'unrated',
      problems_solved: solvedProblems.size,
      contests_attended: ratingHistory.length,
      avg_problem_rating: problemRatings.length
        ? Math.round(problemRatings.reduce((a: number, b: number) => a + b, 0) / problemRatings.length) : 0,
    }
  }

  return {}
}

// ---- Main handler ----

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const log: string[] = []

  try {
    // Use service role key for full DB access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Load all profiles that have usernames
    const { data: profiles, error } = await supabase
      .from('coding_profiles')
      .select('lead_id, platform, username')
      .not('username', 'is', null)
      .neq('username', '')

    if (error) throw new Error(`Load profiles: ${error.message}`)

    const total = (profiles || []).length
    log.push(`Found ${total} profiles to refresh`)

    let updated = 0
    let failed = 0

    for (const profile of (profiles || [])) {
      const { lead_id, platform, username } = profile

      try {
        let rawData = null

        if (platform === 'leetcode') {
          rawData = await fetchLeetCode(username)
        } else if (platform === 'codeforces') {
          rawData = await fetchCodeforces(username)
        } else {
          continue // skip non-scored platforms
        }

        if (!rawData) {
          log.push(`[SKIP] ${platform}/${username}: no data`)
          failed++
          continue
        }

        const stats = extractStats(platform, rawData)
        if (!stats) {
          log.push(`[SKIP] ${platform}/${username}: stats extraction failed`)
          failed++
          continue
        }

        const score = platform === 'leetcode'
          ? calculateLeetCodeScore(rawData)
          : calculateCodeforcesScore(rawData)

        const { error: upsertError } = await supabase
          .from('coding_profiles')
          .update({
            score,
            stats,
            raw_json: rawData,
            fetched_at: new Date().toISOString(),
          })
          .eq('lead_id', lead_id)
          .eq('platform', platform)

        if (upsertError) {
          log.push(`[ERR] ${platform}/${username}: ${upsertError.message}`)
          failed++
        } else {
          updated++
        }

        // Rate limit: small delay between requests
        await new Promise(r => setTimeout(r, 500))
      } catch (err) {
        log.push(`[ERR] ${platform}/${username}: ${(err as Error).message}`)
        failed++
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const summary = { total, updated, failed, elapsed_seconds: elapsed, log }

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message, log }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
