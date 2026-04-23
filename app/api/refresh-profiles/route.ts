import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql'

const LEETCODE_QUERY = `
query getUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile { ranking reputation starRating realName aboutMe userAvatar skillTags countryName }
    submitStats {
      acSubmissionNum { difficulty count submissions }
      totalSubmissionNum { difficulty count submissions }
    }
    submissionCalendar
    badges { id displayName icon creationDate }
    upcomingBadges { name icon }
  }
  userContestRanking(username: $username) {
    attendedContestsCount rating globalRanking totalParticipants topPercentage
  }
  userContestRankingHistory(username: $username) {
    attended rating ranking contest { title startTime }
  }
  recentSubmissionList(username: $username, limit: 20) {
    title titleSlug timestamp statusDisplay lang
  }
  recentAcSubmissionList(username: $username, limit: 100) {
    titleSlug timestamp
  }
  matchedUserStats: matchedUser(username: $username) {
    submitStatsGlobal { acSubmissionNum { difficulty count } }
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

async function fetchGitHub(username: string) {
  const ghToken = process.env.GITHUB_TOKEN
  if (!ghToken) return null

  const GITHUB_QUERY = `
  query($username: String!) {
    user(login: $username) {
      login name bio avatarUrl createdAt
      followers { totalCount } following { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
        totalCount
        nodes { name description url isFork stargazerCount forkCount primaryLanguage { name } updatedAt }
      }
      contributionsCollection {
        totalCommitContributions totalPullRequestContributions totalIssueContributions
        totalRepositoryContributions restrictedContributionsCount
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
      }
    }
  }`

  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Authorization': `bearer ${ghToken}`, 'Content-Type': 'application/json', 'User-Agent': 'AlgoArena-Bot' },
      body: JSON.stringify({ query: GITHUB_QUERY, variables: { username } }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const u = json.data?.user
    if (!u) return null

    const repos = (u.repositories.nodes || []).map((r: any) => ({
      name: r.name, description: r.description, fork: r.isFork,
      stargazers_count: r.stargazerCount, forks_count: r.forkCount,
      language: r.primaryLanguage?.name || null, updated_at: r.updatedAt,
    }))

    const contributions: Record<string, number> = {}
    for (const week of u.contributionsCollection.contributionCalendar.weeks)
      for (const day of week.contributionDays) contributions[day.date] = day.contributionCount

    return {
      user: {
        login: u.login, name: u.name, bio: u.bio, avatar_url: u.avatarUrl,
        created_at: u.createdAt, public_repos: u.repositories.totalCount,
        followers: u.followers.totalCount, following: u.following.totalCount,
      },
      repos, events: [], contributions,
      graphql_stats: {
        total_commits: u.contributionsCollection.totalCommitContributions + u.contributionsCollection.restrictedContributionsCount,
        total_prs: u.contributionsCollection.totalPullRequestContributions,
        total_issues: u.contributionsCollection.totalIssueContributions,
        total_repos_contributed: u.contributionsCollection.totalRepositoryContributions,
        total_contributions_year: u.contributionsCollection.contributionCalendar.totalContributions,
      },
    }
  } catch {
    return null
  }
}

// ---- Scoring ----

function calculateLeetCodeScore(data: any): number {
  if (!data?.matchedUser) return 0
  const user = data.matchedUser
  const contest = data.userContestRanking
  const solvedStats: Record<string, number> = {}
  for (const item of user.submitStats.acSubmissionNum) solvedStats[item.difficulty] = item.count
  const easy = solvedStats.Easy || 0, medium = solvedStats.Medium || 0, hard = solvedStats.Hard || 0

  const problemScore = Math.min(((easy * 1) + (medium * 3) + (hard * 5)) / 10, 400)
  const contestScore = contest?.rating ? Math.min(contest.rating / 10, 300) : 0
  const consistencyScore = Math.min((contest?.attendedContestsCount || 0) * 2, 200)
  const ranking = user.profile?.ranking
  const rankingScore = !ranking ? 0 : ranking <= 1000 ? 100 : ranking <= 10000 ? 80 : ranking <= 50000 ? 60 : ranking <= 100000 ? 40 : 20

  return Math.round((problemScore + contestScore + consistencyScore + rankingScore) * 100) / 100
}

function calculateCodeforcesScore(data: any): number {
  if (!data?.user) return 0
  const { user, ratingHistory = [], submissions = [] } = data
  const ratingScore = Math.min((user.maxRating || user.rating || 0) / 7.5, 400)
  const contestScore = Math.min(ratingHistory.length * 3, 300)
  const solved = new Set<string>()
  for (const sub of submissions) {
    if (sub.verdict === 'OK' && sub.problem?.contestId && sub.problem?.index)
      solved.add(`${sub.problem.contestId}-${sub.problem.index}`)
  }
  const problemScore = Math.min(solved.size * 2, 200)
  const rankScores: Record<string, number> = {
    'legendary grandmaster': 100, 'international grandmaster': 95, grandmaster: 90,
    'international master': 80, master: 70, 'candidate master': 60,
    expert: 50, specialist: 40, pupil: 30, newbie: 20,
  }
  const rankScore = rankScores[(user.rank || '').toLowerCase()] || 10

  return Math.round((ratingScore + contestScore + problemScore + rankScore) * 100) / 100
}

// ---- Stats extraction ----

function extractStats(platform: string, rawData: any) {
  if (platform === 'leetcode') {
    if (!rawData?.matchedUser) return null
    const user = rawData.matchedUser
    const contest = rawData.userContestRanking
    const solvedStats: Record<string, number> = {}
    for (const item of user.submitStats.acSubmissionNum) solvedStats[item.difficulty] = item.count
    const easy = solvedStats.Easy || 0, medium = solvedStats.Medium || 0, hard = solvedStats.Hard || 0
    return {
      easy, medium, hard, total_solved: easy + medium + hard,
      contest_rating: contest?.rating ? Math.round(contest.rating * 100) / 100 : 0,
      contests_attended: contest?.attendedContestsCount || 0,
      global_ranking: user.profile?.ranking || 0,
    }
  }

  if (platform === 'codeforces') {
    if (!rawData?.user) return null
    const { user, ratingHistory = [], submissions = [] } = rawData
    const solved = new Set<string>()
    for (const sub of submissions) {
      if (sub.verdict === 'OK' && sub.problem?.contestId && sub.problem?.index)
        solved.add(`${sub.problem.contestId}-${sub.problem.index}`)
    }
    return {
      rating: user.rating || 0, max_rating: user.maxRating || user.rating || 0,
      rank: user.rank || 'unrated', problems_solved: solved.size,
      contests_attended: ratingHistory.length, contribution: user.contribution || 0,
    }
  }

  if (platform === 'github') {
    if (!rawData?.user) return null
    const { user, repos = [], graphql_stats: gql = {} } = rawData
    let totalStars = 0, totalForks = 0
    const ownRepos = repos.filter((r: any) => !r.fork)
    for (const r of ownRepos) { totalStars += r.stargazers_count || 0; totalForks += r.forks_count || 0 }
    return {
      public_repos: user.public_repos || 0, own_repos: ownRepos.length,
      followers: user.followers || 0, total_stars: totalStars, total_forks: totalForks,
      total_commits: gql.total_commits || 0, total_prs: gql.total_prs || 0,
      total_contributions_year: gql.total_contributions_year || 0,
    }
  }

  return null
}

// ---- Process single profile ----

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

    const score = platform === 'leetcode' ? calculateLeetCodeScore(rawData)
      : platform === 'codeforces' ? calculateCodeforcesScore(rawData) : 0

    const { error } = await supabase
      .from('coding_profiles')
      .update({ score, stats, raw_json: rawData, fetched_at: new Date().toISOString() })
      .eq('lead_id', lead_id)
      .eq('platform', platform)

    if (error) return { ok: false, msg: `[ERR] ${platform}/${username}: ${error.message}` }

    // Monthly snapshot
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const snapshotRow: Record<string, unknown> = {
      lead_id, platform, month, score,
      cumulative_total: (stats as any).total_solved ?? (stats as any).problems_solved ?? 0,
      easy: (stats as any).easy ?? 0, medium: (stats as any).medium ?? 0, hard: (stats as any).hard ?? 0,
    }

    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime() / 1000
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).getTime() / 1000

    if (platform === 'leetcode' && rawData.recentAcSubmissionList) {
      const slugs = new Set<string>()
      for (const sub of rawData.recentAcSubmissionList) {
        const ts = parseInt(sub.timestamp)
        if (ts >= monthStart && ts < monthEnd) slugs.add(sub.titleSlug)
      }
      snapshotRow.new_problems = slugs.size
    }

    if (platform === 'codeforces' && rawData.submissions) {
      const solved = new Set<string>()
      for (const sub of rawData.submissions) {
        if (sub.verdict !== 'OK') continue
        const p = sub.problem
        if (p?.contestId && p?.index) {
          if (sub.creationTimeSeconds >= monthStart && sub.creationTimeSeconds < monthEnd)
            solved.add(`${p.contestId}-${p.index}`)
        }
      }
      snapshotRow.new_problems = solved.size
    }

    await supabase.from('profile_snapshots').upsert(snapshotRow, { onConflict: 'lead_id,platform,month' })

    return { ok: true, msg: `[OK] ${platform}/${username}` }
  } catch (err) {
    return { ok: false, msg: `[ERR] ${platform}/${username}: ${(err as Error).message}` }
  }
}

// ---- Route handler ----

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const platform = req.nextUrl.searchParams.get('platform') || undefined
  const batchSize = parseInt(req.nextUrl.searchParams.get('batch_size') || '50')
  const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0')

  const supabase = createAdminClient()
  const startTime = Date.now()
  const TIME_BUDGET_MS = 55_000 // Vercel Pro = 60s, leave 5s buffer
  const log: string[] = []

  try {
    let query = supabase
      .from('coding_profiles')
      .select('lead_id, platform, username')
      .not('username', 'is', null)
      .neq('username', '')

    if (platform) query = query.eq('platform', platform)

    const { data: allProfiles, error } = await query
    if (error) throw new Error(`Load profiles: ${error.message}`)

    const profiles = (allProfiles || []).slice(offset, offset + batchSize)
    const totalAll = (allProfiles || []).length
    log.push(`Found ${totalAll} total, processing ${profiles.length} (offset=${offset})`)

    let updated = 0, failed = 0

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

    const hasMore = offset + batchSize < totalAll

    // Auto-chain next batch
    if (hasMore) {
      const nextOffset = offset + batchSize
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : req.nextUrl.origin
      log.push(`[CHAIN] Triggering next batch at offset=${nextOffset}`)
      try {
        const params = new URLSearchParams({ batch_size: String(batchSize), offset: String(nextOffset) })
        if (platform) params.set('platform', platform)
        fetch(`${baseUrl}/api/refresh-profiles?${params}`, {
          headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
        }).catch(() => {}) // fire and forget
      } catch {}
    }

    return NextResponse.json({
      total: totalAll, processed: profiles.length, updated, failed,
      offset, next_offset: hasMore ? offset + batchSize : null,
      elapsed_seconds: ((Date.now() - startTime) / 1000).toFixed(1), log,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, log }, { status: 500 })
  }
}
