import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, MapPin, Search, Zap } from 'lucide-react'
import type { Metadata } from 'next'
import { EventsFilter } from './events-filter'

export const metadata: Metadata = {
  title: 'Events',
  description:
    'Upcoming and past events at ALTA School of Technology. Workshops, hackathons, seminars, and more.',
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string; type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  let baseQuery = supabase
    .from('events')
    .select('id, title, description, campus_name, image_url, event_date, event_time, location, event_type, registration_url, clubs(name)')
    .eq('active', true)

  if (params.campus) {
    baseQuery = baseQuery.eq('campus_name', params.campus)
  }
  if (params.type) {
    baseQuery = baseQuery.eq('event_type', params.type)
  }

  const { data: allEvents } = await baseQuery.order('event_date', { ascending: false })

  const events = allEvents ?? []
  const upcomingEvents = events.filter((e: any) => e.event_date && e.event_date >= today)
  const pastEvents = events.filter((e: any) => !e.event_date || e.event_date < today)

  // Sort upcoming ascending (closest first)
  upcomingEvents.sort((a: any, b: any) =>
    (a.event_date ?? '').localeCompare(b.event_date ?? '')
  )

  // Fetch distinct campuses for filter
  const { data: campusData } = await supabase
    .from('events')
    .select('campus_name')
    .eq('active', true)

  const campuses = [...new Set((campusData ?? []).map((e: any) => e.campus_name))] as string[]
  const eventTypes = ['workshop', 'hackathon', 'seminar', 'competition', 'cultural', 'other']

  return (
    <div>
      {/* Page Header */}
      <div className="mb-10 pt-4">
        <h1 className="text-3xl sm:text-4xl font-bold">
          <span className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] bg-clip-text text-transparent">
            Events
          </span>
        </h1>
        <p className="text-base mt-3 text-white/50">
          Workshops, hackathons, seminars, and everything happening on campus
        </p>
      </div>

      {/* Filters (Client Component) */}
      <EventsFilter
        campuses={campuses}
        eventTypes={eventTypes}
        activeCampus={params.campus ?? ''}
        activeType={params.type ?? ''}
      />

      {events.length === 0 && (
        <div className="text-center py-24">
          <Search className="w-12 h-12 mx-auto mb-4 text-white/10" />
          <p className="text-white/40 text-lg">
            No events found. Try adjusting your filters.
          </p>
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <section className="mb-16">
          <h2 className="text-xl font-bold mb-8 flex items-center gap-2.5 text-white">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#F59E0B]/10">
              <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
            </span>
            Upcoming Events
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {upcomingEvents.map((event: any) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="cv-glass cv-glass-hover group rounded-2xl overflow-hidden transition-all duration-200"
              >
                {event.image_url ? (
                  <div className="relative">
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-56 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050A18] via-transparent to-transparent" />
                  </div>
                ) : (
                  <div className="w-full h-56 flex items-center justify-center bg-white/[0.02]">
                    <Calendar className="w-14 h-14 text-white/[0.06]" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {event.event_date && (
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                        {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {event.event_time ? ` | ${event.event_time}` : ''}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-0.5 rounded-full capitalize bg-white/[0.04] text-white/40 border border-white/[0.06]">
                      {event.event_type}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-white group-hover:text-[#F59E0B] transition-colors line-clamp-2">
                    {event.title}
                  </h3>

                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    {event.location && (
                      <p className="flex items-center gap-1.5 text-sm text-white/40">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        {event.location}
                      </p>
                    )}
                    <span className="text-xs px-2.5 py-0.5 rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/5 text-[#F59E0B]">
                      {event.campus_name}
                    </span>
                  </div>

                  {event.clubs?.name && (
                    <p className="text-sm mt-2 text-white/30">
                      by {event.clubs.name}
                    </p>
                  )}

                  {event.registration_url && (
                    <span className="cv-glow-btn inline-block mt-5 text-sm font-semibold px-5 py-2.5 rounded-xl">
                      Register Now
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-8 text-white/50">
            Past Events
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {pastEvents.map((event: any) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="cv-glass cv-glass-hover group rounded-2xl overflow-hidden transition-all duration-200"
              >
                {event.image_url ? (
                  <div className="relative">
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-32 sm:h-36 object-cover opacity-50"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050A18]/80 to-transparent" />
                  </div>
                ) : (
                  <div className="w-full h-32 sm:h-36 flex items-center justify-center bg-white/[0.02]">
                    <Calendar className="w-8 h-8 text-white/[0.06]" />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="font-semibold text-sm text-white/60 group-hover:text-[#F59E0B] transition-colors line-clamp-1">
                    {event.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {event.event_date && (
                      <p className="text-xs text-white/30">
                        {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                    <span className="text-xs capitalize text-white/20">
                      {event.event_type}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
