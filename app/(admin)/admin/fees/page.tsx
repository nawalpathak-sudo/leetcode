import { createClient } from '@/lib/supabase/server'
import FeesClient from './_components/FeesClient'

export default async function FeesPage() {
  const supabase = await createClient()

  // Fetch fee breakdown server-side for active students
  const { data: feeData } = await supabase
    .from('student_fees')
    .select('total_fee, total_fee_paid, total_fee_pending, total_fee_pending_till_date, total_fee_till_date, students!inner(campus_name, batch, active_status)')
    .eq('students.active_status', 'Active')
    .limit(1000)

  // Compute top metrics & campus collection
  let totalFee = 0, totalPaid = 0, totalPending = 0, pendingTillDate = 0, totalFeeTillDate = 0, pendingCount = 0

  const byCamp: Record<string, { label: string; paid: number; total: number; count: number }> = {}

  ;(feeData || []).forEach((row: any) => {
    const campus = row.students?.campus_name || 'Unknown'
    const batch = row.students?.batch || 'Unknown'
    const key = `${campus} · ${batch}`
    const fee = Number(row.total_fee || 0)
    const paid = Number(row.total_fee_paid || 0)
    const pending = Number(row.total_fee_pending || 0)
    const ptd = Number(row.total_fee_pending_till_date || 0)
    const ftd = Number(row.total_fee_till_date || 0)

    totalFee += fee
    totalPaid += paid
    totalPending += pending
    pendingTillDate += ptd
    totalFeeTillDate += ftd
    if (ptd > 0) pendingCount++

    if (!byCamp[key]) byCamp[key] = { label: `${campus} · Batch ${batch}`, paid: 0, total: 0, count: 0 }
    byCamp[key].paid += paid
    byCamp[key].total += ftd
    byCamp[key].count++
  })

  const futureScheduled = totalPending - pendingTillDate
  const campusCollection = Object.values(byCamp).sort((a, b) => (b.paid / b.total) - (a.paid / a.total))

  // Fetch filter options (lightweight)
  const { data: filterData } = await supabase
    .from('students')
    .select('campus_name, batch')
    .eq('active_status', 'Active')
    .not('campus_name', 'eq', '')

  const campuses = [...new Set((filterData || []).map((d: any) => d.campus_name).filter(Boolean))].sort()
  const batchMap: Record<string, Set<string>> = {}
  ;(filterData || []).forEach((d: any) => {
    if (d.batch && d.campus_name) {
      if (!batchMap[d.campus_name]) batchMap[d.campus_name] = new Set()
      batchMap[d.campus_name].add(d.batch)
    }
  })
  const batches: Record<string, string[]> = {}
  Object.keys(batchMap).forEach(c => {
    batches[c] = [...batchMap[c]].sort()
  })

  return (
    <FeesClient
      metrics={{
        totalFee,
        totalPaid,
        totalPending,
        pendingTillDate,
        futureScheduled,
        pendingCount,
        totalFeeTillDate,
        total: feeData?.length || 0,
      }}
      campusCollection={campusCollection}
      filterOptions={{ campuses, batches }}
    />
  )
}
