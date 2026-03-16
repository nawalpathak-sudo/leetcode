const SUPABASE_URL = 'https://ifkkhwumimawacqaujop.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlma2tod3VtaW1hd2FjcWF1am9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5MTc1OSwiZXhwIjoyMDg2NDY3NzU5fQ.BB3cqEO73Oot2ovkPRZ8l3eTxnq7ltJB1PtMmbh98RQ'

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'resolution=merge-duplicates,return=minimal',
}

async function query(table, select, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${params ? '&' + params : ''}`
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  if (!res.ok) { console.error(`Query error:`, res.status, await res.text()); return [] }
  return res.json()
}

function monthKey(unixSeconds) {
  const d = new Date(unixSeconds * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function main() {
  console.log('=== Loading Codeforces profiles with raw_json ===\n')
  const profiles = await query(
    'coding_profiles',
    'lead_id,username,raw_json,students(student_name,college,batch)',
    'platform=eq.codeforces&username=neq.&username=not.is.null'
  )
  console.log(`Found ${profiles.length} Codeforces profiles\n`)

  const allRows = []
  const TARGET_MONTHS = ['2025-12', '2026-01', '2026-02', '2026-03']

  for (const p of profiles) {
    if (!p.raw_json?.submissions) continue
    const submissions = p.raw_json.submissions || []

    // Group unique solved problems by month
    const monthProblems = {} // month -> Set of problem keys
    for (const sub of submissions) {
      if (sub.verdict === 'OK' && sub.problem?.contestId && sub.problem?.index) {
        const m = monthKey(sub.creationTimeSeconds)
        if (!monthProblems[m]) monthProblems[m] = new Set()
        monthProblems[m].add(`${sub.problem.contestId}-${sub.problem.index}`)
      }
    }

    // Current cumulative total
    const allSolved = new Set()
    for (const sub of submissions) {
      if (sub.verdict === 'OK' && sub.problem?.contestId && sub.problem?.index) {
        allSolved.add(`${sub.problem.contestId}-${sub.problem.index}`)
      }
    }

    for (const month of TARGET_MONTHS) {
      const count = monthProblems[month]?.size || 0
      if (count > 0) {
        allRows.push({
          lead_id: p.lead_id,
          platform: 'codeforces',
          month,
          new_problems: count,
          cumulative_total: allSolved.size,
        })
      }
    }
  }

  console.log(`Inserting ${allRows.length} snapshot rows...\n`)

  // Upsert in batches
  for (let i = 0; i < allRows.length; i += 50) {
    const chunk = allRows.slice(i, i + 50)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profile_snapshots`, {
      method: 'POST',
      headers,
      body: JSON.stringify(chunk),
    })
    if (!res.ok) console.error(`Insert error:`, res.status, await res.text())
  }

  // Print summary
  console.log('=== CODEFORCES MONTHLY PROGRESSION: Campus x Batch ===\n')
  const groups = {}
  for (const p of profiles) {
    if (!p.raw_json?.submissions) continue
    const campus = p.students?.college || 'Unknown'
    const batch = p.students?.batch || 'Unknown'
    const key = `${campus}|${batch}`
    if (!groups[key]) { groups[key] = { campus, batch, students: 0 }; for (const m of TARGET_MONTHS) groups[key][m] = 0 }
    groups[key].students++

    const submissions = p.raw_json.submissions || []
    const monthProblems = {}
    for (const sub of submissions) {
      if (sub.verdict === 'OK' && sub.problem?.contestId && sub.problem?.index) {
        const m = monthKey(sub.creationTimeSeconds)
        if (!monthProblems[m]) monthProblems[m] = new Set()
        monthProblems[m].add(`${sub.problem.contestId}-${sub.problem.index}`)
      }
    }
    for (const m of TARGET_MONTHS) groups[key][m] += monthProblems[m]?.size || 0
  }

  const pad = (s, n) => String(s).padEnd(n)
  const padr = (s, n) => String(s).padStart(n)
  console.log(pad('Campus', 14) + pad('Batch', 8) + padr('Students', 10) + padr('Dec-25', 10) + padr('Jan-26', 10) + padr('Feb-26', 10) + padr('Mar-26', 10))
  console.log('-'.repeat(62))
  for (const g of Object.values(groups).sort((a, b) => a.campus.localeCompare(b.campus) || a.batch.localeCompare(b.batch))) {
    console.log(pad(g.campus, 14) + pad(g.batch, 8) + padr(g.students, 10) + padr(g['2025-12'], 10) + padr(g['2026-01'], 10) + padr(g['2026-02'], 10) + padr(g['2026-03'], 10))
  }
}

main().catch(console.error)
