import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { config } from 'dotenv'

config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const db = new Database('./leetcode_cache.db', { readonly: true })

async function migrateLeetCode() {
  const rows = db.prepare('SELECT * FROM leetcode_profiles').all()
  console.log(`Found ${rows.length} LeetCode profiles`)

  if (!rows.length) return

  const records = rows.map(r => ({
    username: r.username,
    student_name: r.student_name || '',
    college: r.college || '',
    batch: r.batch || '',
    easy: r.easy || 0,
    medium: r.medium || 0,
    hard: r.hard || 0,
    total_solved: r.total_solved || 0,
    contest_rating: r.contest_rating || 0,
    contests_attended: r.contests_attended || 0,
    global_ranking: r.global_ranking || 0,
    score: r.score || 0,
    raw_json: r.raw_json ? JSON.parse(r.raw_json) : null,
    fetched_at: r.fetched_at || new Date().toISOString(),
  }))

  // Supabase upsert in batches of 50
  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50)
    const { error } = await supabase
      .from('leetcode_profiles')
      .upsert(batch, { onConflict: 'username' })

    if (error) {
      console.error(`LeetCode batch ${i}-${i + batch.length} failed:`, error.message)
    } else {
      console.log(`  LeetCode: uploaded ${i + batch.length}/${records.length}`)
    }
  }
}

async function migrateCodeforces() {
  const rows = db.prepare('SELECT * FROM codeforces_profiles').all()
  console.log(`Found ${rows.length} Codeforces profiles`)

  if (!rows.length) return

  const records = rows.map(r => ({
    username: r.username,
    student_name: r.student_name || '',
    college: r.college || '',
    batch: r.batch || '',
    rating: r.rating || 0,
    max_rating: r.max_rating || 0,
    rank: r.rank || 'unrated',
    problems_solved: r.problems_solved || 0,
    contests_attended: r.contests_attended || 0,
    avg_problem_rating: r.avg_problem_rating || 0,
    score: r.score || 0,
    raw_json: r.raw_json ? JSON.parse(r.raw_json) : null,
    fetched_at: r.fetched_at || new Date().toISOString(),
  }))

  for (let i = 0; i < records.length; i += 50) {
    const batch = records.slice(i, i + 50)
    const { error } = await supabase
      .from('codeforces_profiles')
      .upsert(batch, { onConflict: 'username' })

    if (error) {
      console.error(`Codeforces batch ${i}-${i + batch.length} failed:`, error.message)
    } else {
      console.log(`  Codeforces: uploaded ${i + batch.length}/${records.length}`)
    }
  }
}

async function main() {
  console.log('Migrating local SQLite → Supabase...\n')
  await migrateLeetCode()
  console.log()
  await migrateCodeforces()
  console.log('\nDone!')
  db.close()
}

main()
