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
  recentAcSubmissionList(username: $username, limit: 100) {
    titleSlug
    timestamp
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

// ---- GitHub GraphQL ----

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql'

const GITHUB_QUERY = `
query($username: String!) {
  user(login: $username) {
    login
    name
    bio
    avatarUrl
    createdAt
    followers { totalCount }
    following { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      nodes {
        name
        description
        url
        isFork
        stargazerCount
        forkCount
        primaryLanguage { name }
        updatedAt
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalRepositoryContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
          }
        }
      }
    }
  }
}
`

async function fetchGitHub(username: string) {
  const ghToken = Deno.env.get('GITHUB_TOKEN')
  if (!ghToken) return null

  try {
    const res = await fetch(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${ghToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AlgoArena-Bot',
      },
      body: JSON.stringify({ query: GITHUB_QUERY, variables: { username } }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const ghUser = json.data?.user
    if (!ghUser) return null

    const repos = (ghUser.repositories.nodes || []).map((r: any) => ({
      name: r.name,
      description: r.description,
      fork: r.isFork,
      stargazers_count: r.stargazerCount,
      forks_count: r.forkCount,
      language: r.primaryLanguage?.name || null,
      updated_at: r.updatedAt,
    }))

    const contributions: Record<string, number> = {}
    for (const week of ghUser.contributionsCollection.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        contributions[day.date] = day.contributionCount
      }
    }

    return {
      user: {
        login: ghUser.login,
        name: ghUser.name,
        bio: ghUser.bio,
        avatar_url: ghUser.avatarUrl,
        created_at: ghUser.createdAt,
        public_repos: ghUser.repositories.totalCount,
        followers: ghUser.followers.totalCount,
        following: ghUser.following.totalCount,
      },
      repos,
      events: [],
      contributions,
      graphql_stats: {
        total_commits: ghUser.contributionsCollection.totalCommitContributions + ghUser.contributionsCollection.restrictedContributionsCount,
        total_prs: ghUser.contributionsCollection.totalPullRequestContributions,
        total_issues: ghUser.contributionsCollection.totalIssueContributions,
        total_repos_contributed: ghUser.contributionsCollection.totalRepositoryContributions,
        total_contributions_year: ghUser.contributionsCollection.contributionCalendar.totalContributions,
      },
    }
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

  if (platform === 'github') {
    if (!rawData?.user) return null
    const user = rawData.user
    const repos = rawData.repos || []
    const gql = rawData.graphql_stats || {}

    const langMap: Record<string, number> = {}
    let totalStars = 0
    let totalForks = 0
    for (const r of repos) {
      if (r.fork) continue
      if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1
      totalStars += r.stargazers_count || 0
      totalForks += r.forks_count || 0
    }
    const languages = Object.entries(langMap).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
    const ownRepos = repos.filter((r: any) => !r.fork)

    // Compute streaks from contribution data
    const contributions = rawData.contributions || {}
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    const sortedDates = Object.keys(contributions).sort()
    for (const date of sortedDates) {
      if (contributions[date] > 0) {
        tempStreak++
        if (tempStreak > longestStreak) longestStreak = tempStreak
      } else {
        tempStreak = 0
      }
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

    return {
      public_repos: user.public_repos || 0,
      own_repos: ownRepos.length,
      followers: user.followers || 0,
      following: user.following || 0,
      total_stars: totalStars,
      total_forks: totalForks,
      languages,
      top_repos: ownRepos.slice(0, 6).map((r: any) => ({
        name: r.name,
        description: r.description || '',
        language: r.language || '',
        stars: r.stargazers_count || 0,
        forks: r.forks_count || 0,
        updated: r.updated_at,
      })),
      total_commits: gql.total_commits || 0,
      total_prs: gql.total_prs || 0,
      total_issues: gql.total_issues || 0,
      total_contributions_year: gql.total_contributions_year || 0,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      bio: user.bio || '',
      avatar_url: user.avatar_url || '',
      created_at: user.created_at,
    }
  }

  return {}
}

// ---- Main handler ----

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Process a single profile: fetch, extract stats, save
async function processProfile(
  supabase: any,
  profile: { lead_id: string; platform: string; username: string },
): Promise<{ ok: boolean; msg: string }> {
  const { lead_id, platform, username } = profile
  try {
    let rawData = null
    if (platform === 'leetcode') rawData = await fetchLeetCode(username)
    else if (platform === 'codeforces') rawData = await fetchCodeforces(username)
    else if (platform === 'github') rawData = await fetchGitHub(username)
    else return { ok: false, msg: `[SKIP] ${platform}/${username}: unsupported` }

    if (!rawData) return { ok: false, msg: `[SKIP] ${platform}/${username}: no data` }

    const stats = extractStats(platform, rawData)
    if (!stats) return { ok: false, msg: `[SKIP] ${platform}/${username}: stats extraction failed` }

    const score = platform === 'leetcode'
      ? calculateLeetCodeScore(rawData)
      : platform === 'codeforces'
      ? calculateCodeforcesScore(rawData)
      : 0

    const { error: upsertError } = await supabase
      .from('coding_profiles')
      .update({ score, stats, raw_json: rawData, fetched_at: new Date().toISOString() })
      .eq('lead_id', lead_id)
      .eq('platform', platform)

    if (upsertError) return { ok: false, msg: `[ERR] ${platform}/${username}: ${upsertError.message}` }
    return { ok: true, msg: `[OK] ${platform}/${username}` }
  } catch (err) {
    return { ok: false, msg: `[ERR] ${platform}/${username}: ${(err as Error).message}` }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const TIME_BUDGET_MS = 50_000 // stop after 50s to stay within edge function limits
  const log: string[] = []

  try {
    const body = await req.json().catch(() => ({}))
    const filterPlatform: string | undefined = body.platform // optional: 'leetcode' | 'codeforces' | 'github'
    const batchSize: number = body.batch_size || 10 // how many to process per call
    const offset: number = body.offset || 0

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Load profiles with optional platform filter
    let query = supabase
      .from('coding_profiles')
      .select('lead_id, platform, username')
      .not('username', 'is', null)
      .neq('username', '')

    if (filterPlatform) query = query.eq('platform', filterPlatform)

    const { data: allProfiles, error } = await query
    if (error) throw new Error(`Load profiles: ${error.message}`)

    const profiles = (allProfiles || []).slice(offset, offset + batchSize)
    const totalAll = (allProfiles || []).length
    log.push(`Found ${totalAll} total, processing batch of ${profiles.length} (offset=${offset})`)

    let updated = 0
    let failed = 0

    // Process in groups of 3 concurrently
    const CONCURRENCY = 3
    for (let i = 0; i < profiles.length; i += CONCURRENCY) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        log.push(`[TIMEOUT] Stopped after ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
        break
      }

      const batch = profiles.slice(i, i + CONCURRENCY)
      const results = await Promise.all(batch.map(p => processProfile(supabase, p)))

      for (const r of results) {
        if (r.ok) updated++
        else { failed++; log.push(r.msg) }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const hasMore = offset + batchSize < totalAll
    const summary = {
      total: totalAll,
      processed: profiles.length,
      updated,
      failed,
      offset,
      next_offset: hasMore ? offset + batchSize : null,
      elapsed_seconds: elapsed,
      log,
    }

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
