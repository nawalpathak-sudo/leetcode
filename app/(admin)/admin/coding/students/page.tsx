import { createClient } from '@/lib/supabase/server'
import StudentsClient from './_components/StudentsClient'

export default async function StudentsPage() {
  const supabase = await createClient()

  const [
    { data: platforms },
    { count: totalStudents },
    { data: initialStudents },
  ] = await Promise.all([
    supabase.from('platforms').select('slug, display_name').eq('active', true).order('created_at'),
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('lead_id, student_name, email, phone, college, batch')
      .order('student_name').range(0, 24),
  ])

  return (
    <StudentsClient
      platforms={platforms || []}
      totalStudents={totalStudents || 0}
      initialStudents={initialStudents || []}
    />
  )
}
