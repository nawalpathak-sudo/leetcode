import { createClient } from '@/lib/supabase/server'
import FacultiesClient from './_components/FacultiesClient'

export default async function FacultiesPage() {
  const supabase = await createClient()

  const [
    { data: faculties, count },
    { data: campuses },
  ] = await Promise.all([
    supabase
      .from('faculties')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(0, 24),
    supabase
      .from('master_campuses')
      .select('id, name')
      .eq('active', true)
      .order('name'),
  ])

  return (
    <FacultiesClient
      initialFaculties={faculties ?? []}
      initialTotal={count ?? 0}
      campuses={campuses ?? []}
    />
  )
}
