import { createClient } from '@/lib/supabase/server'
import ProjectsClient from './_components/ProjectsClient'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const { data: projects, count } = await supabase
    .from('projects')
    .select('*, students(student_name, student_username, college, batch)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 24)

  const initial = (projects || []).map((p: any) => ({
    ...p,
    student_name: p.students?.student_name || '',
    student_username: p.students?.student_username || '',
    college: p.students?.college || '',
    batch: p.students?.batch || '',
  }))

  return <ProjectsClient initialProjects={initial} totalCount={count || 0} />
}
