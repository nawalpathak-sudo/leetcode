import { createClient } from '@/lib/supabase/server'
import PlatformsClient from './_components/PlatformsClient'

export default async function PlatformsPage() {
  const supabase = await createClient()

  const { data: platforms } = await supabase
    .from('platforms')
    .select('slug, display_name')
    .eq('active', true)
    .order('created_at')

  return <PlatformsClient platforms={platforms || []} />
}
