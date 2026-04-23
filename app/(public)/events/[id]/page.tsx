import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Users,
  Zap,
} from 'lucide-react'
import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('title, description, campus_name, image_url')
    .eq('id', id)
    .limit(1)
    .single()

  if (!data) return { title: 'Event Not Found' }

  return {
    title: data.title,
    description: data.description || `Event at ALTA ${data.campus_name}`,
    openGraph: data.image_url ? { images: [data.image_url] } : undefined,
  }
}

export default async function EventDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [eventRes, galleryRes] = await Promise.all([
    supabase
      .from('events')
      .select('*, clubs(id, name, logo_url, campus_name)')
      .eq('id', id)
      .limit(1)
      .single(),

    supabase
      .from('event_gallery')
      .select('id, image_url, caption, sort_order')
      .eq('event_id', id)
      .order('sort_order', { ascending: true })
      .limit(20),
  ])

  const event = eventRes.data
  if (!event) notFound()

  const gallery = galleryRes.data ?? []
  const club = event.clubs as any

  const isUpcoming =
    event.event_date && event.event_date >= new Date().toISOString().split('T')[0]

  return (
    <div>
      {/* Back Link */}
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-8 text-white/40 hover:text-[#F59E0B] transition-colors duration-150"
      >
        <ArrowLeft className="w-4 h-4" />
        All Events
      </Link>

      {/* Poster Image */}
      <div className="relative rounded-2xl overflow-hidden mb-10">
        {event.image_url ? (
          <>
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-56 sm:h-72 lg:h-[420px] object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050A18] via-[#050A18]/30 to-transparent" />
          </>
        ) : (
          <div className="w-full h-56 sm:h-72 lg:h-[420px] flex items-center justify-center bg-gradient-to-br from-[#F59E0B]/10 via-[#050A18] to-[#D97706]/5">
            <Calendar className="w-20 h-20 text-white/[0.06]" />
          </div>
        )}
      </div>

      {/* Event Content */}
      <div className="max-w-3xl">
        {/* Type + Campus badges */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {event.event_type && (
            <span className="text-xs font-medium px-3 py-1 rounded-full capitalize bg-white/[0.04] text-white/50 border border-white/[0.06]">
              {event.event_type}
            </span>
          )}
          <span className="text-xs font-medium px-3 py-1 rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/5 text-[#F59E0B]">
            {event.campus_name}
          </span>
          {isUpcoming && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Upcoming
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-8 text-white">
          {event.title}
        </h1>

        {/* Date / Time / Location Info */}
        <div className="cv-glass flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 mb-10 p-5 rounded-2xl">
          {event.event_date && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F59E0B]/10">
                <Calendar className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <span className="text-sm font-medium text-white">
                {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
          {event.event_time && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F59E0B]/10">
                <Clock className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <span className="text-sm text-white/70">
                {event.event_time}
              </span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F59E0B]/10">
                <MapPin className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <span className="text-sm text-white/70">
                {event.location}
              </span>
            </div>
          )}
        </div>

        {/* Conducted by (club) */}
        {club && (
          <div className="mb-10">
            <p className="text-xs font-medium uppercase tracking-wider mb-3 text-white/30">
              Conducted by
            </p>
            <Link
              href={`/clubs/${club.id}`}
              className="cv-glass cv-glass-hover inline-flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-200"
            >
              {club.logo_url ? (
                <img
                  src={club.logo_url}
                  alt={club.name}
                  className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white font-bold text-sm">
                  {club.name.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-white">
                  {club.name}
                </p>
                <p className="text-xs text-white/40">
                  {club.campus_name}
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* Non-club conducted_by */}
        {!club && event.conducted_by && (
          <div className="mb-10">
            <p className="text-xs font-medium uppercase tracking-wider mb-3 text-white/30">
              Conducted by
            </p>
            <div className="cv-glass inline-flex items-center gap-3 px-5 py-3 rounded-2xl">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#F59E0B]/10">
                <Users className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <span className="text-sm font-medium text-white">
                {event.conducted_by}
              </span>
            </div>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="mb-12">
            <p className="text-xs font-medium uppercase tracking-wider mb-4 text-white/30">
              About this Event
            </p>
            <div className="text-sm leading-relaxed whitespace-pre-line text-white/50">
              {event.description}
            </div>
          </div>
        )}

        {/* Register Button */}
        {event.registration_url && isUpcoming && (
          <a
            href={event.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            className="cv-glow-btn inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl font-bold text-base transition-all duration-200 hover:shadow-[0_0_40px_rgba(245,158,11,0.3)] mb-14"
          >
            Register Now
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Gallery */}
      {gallery.length > 0 && (
        <section className="mt-14">
          <h2 className="text-xl font-bold text-white mb-8">
            Gallery
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {gallery.map((img: any) => (
              <div key={img.id} className="group">
                <div className="cv-glass rounded-2xl overflow-hidden">
                  <img
                    src={img.image_url}
                    alt={img.caption || event.title}
                    className="w-full h-40 sm:h-48 object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                </div>
                {img.caption && (
                  <p className="text-xs mt-2 line-clamp-1 text-white/30">
                    {img.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
