import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql'
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

// Fetch problem details by titleSlug
const PROBLEM_QUERY = `
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    title
    titleSlug
    difficulty
    acRate
    stats
    likes
    dislikes
    topicTags {
      name
    }
    hints
    similarQuestions
  }
}
`

// Matches the exact Python query from leetcode.py
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.ok || i === retries - 1) return res
      if ([429, 500, 502, 503, 504].includes(res.status)) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)))
        continue
      }
      return res
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise(r => setTimeout(r, 2000 * (i + 1)))
    }
  }
  throw new Error('Max retries reached')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { username, titleSlug, githubUsername, githubFull } = body

    // GitHub full profile via GraphQL API
    if (githubFull) {
      const ghToken = Deno.env.get('GITHUB_TOKEN')

      if (ghToken) {
        // GraphQL path: accurate commits, contributions calendar, repos
        const ghRes = await fetchWithRetry(GITHUB_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            'Authorization': `bearer ${ghToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'AlgoArena-Bot',
          },
          body: JSON.stringify({ query: GITHUB_QUERY, variables: { username: githubFull } }),
        })

        const ghJson = await ghRes.json()
        const ghUser = ghJson.data?.user
        if (!ghUser) {
          return new Response(JSON.stringify({ error: 'GitHub user not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

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

        return new Response(JSON.stringify({
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
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Fallback: REST API from edge function (no token configured)
      const ghHeaders = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'AlgoArena-Bot' }
      const [userRes, reposRes, contribRes] = await Promise.all([
        fetchWithRetry(`https://api.github.com/users/${encodeURIComponent(githubFull)}`, { headers: ghHeaders }),
        fetchWithRetry(`https://api.github.com/users/${encodeURIComponent(githubFull)}/repos?per_page=100&sort=updated`, { headers: ghHeaders }),
        fetchWithRetry(`https://github.com/users/${encodeURIComponent(githubFull)}/contributions`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
        }),
      ])

      if (!userRes.ok) {
        return new Response(JSON.stringify({ error: 'GitHub user not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const user = await userRes.json()
      const repos = reposRes.ok ? await reposRes.json() : []

      // Parse contributions from HTML
      const html = await contribRes.text()
      const contributions: Record<string, number> = {}
      const cellRegex = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g
      let match
      while ((match = cellRegex.exec(html)) !== null) {
        const date = match[1]
        const level = parseInt(match[2])
        if (level === 0) { contributions[date] = 0; continue }
        const ahead = html.substring(match.index, match.index + 500)
        const countMatch = ahead.match(/(\d+)\s+contributions?/)
        contributions[date] = countMatch ? parseInt(countMatch[1]) : level
      }

      return new Response(JSON.stringify({ user, repos, events: [], contributions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // GitHub contributions-only endpoint (legacy)
    if (githubUsername) {
      const res = await fetchWithRetry(
        `https://github.com/users/${encodeURIComponent(githubUsername)}/contributions`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html',
          },
        }
      )
      const html = await res.text()
      const contributions: Record<string, number> = {}

      // Extract data-date and data-level from each calendar cell
      // Then look ahead for the exact count in the tooltip/span text
      const cellRegex = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g
      let match
      while ((match = cellRegex.exec(html)) !== null) {
        const date = match[1]
        const level = parseInt(match[2])
        if (level === 0) { contributions[date] = 0; continue }

        // Look ahead up to 500 chars for the exact count in tooltip text
        const ahead = html.substring(match.index, match.index + 500)
        const countMatch = ahead.match(/(\d+)\s+contributions?/)
        contributions[date] = countMatch ? parseInt(countMatch[1]) : level
      }

      return new Response(JSON.stringify({ contributions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!username && !titleSlug) {
      return new Response(JSON.stringify({ error: 'username, titleSlug, or githubUsername required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const query = titleSlug ? PROBLEM_QUERY : LEETCODE_QUERY
    const variables = titleSlug ? { titleSlug } : { username }

    // Fetch CSRF token from LeetCode first
    let csrfToken = ''
    try {
      const initRes = await fetch('https://leetcode.com/', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })
      const cookies = initRes.headers.get('set-cookie') || ''
      const csrfMatch = cookies.match(/csrftoken=([^;]+)/)
      if (csrfMatch) csrfToken = csrfMatch[1]
    } catch {}

    const graphqlHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://leetcode.com',
      'Origin': 'https://leetcode.com',
    }
    if (csrfToken) {
      graphqlHeaders['x-csrftoken'] = csrfToken
      graphqlHeaders['Cookie'] = `csrftoken=${csrfToken}`
    }

    const response = await fetchWithRetry(LEETCODE_GRAPHQL_URL, {
      method: 'POST',
      headers: graphqlHeaders,
      body: JSON.stringify({ query, variables }),
    })

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      // GraphQL returned non-JSON (likely HTML error page)
      return new Response(JSON.stringify({ error: 'LeetCode returned non-JSON response', status: response.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If GraphQL returned errors, try the public API as fallback for problem queries
    if (titleSlug && (!data?.data?.question)) {
      try {
        const fallbackRes = await fetchWithRetry(`https://alfa-leetcode-api.onrender.com/select?titleSlug=${encodeURIComponent(titleSlug)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        })
        const fb = await fallbackRes.json()
        if (fb && (fb.questionId || fb.title)) {
          return new Response(JSON.stringify({
            data: {
              question: {
                questionId: fb.questionId,
                questionFrontendId: fb.questionFrontendId || fb.questionId,
                title: fb.questionTitle || fb.title,
                titleSlug: fb.titleSlug || titleSlug,
                difficulty: fb.difficulty,
                acRate: fb.acRate,
                stats: fb.stats || '{}',
                likes: fb.likes || 0,
                dislikes: fb.dislikes || 0,
                topicTags: fb.topicTags || [],
                hints: fb.hints || [],
                similarQuestions: typeof fb.similarQuestions === 'string' ? fb.similarQuestions : JSON.stringify(fb.similarQuestions || []),
              }
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      } catch {}
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
