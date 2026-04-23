import { createClient } from '@/lib/supabase/server'
import { fetchBOS, fetchBOSSubjects, fetchBOSAssignments, fetchCategories } from '../_lib/queries'
import BOSDetailClient from '../_components/BOSDetailClient'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ bosId: string }>
}

export default async function BOSDetailPage({ params }: Props) {
  const { bosId } = await params
  const supabase = await createClient()

  const [bos, subjects, assignments, categories] = await Promise.all([
    fetchBOS(supabase, bosId),
    fetchBOSSubjects(supabase, bosId),
    fetchBOSAssignments(supabase, bosId),
    fetchCategories(supabase),
  ])

  if (!bos) notFound()

  return (
    <BOSDetailClient
      bos={bos}
      initialSubjects={subjects}
      initialAssignments={assignments}
      categories={categories}
    />
  )
}
