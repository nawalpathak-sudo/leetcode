import { createClient } from '@/lib/supabase/server'
import PracticeClient from './_components/PracticeClient'

export default async function PracticePage() {
  const supabase = await createClient()

  const { data: problems, count } = await supabase
    .from('practice_problems')
    .select('*', { count: 'exact' })
    .order('topic')
    .order('order_index')
    .order('created_at')

  return <PracticeClient initialProblems={problems || []} totalCount={count || 0} />
}
