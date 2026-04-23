import { supabase } from './supabase'

// --- Filter options (lightweight, id+name only) ---

export async function loadFilterOptions() {
  const { data } = await supabase
    .from('students')
    .select('campus_name, batch')
    .not('campus_name', 'eq', '')

  if (!data) return { campuses: [], batches: [] }

  const campuses = [...new Set(data.map(d => d.campus_name).filter(Boolean))].sort()
  const batchMap = {}
  data.forEach(d => {
    if (d.batch && d.campus_name) {
      if (!batchMap[d.campus_name]) batchMap[d.campus_name] = new Set()
      batchMap[d.campus_name].add(d.batch)
    }
  })

  const batches = {}
  Object.keys(batchMap).forEach(c => {
    batches[c] = [...batchMap[c]].sort()
  })

  return { campuses, batches }
}

// --- Dashboard aggregates ---

export async function loadDashboardStats() {
  const [
    { count: totalStudents },
    { count: activeStudents },
    { data: avgAtt = null },
    { data: feeAgg = null },
    { count: codingProfiles },
    { count: belowAttendance },
    { count: feesPending },
    { data: lastSync },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('active_status', 'Active'),
    Promise.resolve({ data: null }),
    Promise.resolve({ data: null }),
    supabase.from('coding_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('student_attendance').select('*', { count: 'exact', head: true }).lt('overall_pct', 75),
    supabase.from('student_fees').select('*', { count: 'exact', head: true }).gt('total_fee_pending_till_date', 0),
    supabase.from('gsheet_sync_log').select('sync_type, finished_at, status, rows_fetched').order('started_at', { ascending: false }).limit(1),
  ])

  // Fallback: calculate avg attendance client-side if RPC doesn't exist
  let avgAttendance = avgAtt?.[0]?.avg || null
  let totalFee = feeAgg?.[0]?.total_fee || 0
  let totalPaid = feeAgg?.[0]?.total_paid || 0
  let totalPendingAmt = feeAgg?.[0]?.total_pending || 0

  if (avgAttendance === null) {
    const { data: attData } = await supabase
      .from('student_attendance')
      .select('overall_pct')
      .not('overall_pct', 'is', null)
      .limit(1000)
    if (attData?.length) {
      avgAttendance = attData.reduce((s, r) => s + Number(r.overall_pct), 0) / attData.length
    }
  }

  if (!totalFee) {
    const { data: feeData } = await supabase
      .from('student_fees')
      .select('total_fee, total_fee_paid, total_fee_pending')
      .limit(1000)
    if (feeData?.length) {
      totalFee = feeData.reduce((s, r) => s + Number(r.total_fee || 0), 0)
      totalPaid = feeData.reduce((s, r) => s + Number(r.total_fee_paid || 0), 0)
      totalPendingAmt = feeData.reduce((s, r) => s + Number(r.total_fee_pending || 0), 0)
    }
  }

  return {
    totalStudents: totalStudents || 0,
    activeStudents: activeStudents || 0,
    avgAttendance: avgAttendance ? Math.round(avgAttendance * 10) / 10 : 0,
    totalFee,
    totalPaid,
    totalPending: totalPendingAmt,
    codingProfiles: codingProfiles || 0,
    belowAttendance: belowAttendance || 0,
    feesPendingCount: feesPending || 0,
    lastSync: lastSync?.[0] || null,
  }
}

// --- Attendance ---

export async function loadAttendance({ campus, batch, page = 0, pageSize = 25, sortBy = 'overall_pct', sortAsc = true, search = '' }) {
  let query = supabase
    .from('student_attendance')
    .select('*, students!inner(lead_id, student_name, college, batch, campus_name, program_name, active_status)', { count: 'exact' })
    .eq('students.active_status', 'Active')

  if (campus) query = query.eq('students.campus_name', campus)
  if (batch) query = query.eq('students.batch', batch)
  if (search) query = query.ilike('students.student_name', `%${search}%`)

  query = query.order(sortBy, { ascending: sortAsc })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, count, error } = await query
  return { data: data || [], total: count || 0, error }
}

export async function loadAttendanceSummary({ campus, batch }) {
  let query = supabase
    .from('student_attendance')
    .select('overall_pct, students!inner(campus_name, batch, active_status)')
    .eq('students.active_status', 'Active')

  if (campus) query = query.eq('students.campus_name', campus)
  if (batch) query = query.eq('students.batch', batch)

  const { data } = await query
  if (!data?.length) return { avg: 0, below75: 0, below50: 0, total: 0 }

  const valid = data.filter(d => d.overall_pct !== null)
  const avg = valid.length ? valid.reduce((s, r) => s + Number(r.overall_pct), 0) / valid.length : 0
  const below75 = valid.filter(d => Number(d.overall_pct) < 75).length
  const below50 = valid.filter(d => Number(d.overall_pct) < 50).length

  return { avg: Math.round(avg * 10) / 10, below75, below50, total: data.length }
}

// --- Fees ---

export async function loadFees({ campus, batch, page = 0, pageSize = 25, sortBy = 'total_fee_pending', sortAsc = false, search = '', pendingOnly = false }) {
  let query = supabase
    .from('student_fees')
    .select('*, students!inner(lead_id, student_name, college, batch, campus_name, program_name, active_status)', { count: 'exact' })
    .eq('students.active_status', 'Active')

  if (campus) query = query.eq('students.campus_name', campus)
  if (batch) query = query.eq('students.batch', batch)
  if (search) query = query.ilike('students.student_name', `%${search}%`)
  if (pendingOnly) query = query.gt('total_fee_pending_till_date', 0)

  query = query.order(sortBy, { ascending: sortAsc })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, count, error } = await query
  return { data: data || [], total: count || 0, error }
}

export async function loadFeeSummary({ campus, batch }) {
  let query = supabase
    .from('student_fees')
    .select('total_fee, total_fee_paid, total_fee_pending, total_fee_pending_till_date, students!inner(campus_name, batch, active_status)')
    .eq('students.active_status', 'Active')

  if (campus) query = query.eq('students.campus_name', campus)
  if (batch) query = query.eq('students.batch', batch)

  const { data } = await query
  if (!data?.length) return { totalFee: 0, totalPaid: 0, totalPending: 0, pendingTillDate: 0, count: 0 }

  return {
    totalFee: data.reduce((s, r) => s + Number(r.total_fee || 0), 0),
    totalPaid: data.reduce((s, r) => s + Number(r.total_fee_paid || 0), 0),
    totalPending: data.reduce((s, r) => s + Number(r.total_fee_pending || 0), 0),
    pendingTillDate: data.reduce((s, r) => s + Number(r.total_fee_pending_till_date || 0), 0),
    count: data.length,
  }
}

// --- Helpers ---

export function formatINR(num) {
  if (num === null || num === undefined) return '—'
  const n = Number(num)
  if (Math.abs(n) >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  if (Math.abs(n) >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function formatPct(num) {
  if (num === null || num === undefined) return '—'
  return `${Number(num).toFixed(1)}%`
}
