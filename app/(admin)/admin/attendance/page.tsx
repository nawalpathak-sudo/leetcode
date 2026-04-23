import { createClient } from '@/lib/supabase/server'
import AttendanceClient from './_components/AttendanceClient'

export default async function AttendancePage() {
  const supabase = await createClient()

  // Fetch attendance + student data server-side (active students only)
  const { data: attData } = await supabase
    .from('student_attendance')
    .select('overall_pct, students!inner(student_name, campus_name, batch, active_status)')
    .eq('students.active_status', 'Active')

  // Fetch filter options (campus + batch combos)
  const { data: filterData } = await supabase
    .from('students')
    .select('campus_name, batch')
    .eq('active_status', 'Active')
    .not('campus_name', 'eq', '')

  // Build filter options
  const campusSet = new Set<string>()
  const batchMap: Record<string, Set<string>> = {}
  filterData?.forEach((d: any) => {
    if (d.campus_name) {
      campusSet.add(d.campus_name)
      if (d.batch) {
        if (!batchMap[d.campus_name]) batchMap[d.campus_name] = new Set()
        batchMap[d.campus_name].add(d.batch)
      }
    }
  })
  const campuses = [...campusSet].sort()
  const batches: Record<string, string[]> = {}
  Object.keys(batchMap).forEach(c => {
    batches[c] = [...batchMap[c]].sort()
  })

  // Compute campus stats, distribution, and at-risk data
  const bycamp: Record<string, any> = {}
  const brackets: Record<string, number> = { '90-100': 0, '75-89': 0, '50-74': 0, '25-49': 0, '0-24': 0 }
  const riskMap: Record<string, any> = {}

  attData?.forEach((row: any) => {
    const campus = row.students?.campus_name || 'Unknown'
    const batch = row.students?.batch || 'Unknown'
    const pct = Number(row.overall_pct || 0)
    const key = `${campus} · ${batch}`

    if (!bycamp[key]) bycamp[key] = { name: campus, batch, label: key, sum: 0, count: 0, below75: 0, below50: 0 }
    bycamp[key].sum += pct
    bycamp[key].count++
    if (pct < 75) bycamp[key].below75++
    if (pct < 50) bycamp[key].below50++

    if (pct >= 90) brackets['90-100']++
    else if (pct >= 75) brackets['75-89']++
    else if (pct >= 50) brackets['50-74']++
    else if (pct >= 25) brackets['25-49']++
    else brackets['0-24']++

    if (pct < 50) {
      if (!riskMap[key]) riskMap[key] = { campus, batch, label: key, below50: 0, total: 0 }
      riskMap[key].below50++
    }
  })

  const campusStats = Object.values(bycamp).map((c: any) => ({
    ...c,
    avg: c.count > 0 ? c.sum / c.count : 0,
    total: c.count,
  })).sort((a: any, b: any) => b.avg - a.avg)

  // Merge total counts into riskMap
  Object.values(bycamp).forEach((c: any) => {
    if (riskMap[c.label]) riskMap[c.label].total = c.count
  })

  const atRisk = Object.values(riskMap)
    .map((r: any) => ({ ...r, pct: r.total > 0 ? (r.below50 / r.total) * 100 : 0 }))
    .sort((a: any, b: any) => b.pct - a.pct)

  const totalRows = attData?.length || 0
  const distribution = totalRows > 0
    ? { ...brackets, total: totalRows } as any
    : null

  return (
    <AttendanceClient
      initialCampusStats={campusStats}
      initialDistribution={distribution}
      initialAtRisk={atRisk}
      initialFilterOptions={{ campuses, batches }}
    />
  )
}
