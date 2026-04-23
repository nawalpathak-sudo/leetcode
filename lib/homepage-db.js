import { createClient } from '@/lib/supabase/client'

// In-memory cache for leaderboard snapshots
const _profileCache = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function loadAllProfiles(platform, { includeRaw = false } = {}) {
  const cacheKey = `${platform}:${includeRaw}`
  const cached = _profileCache[cacheKey]
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const supabase = createClient()

  const fields = includeRaw
    ? 'lead_id, platform, username, score, stats, raw_json, fetched_at, students(student_name, college, batch, email, student_username)'
    : 'lead_id, platform, username, score, stats, fetched_at, students(student_name, college, batch, email, student_username)'

  const { data, error } = await supabase
    .from('coding_profiles')
    .select(fields)
    .eq('platform', platform)
    .order('score', { ascending: false })

  if (error) { console.error('Load profiles error:', error); return [] }

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
