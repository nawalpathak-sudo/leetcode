import { supabase } from './supabase'
import { calculateLeetCodeScore, calculateCodeforcesScore } from './scoring'

// ---- Platforms ----

export async function loadPlatforms() {
  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('active', true)
    .order('created_at')

  if (error) { console.error('Load platforms error:', error); return [] }
  return data || []
}

// ---- Students ----

export async function upsertStudents(rows) {
  // rows: [{ lead_id, student_name, email, college, batch }]
  const { error } = await supabase
    .from('students')
    .upsert(rows, { onConflict: 'lead_id' })

  if (error) console.error('Upsert students error:', error)
  else invalidateStudentsCache()
  return !error
}

export async function bulkUpdateEmails(rows) {
  // rows: [{ lead_id, email }]
  let updated = 0, inserted = 0, failed = []
  for (const row of rows) {
    if (!row.lead_id || !row.email) { failed.push(row.lead_id || '(empty)'); continue }
    const { data: existing } = await supabase
      .from('students')
      .select('lead_id')
      .eq('lead_id', row.lead_id)
      .single()
    if (existing) {
      const { error } = await supabase
        .from('students')
        .update({ email: row.email })
        .eq('lead_id', row.lead_id)
      if (error) { failed.push(row.lead_id); continue }
      updated++
    } else {
      const { error } = await supabase
        .from('students')
        .insert({ lead_id: row.lead_id, email: row.email })
      if (error) { failed.push(row.lead_id); continue }
      inserted++
    }
  }
  return { updated, inserted, failed }
}

let _studentsCache = null
let _studentsCacheTs = 0
const STUDENTS_CACHE_TTL = 5 * 60 * 1000

export async function loadAllStudents() {
  const now = Date.now()
  // Stale-while-revalidate: return cached immediately, refresh in background if stale
  if (_studentsCache && now - _studentsCacheTs < STUDENTS_CACHE_TTL) return _studentsCache

  const stale = _studentsCache
  const fetchPromise = supabase
    .from('students')
    .select('*')
    .order('student_name')
    .then(({ data, error }) => {
      if (error) { console.error('Load students error:', error); return stale || [] }
      _studentsCache = data || []
      _studentsCacheTs = Date.now()
      return _studentsCache
    })

  // If we have stale data, return it immediately and refresh in background
  if (stale) {
    fetchPromise.catch(() => {})
    return stale
  }
  return fetchPromise
}

export function invalidateStudentsCache() {
  _studentsCache = null
  _studentsCacheTs = 0
}

// ---- Coding Profiles Map (lead_id -> { platform: username }) ----

let _profilesMapCache = null
let _profilesMapCacheTs = 0

export async function loadAllCodingProfilesMap() {
  const now = Date.now()
  if (_profilesMapCache && now - _profilesMapCacheTs < CACHE_TTL) return _profilesMapCache

  const { data, error } = await supabase
    .from('coding_profiles')
    .select('lead_id, platform, username')

  if (error) { console.error('Load profiles map error:', error); return _profilesMapCache || {} }

  const map = {}
  for (const row of (data || [])) {
    if (!map[row.lead_id]) map[row.lead_id] = {}
    map[row.lead_id][row.platform] = row.username
  }
  _profilesMapCache = map
  _profilesMapCacheTs = Date.now()
  return map
}

// ---- Coding Profiles ----

function extractStats(platform, rawData) {
  if (platform === 'leetcode') {
    if (!rawData?.matchedUser) return null
    const user = rawData.matchedUser
    const contest = rawData.userContestRanking
    const solvedStats = {}
    for (const item of user.submitStats.acSubmissionNum) {
      solvedStats[item.difficulty] = item.count
    }
    const easy = solvedStats.Easy || 0
    const medium = solvedStats.Medium || 0
    const hard = solvedStats.Hard || 0
    // Extract solved problem slugs from recent accepted submissions
    const solvedSlugs = [...new Set([
      ...(rawData.recentAcSubmissionList || []).map(s => s.titleSlug),
      ...(rawData.recentSubmissionList || []).filter(s => s.statusDisplay === 'Accepted').map(s => s.titleSlug),
    ])]
    return {
      easy, medium, hard,
      total_solved: easy + medium + hard,
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
    const solvedProblems = new Set()
    const problemRatings = []
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
        ? Math.round(problemRatings.reduce((a, b) => a + b, 0) / problemRatings.length) : 0,
    }
  }

  if (platform === 'github') {
    if (!rawData?.user) return null
    const user = rawData.user
    const repos = rawData.repos || []
    const events = rawData.events || []
    const gql = rawData.graphql_stats || {}

    // Language breakdown from repos
    const langMap = {}
    let totalStars = 0
    let totalForks = 0
    for (const r of repos) {
      if (r.fork) continue
      if (r.language) langMap[r.language] = (langMap[r.language] || 0) + 1
      totalStars += r.stargazers_count || 0
      totalForks += r.forks_count || 0
    }
    const languages = Object.entries(langMap).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))

    // Recent activity from events (legacy fallback)
    const pushDays = new Set()
    let recentCommits = 0
    for (const e of events) {
      if (e.type === 'PushEvent') {
        pushDays.add(e.created_at?.slice(0, 10))
        recentCommits += e.payload?.commits?.length || 0
      }
    }

    const ownRepos = repos.filter(r => !r.fork)

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
    // Current streak: count backwards from today
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
      top_repos: ownRepos.slice(0, 6).map(r => ({
        name: r.name,
        description: r.description || '',
        language: r.language || '',
        stars: r.stargazers_count || 0,
        forks: r.forks_count || 0,
        updated: r.updated_at,
      })),
      // Legacy fields
      recent_push_days: pushDays.size,
      recent_commits: recentCommits,
      // Accurate metrics from GraphQL (fallback to events data)
      total_commits: gql.total_commits || recentCommits,
      total_prs: gql.total_prs || 0,
      total_issues: gql.total_issues || 0,
      total_contributions_year: gql.total_contributions_year || 0,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      bio: user.bio || '',
      avatar_url: user.avatar_url || user.avatarUrl || '',
      created_at: user.created_at || user.createdAt,
    }
  }

  return {}
}

function calcScore(platform, rawData) {
  if (platform === 'leetcode') return calculateLeetCodeScore(rawData)
  if (platform === 'codeforces') return calculateCodeforcesScore(rawData)
  return 0
}

export async function saveProfile(leadId, platform, username, rawData) {
  const stats = extractStats(platform, rawData)
  if (!stats) return

  const row = {
    lead_id: leadId,
    platform,
    username,
    score: calcScore(platform, rawData),
    stats,
    raw_json: rawData,
    fetched_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('coding_profiles')
    .upsert(row, { onConflict: 'lead_id,platform' })

  if (error) console.error('Save profile error:', error)
  else invalidateProfileCache(platform)
}

// In-memory cache for leaderboard snapshots (avoids re-fetching 2000+ rows on every visit)
const _profileCache = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function loadAllProfiles(platform, { includeRaw = false } = {}) {
  const cacheKey = `${platform}:${includeRaw}`
  const cached = _profileCache[cacheKey]
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const fields = includeRaw
    ? 'lead_id, platform, username, score, stats, raw_json, fetched_at, students(student_name, college, batch, email, student_username)'
    : 'lead_id, platform, username, score, stats, fetched_at, students(student_name, college, batch, email, student_username)'

  const { data, error } = await supabase
    .from('coding_profiles')
    .select(fields)
    .eq('platform', platform)
    .order('score', { ascending: false })

  if (error) { console.error('Load profiles error:', error); return [] }
  // Flatten: merge student info + stats into top level
  const result = (data || []).map(row => ({
    lead_id: row.lead_id,
    platform: row.platform,
    username: row.username,
    score: row.score,
    fetched_at: row.fetched_at,
    student_name: row.students?.student_name || '',
    college: row.students?.college || '',
    batch: row.students?.batch || '',
    email: row.students?.email || '',
    student_username: row.students?.student_username || '',
    ...(row.stats || {}),
    ...(includeRaw ? { raw_json: row.raw_json } : {}),
  }))

  _profileCache[cacheKey] = { data: result, ts: Date.now() }
  return result
}

export function invalidateProfileCache(platform) {
  if (platform) {
    delete _profileCache[`${platform}:false`]
    delete _profileCache[`${platform}:true`]
  } else {
    for (const key in _profileCache) delete _profileCache[key]
  }
}

export async function loadProfile(platform, username) {
  const { data, error } = await supabase
    .from('coding_profiles')
    .select('*, students(student_name, college, batch, email, student_username)')
    .eq('platform', platform)
    .ilike('username', username)
    .single()

  if (error) return null
  return {
    ...data,
    student_name: data.students?.student_name || '',
    college: data.students?.college || '',
    batch: data.students?.batch || '',
    ...(data.stats || {}),
  }
}

export async function searchProfiles(platform, query) {
  // Fire both searches in parallel
  const [{ data }, { data: byName }] = await Promise.all([
    supabase
      .from('coding_profiles')
      .select('*, students(student_name, college, batch, email, student_username)')
      .eq('platform', platform)
      .ilike('username', `%${query}%`)
      .order('score', { ascending: false })
      .limit(10),
    supabase
      .from('coding_profiles')
      .select('*, students!inner(student_name, college, batch, email, student_username)')
      .eq('platform', platform)
      .ilike('students.student_name', `%${query}%`)
      .order('score', { ascending: false })
      .limit(10),
  ])

  const merged = new Map()
  for (const row of [...(data || []), ...(byName || [])]) {
    if (!merged.has(row.lead_id)) {
      merged.set(row.lead_id, {
        ...row,
        student_name: row.students?.student_name || '',
        college: row.students?.college || '',
        batch: row.students?.batch || '',
        ...(row.stats || {}),
      })
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 10)
}

export async function deleteProfile(leadId, platform) {
  const { error } = await supabase
    .from('coding_profiles')
    .delete()
    .eq('lead_id', leadId)
    .eq('platform', platform)

  if (error) console.error('Delete profile error:', error)
  else invalidateProfileCache(platform)
  return !error
}

export async function clearAllProfiles(platform) {
  const { error } = await supabase
    .from('coding_profiles')
    .delete()
    .eq('platform', platform)

  if (error) console.error('Clear profiles error:', error)
  else invalidateProfileCache(platform)
}

// ---- Slug Helpers ----

export function slugify(str) {
  return (str || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function generateProfileSlug(student) {
  const parts = [student.student_username || slugify(student.student_name)]
  if (student.college) parts.push(slugify(student.college))
  if (student.batch) parts.push(slugify(student.batch))
  return parts.join('-')
}

export async function getStudentBySlug(slug) {
  const { data, error } = await supabase.from('students').select('*')
  if (error || !data) return null
  return data.find(s => generateProfileSlug(s) === slug) || null
}

// ---- Admin Users ----

export async function getAdminByPhone(phone) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('phone', phone)
    .eq('active', true)
    .single()
  if (error) return null
  return data
}

export async function getAdminById(id) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .single()
  if (error) return null
  return data
}

export async function loadAllAdminUsers() {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) { console.error('Load admin users error:', error); return [] }
  return data || []
}

export async function createAdminUser({ name, phone, role, campus }) {
  try {
    const res = await fetch('/api/manage-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name, phone, role, campus }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error || 'Failed to create user' }
    return { data: data.user }
  } catch (err) {
    return { error: err.message }
  }
}

export async function updateAdminUser(id, updates) {
  try {
    const res = await fetch('/api/manage-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id, ...updates }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error || 'Failed to update user' }
    return { success: true }
  } catch (err) {
    return { error: err.message }
  }
}

// ---- Auth (WhatsApp OTP) ----

export async function getStudentByEmail(email) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('email', email)
    .single()
  if (error) return null
  return data
}

export async function getStudentByPhone(phone) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('phone', phone)
    .single()
  if (error) return null
  return data
}

export async function updateStudentPhone(leadId, phone) {
  const { error } = await supabase
    .from('students')
    .update({ phone })
    .eq('lead_id', leadId)
  if (error) console.error('Update student phone error:', error)
  return !error
}

export async function updateStudentEmail(leadId, email) {
  const { error } = await supabase
    .from('students')
    .update({ email })
    .eq('lead_id', leadId)
  if (error) console.error('Update student email error:', error)
  return !error
}

export async function updateStudentField(leadId, field, value) {
  const { error } = await supabase
    .from('students')
    .update({ [field]: value })
    .eq('lead_id', leadId)
  if (error) console.error(`Update student ${field} error:`, error)
  else invalidateStudentsCache()
  return !error
}

export async function sendOtp(phone) {
  try {
    const res = await fetch('/api/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || 'Failed to send OTP' }
    return data
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export async function verifyOtp(phone, code) {
  try {
    const res = await fetch('/api/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || 'Invalid or expired OTP' }
    return data
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ---- Student Portal ----

export async function getStudent(leadId) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('lead_id', leadId)
    .single()

  if (error) return null
  return data
}

export async function getStudentProfiles(leadId) {
  const { data, error } = await supabase
    .from('coding_profiles')
    .select('*')
    .eq('lead_id', leadId)

  if (error) { console.error('Get student profiles error:', error); return [] }
  return data || []
}

export async function saveStudentUsername(leadId, platform, username) {
  const { error } = await supabase
    .from('coding_profiles')
    .upsert({
      lead_id: leadId,
      platform,
      username,
      score: 0,
      stats: {},
      raw_json: null,
      fetched_at: null,
    }, { onConflict: 'lead_id,platform' })

  if (error) console.error('Save student username error:', error)
  else invalidateProfileCache(platform)
  return !error
}

export async function deleteStudentProfile(leadId, platform) {
  const { error } = await supabase
    .from('coding_profiles')
    .delete()
    .eq('lead_id', leadId)
    .eq('platform', platform)

  if (error) console.error('Delete student profile error:', error)
  else invalidateProfileCache(platform)
  return !error
}

// Link a platform username to a student (create empty profile row, no API data yet)
export async function linkProfile(leadId, platform, username) {
  const { error } = await supabase
    .from('coding_profiles')
    .upsert({
      lead_id: leadId,
      platform,
      username,
      score: 0,
      stats: {},
      fetched_at: null,
    }, { onConflict: 'lead_id,platform' })

  if (error) console.error('Link profile error:', error)
  else invalidateProfileCache(platform)
  return !error
}

// ---- Practice Problems ----

export async function loadPracticeProblems() {
  const { data, error } = await supabase
    .from('practice_problems')
    .select('*')
    .order('topic')
    .order('order_index')
    .order('created_at')
  if (error) { console.error('Load practice problems:', error); return [] }
  return data || []
}

export async function upsertPracticeProblem(problem) {
  const row = {
    topic: problem.topic,
    title: problem.title,
    title_slug: problem.title_slug,
    difficulty: problem.difficulty,
    tags: problem.tags || [],
    notes: problem.notes || '',
    order_index: problem.order_index || 0,
  }
  if (problem.id) row.id = problem.id

  const { data, error } = await supabase
    .from('practice_problems')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()
  if (error) { console.error('Upsert practice problem:', error); return null }
  return data
}

export async function deletePracticeProblem(id) {
  const { error } = await supabase
    .from('practice_problems')
    .delete()
    .eq('id', id)
  if (error) console.error('Delete practice problem:', error)
  return !error
}

export async function bulkInsertPracticeProblems(problems) {
  const rows = problems.map((p, i) => ({
    topic: p.topic,
    title: p.title,
    title_slug: p.title_slug,
    difficulty: p.difficulty,
    tags: p.tags || [],
    notes: p.notes || '',
    order_index: p.order_index ?? i,
  }))
  const { error } = await supabase
    .from('practice_problems')
    .upsert(rows, { onConflict: 'title_slug' })
  if (error) console.error('Bulk insert practice problems:', error)
  return !error
}

// ---- Solved Map (which ALTA students solved which problems) ----

// ---- ProjectHub ----

export async function loadProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, students(student_name, student_username, college, batch)')
    .order('created_at', { ascending: false })

  if (error) { console.error('Load projects error:', error); return [] }
  return (data || []).map(p => ({
    ...p,
    student_name: p.students?.student_name || '',
    student_username: p.students?.student_username || '',
    college: p.students?.college || '',
    batch: p.students?.batch || '',
  }))
}

export async function loadStudentProjects(leadId) {
  // Projects created by the student
  const { data: owned, error: e1 } = await supabase
    .from('projects')
    .select('*, students(student_name, student_username)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  // Projects where student is a member
  const { data: memberOf, error: e2 } = await supabase
    .from('project_members')
    .select('role, projects(*, students(student_name, student_username))')
    .eq('lead_id', leadId)

  if (e1) console.error('Load owned projects:', e1)
  if (e2) console.error('Load member projects:', e2)

  const ownedList = (owned || []).map(p => ({
    ...p,
    student_name: p.students?.student_name || '',
    is_owner: true,
  }))

  const memberList = (memberOf || []).filter(m => m.projects).map(m => ({
    ...m.projects,
    student_name: m.projects.students?.student_name || '',
    my_role: m.role,
    is_owner: false,
  }))

  return { owned: ownedList, memberOf: memberList }
}

export async function getProject(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*, students(student_name, student_username, college, batch)')
    .eq('id', projectId)
    .single()

  if (error) { console.error('Get project error:', error); return null }
  return {
    ...data,
    student_name: data.students?.student_name || '',
    student_username: data.students?.student_username || '',
  }
}

export async function saveProject(project) {
  const row = {
    title: project.title,
    description: project.description || '',
    deploy_url: project.deploy_url || '',
    github_url: project.github_url || '',
    thumbnail_url: project.thumbnail_url || '',
    lead_id: project.lead_id,
  }
  if (project.id) row.id = project.id

  const { data, error } = await supabase
    .from('projects')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single()

  if (error) { console.error('Save project error:', error); return null }
  return data
}

export async function deleteProject(projectId) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) console.error('Delete project error:', error)
  return !error
}

export async function loadProjectMembers(projectId) {
  const { data, error } = await supabase
    .from('project_members')
    .select('*, students(student_name, student_username, college, batch)')
    .eq('project_id', projectId)
    .order('created_at')

  if (error) { console.error('Load project members:', error); return [] }
  return (data || []).map(m => ({
    ...m,
    student_name: m.students?.student_name || '',
    student_username: m.students?.student_username || '',
  }))
}

export async function addProjectMember(projectId, leadId, role) {
  const { data, error } = await supabase
    .from('project_members')
    .upsert({ project_id: projectId, lead_id: leadId, role: role || '' }, { onConflict: 'project_id,lead_id' })
    .select('*, students(student_name, student_username)')
    .single()

  if (error) { console.error('Add project member:', error); return null }
  return { ...data, student_name: data.students?.student_name || '' }
}

export async function removeProjectMember(memberId) {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId)

  if (error) console.error('Remove project member:', error)
  return !error
}

export async function searchStudents(query) {
  const { data, error } = await supabase
    .from('students')
    .select('lead_id, student_name, college, batch')
    .or(`student_name.ilike.%${query}%,lead_id.ilike.%${query}%`)
    .limit(10)

  if (error) { console.error('Search students:', error); return [] }
  return data || []
}

// ---- Solved Map (which ALTA students solved which problems) ----

export async function loadSolvedMap() {
  const { data, error } = await supabase
    .from('coding_profiles')
    .select('username, stats, raw_json, students(student_name)')
    .eq('platform', 'leetcode')

  if (error) { console.error('Load solved map:', error); return {} }

  const map = {} // title_slug -> [{ student_name, username }]
  for (const row of (data || [])) {
    // Use solved_slugs from stats (populated after refresh), fallback to raw_json
    let slugs = row.stats?.solved_slugs
    if (!slugs && row.raw_json) {
      slugs = [...new Set([
        ...(row.raw_json.recentAcSubmissionList || []).map(s => s.titleSlug),
        ...(row.raw_json.recentSubmissionList || []).filter(s => s.statusDisplay === 'Accepted').map(s => s.titleSlug),
      ])]
    }
    const name = row.students?.student_name || row.username
    for (const slug of (slugs || [])) {
      if (!map[slug]) map[slug] = []
      map[slug].push({ student_name: name, username: row.username })
    }
  }
  return map
}
