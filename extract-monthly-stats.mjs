const SUPABASE_URL = 'https://ifkkhwumimawacqaujop.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlma2tod3VtaW1hd2FjcWF1am9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDg5MTc1OSwiZXhwIjoyMDg2NDY3NzU5fQ.BB3cqEO73Oot2ovkPRZ8l3eTxnq7ltJB1PtMmbh98RQ'

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
}

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql'

const LEETCODE_QUERY = `
query getUserProfile($username: String!) {
  recentAcSubmissionList(username: $username, limit: 500) {
    titleSlug
    timestamp
  }
  matchedUser(username: $username) {
    submitStats {
      acSubmissionNum {
        difficulty
        count
      }
    }
  }
}
`

async function fetchLeetCodeExtended(username) {
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
    return json.data
  } catch {
    return null
  }
}

async function supabaseQuery(table, select, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${params ? '&' + params : ''}`
  const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
  if (!res.ok) { console.error(`Query ${table} error:`, res.status, await res.text()); return [] }
  return res.json()
}

async function checkTable() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profile_snapshots?select=id&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
  return res.ok
}

function monthKey(timestamp) {
  const d = new Date(parseInt(timestamp) * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function main() {
  console.log('=== Step 1: Check profile_snapshots table ===\n')
  const tableExists = await checkTable()
  console.log(tableExists ? '✓ Table exists' : '✗ Table not found (will skip DB insert, display only)')

  console.log('\n=== Step 2: Load all LeetCode profiles with student info ===\n')
  const profiles = await supabaseQuery(
    'coding_profiles',
    'lead_id,username,stats,raw_json,fetched_at,students(student_name,college,batch)',
    'platform=eq.leetcode&username=neq.&username=not.is.null'
  )
  console.log(`Found ${profiles.length} LeetCode profiles\n`)

  console.log('=== Step 3: Re-fetch from LeetCode with limit 500 ===\n')

  const CONCURRENCY = 3
  const DELAY_MS = 500
  const allMonthlyData = [] // { lead_id, campus, batch, username, monthData: { '2025-12': count, ... }, currentTotal }
  let fetched = 0
  let failed = 0

  for (let i = 0; i < profiles.length; i += CONCURRENCY) {
    const batch = profiles.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(async (p) => {
      const data = await fetchLeetCodeExtended(p.username)
      if (!data) return null

      // Parse recentAcSubmissionList — group unique slugs by month
      const submissions = data.recentAcSubmissionList || []
      const monthProblems = {} // month -> Set of slugs
      for (const sub of submissions) {
        const m = monthKey(sub.timestamp)
        if (!monthProblems[m]) monthProblems[m] = new Set()
        monthProblems[m].add(sub.titleSlug)
      }

      // Convert sets to counts
      const monthData = {}
      for (const [m, slugs] of Object.entries(monthProblems)) {
        monthData[m] = slugs.size
      }

      // Current totals from API
      const solvedStats = {}
      if (data.matchedUser?.submitStats?.acSubmissionNum) {
        for (const item of data.matchedUser.submitStats.acSubmissionNum) {
          solvedStats[item.difficulty] = item.count
        }
      }
      const currentTotal = (solvedStats.Easy || 0) + (solvedStats.Medium || 0) + (solvedStats.Hard || 0)

      return {
        lead_id: p.lead_id,
        username: p.username,
        campus: p.students?.college || 'Unknown',
        batch: p.students?.batch || 'Unknown',
        monthData,
        currentTotal,
        easy: solvedStats.Easy || 0,
        medium: solvedStats.Medium || 0,
        hard: solvedStats.Hard || 0,
        submissionCount: submissions.length,
      }
    }))

    for (const r of results) {
      if (r) { allMonthlyData.push(r); fetched++ }
      else failed++
    }

    process.stdout.write(`\r  Fetched: ${fetched}/${profiles.length} (failed: ${failed})`)
    if (i + CONCURRENCY < profiles.length) await new Promise(r => setTimeout(r, DELAY_MS))
  }
  console.log('\n')

  // Step 4: Store snapshots in DB
  if (tableExists) {
    console.log('=== Step 4: Storing snapshots in profile_snapshots ===\n')
    const TARGET_MONTHS = ['2025-12', '2026-01', '2026-02', '2026-03']
    const rows = []
    for (const s of allMonthlyData) {
      for (const month of TARGET_MONTHS) {
        if (s.monthData[month]) {
          rows.push({
            lead_id: s.lead_id,
            platform: 'leetcode',
            month,
            new_problems: s.monthData[month],
            cumulative_total: s.currentTotal, // only accurate for current month
            easy: s.easy,
            medium: s.medium,
            hard: s.hard,
          })
        }
      }
    }

    // Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50)
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profile_snapshots`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      })
      if (!res.ok) {
        const text = await res.text()
        console.error(`  Insert error (batch ${i}):`, res.status, text)
      }
    }
    console.log(`  Inserted ${rows.length} snapshot rows\n`)
  }

  // Step 5: Print summary
  console.log('=== MONTHLY PROGRESSION: Campus x Batch ===\n')
  const TARGET = ['2025-12', '2026-01', '2026-02', '2026-03']
  const groups = {}

  for (const s of allMonthlyData) {
    const key = `${s.campus}|${s.batch}`
    if (!groups[key]) {
      groups[key] = { campus: s.campus, batch: s.batch, students: 0, currentTotal: 0 }
      for (const m of TARGET) groups[key][m] = 0
    }
    groups[key].students++
    groups[key].currentTotal += s.currentTotal
    for (const m of TARGET) {
      groups[key][m] += s.monthData[m] || 0
    }
  }

  const sorted = Object.values(groups).sort((a, b) =>
    a.campus !== b.campus ? a.campus.localeCompare(b.campus) : a.batch.localeCompare(b.batch)
  )

  // Header
  const pad = (s, n) => String(s).padEnd(n)
  const padr = (s, n) => String(s).padStart(n)
  console.log(
    pad('Campus', 14) + pad('Batch', 8) + padr('Students', 10) +
    padr('Dec-25', 10) + padr('Jan-26', 10) + padr('Feb-26', 10) + padr('Mar-26', 10) +
    padr('Total Now', 12)
  )
  console.log('-'.repeat(84))

  for (const g of sorted) {
    console.log(
      pad(g.campus, 14) + pad(g.batch, 8) + padr(g.students, 10) +
      padr(g['2025-12'], 10) + padr(g['2026-01'], 10) + padr(g['2026-02'], 10) + padr(g['2026-03'], 10) +
      padr(g.currentTotal, 12)
    )
  }

  // Also print per-student detail for verification
  console.log('\n\n=== TOP STUDENTS BY MONTHLY ACTIVITY ===\n')
  const withActivity = allMonthlyData.filter(s =>
    TARGET.some(m => s.monthData[m] > 0)
  ).sort((a, b) => {
    const aTotal = TARGET.reduce((sum, m) => sum + (a.monthData[m] || 0), 0)
    const bTotal = TARGET.reduce((sum, m) => sum + (b.monthData[m] || 0), 0)
    return bTotal - aTotal
  }).slice(0, 20)

  console.log(
    pad('Username', 20) + pad('Campus', 14) + pad('Batch', 8) +
    padr('Dec', 6) + padr('Jan', 6) + padr('Feb', 6) + padr('Mar', 6) + padr('Total', 8)
  )
  console.log('-'.repeat(74))

  for (const s of withActivity) {
    console.log(
      pad(s.username, 20) + pad(s.campus, 14) + pad(s.batch, 8) +
      padr(s.monthData['2025-12'] || 0, 6) + padr(s.monthData['2026-01'] || 0, 6) +
      padr(s.monthData['2026-02'] || 0, 6) + padr(s.monthData['2026-03'] || 0, 6) +
      padr(s.currentTotal, 8)
    )
  }
}

main().catch(console.error)
