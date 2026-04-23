import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Instagram,
  Mail,
  Users,
  Calendar,
  MapPin,
  Crown,
  Star,
} from 'lucide-react'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('clubs')
    .select('name, description, campus_name')
    .eq('id', id)
    .limit(1)
    .single()

  if (!data) return { title: 'Club Not Found' }

  return {
    title: `${data.name} — ${data.campus_name}`,
    description: data.description || `${data.name} club at ALTA ${data.campus_name}`,
  }
}

export default async function ClubDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [clubRes, membersRes, eventsRes] = await Promise.all([
    supabase
      .from('clubs')
      .select('*')
      .eq('id', id)
      .limit(1)
      .single(),

    supabase
      .from('club_members')
      .select('id, role, joined_at, students(name)')
      .eq('club_id', id)
      .order('role', { ascending: true }),

    supabase
      .from('events')
      .select('id, title, image_url, event_date, event_time, location, event_type, registration_url')
      .eq('club_id', id)
      .eq('active', true)
      .order('event_date', { ascending: false })
      .limit(12),
  ])

  const club = clubRes.data
  if (!club) notFound()

  const members = membersRes.data ?? []
  const events = eventsRes.data ?? []

  const leads = members.filter((m: any) => m.role === 'lead' || m.role === 'co_lead')
  const regularMembers = members.filter((m: any) => m.role === 'member')

  const today = new Date().toISOString().split('T')[0]
  const upcomingEvents = events.filter((e: any) => e.event_date && e.event_date >= today)
  const pastEvents = events.filter((e: any) => !e.event_date || e.event_date < today)

  return (
    <div>
      {/* Back Link */}
      <Link
        href="/clubs"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 text-white/40 hover:text-[#F59E0B] transition-colors duration-150"
      >
        <ArrowLeft className="w-4 h-4" />
        All Clubs
      </Link>

      {/* Cover Image / Gradient */}
      <div className="relative rounded-2xl overflow-hidden mb-8">
        {club.cover_url ? (
          <>
            <img
              src={club.cover_url}
              alt={club.name}
              className="w-full h-48 sm:h-72 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050A18] via-[#050A18]/40 to-transparent" />
          </>
        ) : (
          <div className="w-full h-48 sm:h-72 bg-gradient-to-br from-[#F59E0B]/20 via-[#050A18] to-[#D97706]/10" />
        )}
      </div>

      {/* Club Info Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-6 mb-12">
        {club.logo_url ? (
          <img
            src={club.logo_url}
            alt={club.name}
            className="w-20 h-20 rounded-2xl object-cover ring-2 ring-white/10 -mt-16 sm:-mt-20 relative z-10 flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white font-bold text-3xl ring-2 ring-white/10 -mt-16 sm:-mt-20 relative z-10 flex-shrink-0">
            {club.name.charAt(0)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            {club.name}
          </h1>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs px-3 py-1 rounded-full font-medium border border-[#F59E0B]/20 bg-[#F59E0B]/5 text-[#F59E0B]">
              {club.campus_name}
            </span>
            <span className="text-xs px-3 py-1 rounded-full capitalize bg-white/[0.04] text-white/40 border border-white/[0.06]">
              {club.category}
            </span>
            <span className="text-xs flex items-center gap-1 text-white/30">
              <Users className="w-3.5 h-3.5" />
              {members.length} member{members.length !== 1 ? 's' : ''}
            </span>
          </div>

          {club.description && (
            <p className="mt-5 text-sm leading-relaxed max-w-2xl text-white/50">
              {club.description}
            </p>
          )}

          {/* Social Links */}
          {(club.instagram_url || club.email) && (
            <div className="flex items-center gap-3 mt-5">
              {club.instagram_url && (
                <a
                  href={club.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:border-white/20 bg-white/[0.03] transition-all duration-150"
                >
                  <Instagram className="w-4 h-4" />
                  Instagram
                </a>
              )}
              {club.email && (
                <a
                  href={`mailto:${club.email}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-white/10 text-white/70 hover:text-white hover:border-white/20 bg-white/[0.03] transition-all duration-150"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Club Team */}
      {members.length > 0 && (
        <section className="mb-14">
          <h2 className="text-xl font-bold text-white mb-6">
            Club Team
          </h2>

          {/* Leads */}
          {leads.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-4 text-white/40 uppercase tracking-wider">
                Leadership
              </h3>
              <div className="flex flex-wrap gap-3">
                {leads.map((m: any) => (
                  <div
                    key={m.id}
                    className="cv-glass flex items-center gap-3 px-5 py-3 rounded-2xl"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#F59E0B]/10">
                      {m.role === 'lead' ? (
                        <Crown className="w-4 h-4 text-[#F59E0B]" />
                      ) : (
                        <Star className="w-4 h-4 text-[#F59E0B]" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {(m.students as any)?.name ?? 'Unknown'}
                      </p>
                      <p className="text-xs capitalize text-white/40">
                        {m.role.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regular Members */}
          {regularMembers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-4 text-white/40 uppercase tracking-wider">
                Members ({regularMembers.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {regularMembers.map((m: any) => (
                  <span
                    key={m.id}
                    className="px-4 py-2 rounded-xl text-sm text-white/70 bg-white/[0.04] border border-white/[0.06]"
                  >
                    {(m.students as any)?.name ?? 'Unknown'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Events by this Club */}
      {events.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-white mb-6">
            Events by {club.name}
          </h2>

          {/* Upcoming */}
          {upcomingEvents.length > 0 && (
            <div className="mb-10">
              <h3 className="text-sm font-medium mb-4 text-[#F59E0B] uppercase tracking-wider">
                Upcoming
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                          className="w-full h-36 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050A18] via-transparent to-transparent" />
                      </div>
                    ) : (
                      <div className="w-full h-36 flex items-center justify-center bg-white/[0.02]">
                        <Calendar className="w-8 h-8 text-white/10" />
                      </div>
                    )}
                    <div className="p-4">
                      <p className="text-xs font-semibold mb-1.5 text-[#F59E0B]">
                        {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {event.event_time ? ` at ${event.event_time}` : ''}
                      </p>
                      <h4 className="font-semibold text-sm text-white group-hover:text-[#F59E0B] transition-colors line-clamp-1">
                        {event.title}
                      </h4>
                      {event.location && (
                        <p className="flex items-center gap-1 text-xs mt-1.5 text-white/30">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {pastEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-4 text-white/30 uppercase tracking-wider">
                Past Events
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {pastEvents.map((event: any) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="cv-glass cv-glass-hover group rounded-xl overflow-hidden transition-all duration-200"
                  >
                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-24 object-cover opacity-60"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-white/[0.02]">
                        <Calendar className="w-6 h-6 text-white/10" />
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="font-medium text-xs text-white/70 group-hover:text-[#F59E0B] transition-colors line-clamp-1">
                        {event.title}
                      </h4>
                      {event.event_date && (
                        <p className="text-xs mt-1 text-white/30">
                          {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
