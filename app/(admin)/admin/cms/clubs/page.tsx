import { createClient } from '@/lib/supabase/server'
import ClubsClient from './_components/ClubsClient'

export default async function ClubsPage() {
  const supabase = await createClient()

  // Fetch clubs with member count
  const { data: clubs } = await supabase
    .from('clubs')
    .select('*, club_members(count)')
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch campuses for dropdown
  const { data: campusData } = await supabase
    .from('master_campuses')
    .select('id, name')
    .eq('active', true)
    .order('name')

  const campuses = (campusData || []).map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }))

  // Normalize clubs with member_count
  const normalizedClubs = (clubs || []).map((club: any) => ({
    ...club,
    member_count: club.club_members?.[0]?.count || 0,
    club_members: undefined,
  }))

  return <ClubsClient initialClubs={normalizedClubs} campuses={campuses} />
}
