import { createClient } from '@/lib/supabase/server'
import ProblemsClient from './_components/ProblemsClient'

export default async function ProblemsPage() {
  const supabase = await createClient()

  const { data: problems, count } = await supabase
    .from('practice_problems')
    .select('*', { count: 'exact' })
    .order('topic')
    .order('order_index')
    .order('created_at')
    .range(0, 99)

  return <ProblemsClient initialProblems={problems || []} totalCount={count || 0} />
}
