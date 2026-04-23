import { createClient } from '@/lib/supabase/server'
import SettingsClient from './_components/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: campuses } = await supabase
    .from('master_campuses')
    .select('id, name, code, city, active')
    .order('name')

  return <SettingsClient initialCampuses={campuses || []} />
}
