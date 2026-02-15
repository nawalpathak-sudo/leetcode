const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ---- Username sanitization ----

export function sanitizeUsername(raw) {
  if (!raw) return null
  let u = raw.trim()
  // Strip full URLs: extract last path segment as username
  if (u.includes('leetcode.com') || u.includes('codeforces.com')) {
    const parts = u.replace(/\/+$/, '').split('/')
    u = parts[parts.length - 1] || ''
  }
  // Remove any remaining protocol/url fragments
  u = u.replace(/^https?:\/\/.*/, '')
  // Only allow alphanumeric, underscore, hyphen, dot
  if (!u || !/^[\w.\-]+$/.test(u)) return null
  return u
}

// ---- Platform-specific URL cleaning (for student portal) ----

const PLATFORM_URL_PATTERNS = {
  leetcode: /leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/,
  codeforces: /codeforces\.com\/(?:profile\/)?([a-zA-Z0-9_.-]+)/,
  hackerrank: /hackerrank\.com\/(?:profile\/)?([a-zA-Z0-9_-]+)/,
  codechef: /codechef\.com\/(?:users\/)?([a-zA-Z0-9_]+)/,
  github: /github\.com\/([a-zA-Z0-9_-]+)/,
}

export function cleanPlatformUsername(platform, raw) {
  if (!raw) return { username: null, error: null }
  let u = raw.trim()
  if (!u) return { username: null, error: null }

  // If input looks like a URL, extract username
  if (u.includes('://') || u.includes('.com') || u.includes('.org') || u.includes('.io')) {
    const pattern = PLATFORM_URL_PATTERNS[platform]
    if (pattern) {
      const match = u.match(pattern)
      if (match) {
        u = match[1]
      } else {
        return { username: null, error: 'Could not extract username from URL' }
      }
    }
  }

  // Validate characters
  if (!/^[a-zA-Z0-9_.\-]+$/.test(u)) {
    return { username: null, error: 'Only letters, numbers, underscore, hyphen, dot allowed' }
  }
  if (u.length < 1) return { username: null, error: 'Username too short' }
  if (u.length > 50) return { username: null, error: 'Username too long' }

  return { username: u, error: null }
}

// ---- LeetCode (via Supabase Edge Function — avoids CORS) ----

export async function fetchLeetCodeData(username) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ username }),
    })

    if (!response.ok) {
      console.error(`LeetCode edge fn error: ${response.status} ${response.statusText}`)
      const text = await response.text()
      console.error('Response body:', text)
      return null
    }

    const json = await response.json()
    console.log(`LeetCode [${username}]:`, JSON.stringify(json).slice(0, 200))
    if (json.data?.matchedUser) {
      return json.data
    }
    console.warn(`LeetCode [${username}]: no matchedUser in response`)
    return null
  } catch (err) {
    console.error('LeetCode fetch error:', err)
    return null
  }
}

// ---- LeetCode Problem Details (via same proxy) ----

export async function fetchLeetCodeProblem(titleSlug) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ titleSlug }),
    })

    if (!response.ok) return null

    const json = await response.json()
    const q = json.data?.question
    if (!q) return null

    const stats = q.stats ? JSON.parse(q.stats) : {}
    let similarQuestions = []
    try { similarQuestions = q.similarQuestions ? JSON.parse(q.similarQuestions) : [] } catch {}

    return {
      title: q.title,
      title_slug: q.titleSlug,
      question_id: q.questionFrontendId || q.questionId,
      difficulty: q.difficulty,
      tags: (q.topicTags || []).map(t => t.name),
      ac_rate: q.acRate ? Math.round(q.acRate * 10) / 10 : 0,
      total_accepted: stats.totalAcceptedRaw || 0,
      total_submissions: stats.totalSubmissionRaw || 0,
      likes: q.likes || 0,
      dislikes: q.dislikes || 0,
      hints: q.hints || [],
      similar_questions: similarQuestions,
    }
  } catch (err) {
    console.error('LeetCode problem fetch error:', err)
    return null
  }
}

// ---- GitHub (direct API, no CORS issue) ----

export async function fetchGitHubContributions(username) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ githubUsername: username }),
    })
    if (!response.ok) return null
    const json = await response.json()
    return json.contributions || null
  } catch (err) {
    console.error('GitHub contributions fetch error:', err)
    return null
  }
}

export async function fetchGitHubData(username) {
  try {
    const headers = { 'Accept': 'application/vnd.github.v3+json' }

    const [userRes, reposRes, eventsRes, contributions] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers }),
      fetch(`https://api.github.com/users/${username}/events/public?per_page=100`, { headers }),
      fetchGitHubContributions(username),
    ])

    if (!userRes.ok) return null

    const user = await userRes.json()
    const repos = reposRes.ok ? await reposRes.json() : []
    const events = eventsRes.ok ? await eventsRes.json() : []

    return { user, repos, events, contributions }
  } catch (err) {
    console.error('GitHub fetch error:', err)
    return null
  }
}

// ---- Codeforces (direct API, no CORS issue) ----

export async function fetchCodeforcesData(username) {
  try {
    const userRes = await fetch(`https://codeforces.com/api/user.info?handles=${username}`)
    if (!userRes.ok) return null

    const userData = await userRes.json()
    if (userData.status !== 'OK') return null

    const ratingRes = await fetch(`https://codeforces.com/api/user.rating?handle=${username}`)
    let ratingHistory = []
    if (ratingRes.ok) {
      const ratingData = await ratingRes.json()
      if (ratingData.status === 'OK') ratingHistory = ratingData.result || []
    }

    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${username}`)
    let submissions = []
    if (statusRes.ok) {
      const statusData = await statusRes.json()
      if (statusData.status === 'OK') submissions = statusData.result || []
    }

    return {
      user: userData.result[0],
      ratingHistory,
      submissions,
    }
  } catch (err) {
    console.error('Codeforces fetch error:', err)
    return null
  }
}
