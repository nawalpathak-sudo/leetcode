import { createClient } from '@/lib/supabase/server'
import DashboardClient from './_components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch dashboard stats server-side — no loading spinner needed
  const [
    { count: totalStudents },
    { count: activeStudents },
    { data: campusData },
    { data: recentSync },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('active_status', 'Active'),
    supabase.from('students').select('campus_name').eq('active_status', 'Active'),
    supabase.from('gsheet_sync_log').select('*').order('started_at', { ascending: false }).limit(1).single(),
  ])

  // Campus distribution
  const campusCounts: Record<string, number> = {}
  campusData?.forEach((s: any) => {
    const c = s.campus_name || 'Unknown'
    campusCounts[c] = (campusCounts[c] || 0) + 1
  })

  return (
    <DashboardClient
      totalStudents={totalStudents || 0}
      activeStudents={activeStudents || 0}
      campusCounts={campusCounts}
      lastSync={recentSync}
    />
  )
}
