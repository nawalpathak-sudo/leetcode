const SUPABASE_URL = 'https://ifkkhwumimawacqaujop.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlma2tod3VtaW1hd2FjcWF1am9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5MTc1OSwiZXhwIjoyMDg2NDY3NzU5fQ.BB3cqEO73Oot2ovkPRZ8l3eTxnq7ltJB1PtMmbh98RQ'

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function query(table, select, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${params ? '&' + params : ''}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    console.error(`Error querying ${table}:`, res.status, await res.text())
    return []
  }
  return res.json()
}

async function main() {
  // 1. Get all practice problems with created_at
  console.log('=== PRACTICE PROBLEMS BY MONTH ===\n')
  const problems = await query('practice_problems', 'id,topic,title,created_at')

  const monthBuckets = {}
  for (const p of problems) {
    const d = new Date(p.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthBuckets[key] = (monthBuckets[key] || 0) + 1
  }

  const months = Object.keys(monthBuckets).sort()
  for (const m of months) {
    console.log(`  ${m}: ${monthBuckets[m]} problems`)
  }
  console.log(`  Total: ${problems.length} problems\n`)

  // 2. Get coding profiles with student info (LeetCode)
  console.log('=== LEETCODE PROBLEMS SOLVED BY CAMPUS x BATCH ===\n')
  const profiles = await query(
    'coding_profiles',
    'lead_id,stats,fetched_at,students(student_name,college,batch)',
    'platform=eq.leetcode'
  )

  // Group by campus (college) x batch
  const groups = {}
  for (const p of profiles) {
    const campus = p.students?.college || 'Unknown'
    const batch = p.students?.batch || 'Unknown'
    const key = `${campus} | ${batch}`
    if (!groups[key]) groups[key] = { campus, batch, students: 0, totalSolved: 0, easy: 0, medium: 0, hard: 0 }
    groups[key].students++
    groups[key].totalSolved += p.stats?.total_solved || 0
    groups[key].easy += p.stats?.easy || 0
    groups[key].medium += p.stats?.medium || 0
    groups[key].hard += p.stats?.hard || 0
  }

  // Sort by campus then batch
  const sorted = Object.values(groups).sort((a, b) => {
    if (a.campus !== b.campus) return a.campus.localeCompare(b.campus)
    return a.batch.localeCompare(b.batch)
  })

  console.log('Campus | Batch | Students | Total Solved | Easy | Medium | Hard')
  console.log('-'.repeat(80))
  for (const g of sorted) {
    console.log(`${g.campus} | ${g.batch} | ${g.students} | ${g.totalSolved} | ${g.easy} | ${g.medium} | ${g.hard}`)
  }

  // 3. Check if there's any historical/monthly data by looking at fetched_at
  console.log('\n=== PROFILE FETCH DATES (to check for monthly snapshots) ===\n')
  const fetchMonths = {}
  for (const p of profiles) {
    if (p.fetched_at) {
      const d = new Date(p.fetched_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      fetchMonths[key] = (fetchMonths[key] || 0) + 1
    }
  }
  for (const m of Object.keys(fetchMonths).sort()) {
    console.log(`  ${m}: ${fetchMonths[m]} profiles fetched`)
  }

  // 4. Get distinct campuses and batches
  console.log('\n=== DISTINCT CAMPUSES & BATCHES ===\n')
  const students = await query('students', 'college,batch')
  const campuses = [...new Set(students.map(s => s.college).filter(Boolean))].sort()
  const batches = [...new Set(students.map(s => s.batch).filter(Boolean))].sort()
  console.log('Campuses:', campuses.join(', '))
  console.log('Batches:', batches.join(', '))

  // 5. Check if there are any tables with historical monthly data
  console.log('\n=== CHECKING FOR HISTORY/SNAPSHOT TABLES ===\n')
  // Try common table names
  for (const table of ['profile_history', 'profile_snapshots', 'monthly_stats', 'coding_profile_history']) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, { headers })
    if (res.ok) {
      const data = await res.json()
      console.log(`  ${table}: EXISTS (${data.length} sample rows)`)
    } else {
      console.log(`  ${table}: not found`)
    }
  }
}

main().catch(console.error)
