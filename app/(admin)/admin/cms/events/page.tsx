import { createClient } from '@/lib/supabase/server'
import EventsClient from './_components/EventsClient'

export default async function EventsPage() {
  const supabase = await createClient()

  // Fetch events with club name
  const { data: events } = await supabase
    .from('events')
    .select('*, clubs(id, name)')
    .order('event_date', { ascending: false })
    .range(0, 24)

  // Total count for pagination
  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })

  // Campuses for filter
  const { data: campusData } = await supabase
    .from('master_campuses')
    .select('id, name')
    .eq('active', true)
    .order('name')

  // Clubs for filter/dropdown
  const { data: clubsData } = await supabase
    .from('clubs')
    .select('id, name, campus')
    .eq('active', true)
    .order('name')

  return (
    <EventsClient
      initialEvents={events || []}
      initialTotal={totalEvents || 0}
      campuses={(campusData || []).map((c: any) => ({ id: c.id, name: c.name }))}
      clubs={(clubsData || []).map((c: any) => ({ id: c.id, name: c.name, campus: c.campus }))}
    />
  )
}
