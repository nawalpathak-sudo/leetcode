'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Plus, Search, X, Edit3, Trash2, Upload, Calendar, MapPin,
  ExternalLink, Loader2, ChevronLeft, ChevronRight, Image as ImageIcon,
  Clock, Filter, GripVertical
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Campus = { id: string; name: string }
type ClubOption = { id: string; name: string; campus: string }

type Event = {
  id: string
  title: string
  description: string | null
  event_date: string | null
  event_time: string | null
  location: string | null
  campus: string | null
  club_id: string | null
  event_type: string | null
  conducted_by: string | null
  registration_url: string | null
  image_url: string | null
  active: boolean
  created_at: string
  clubs?: { id: string; name: string } | null
}

type GalleryImage = {
  id: string
  event_id: string
  image_url: string
  sort_order: number
}

type Props = {
  initialEvents: Event[]
  initialTotal: number
  campuses: Campus[]
  clubs: ClubOption[]
}

const EVENT_TYPES = [
  'Workshop', 'Seminar', 'Hackathon', 'Competition', 'Cultural',
  'Sports', 'Guest Lecture', 'Webinar', 'Bootcamp', 'Festival', 'Other',
]

const PAGE_SIZE = 25

// ── Modal Wrapper ───────────────────────────────────────
function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-xl border border-[var(--color-border)] w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ── Event Row ───────────────────────────────────────────
function EventRow({
  event,
  onEdit,
  onDelete,
  onGallery,
}: {
  event: Event
  onEdit: () => void
  onDelete: () => void
  onGallery: () => void
}) {
  const isPast = event.event_date ? new Date(event.event_date) < new Date() : false
  const formattedDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-hover)]/50 transition-colors">
      {/* Thumbnail */}
      <td className="px-4 py-3">
        {event.image_url ? (
          <img src={event.image_url} alt="" className="w-12 h-8 rounded object-cover border border-[var(--color-border)]" />
        ) : (
          <div className="w-12 h-8 rounded bg-[var(--color-primary)]/5 flex items-center justify-center text-[var(--color-text-secondary)]">
            <ImageIcon size={14} />
          </div>
        )}
      </td>

      {/* Title + Description */}
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{event.title}</div>
        {event.clubs?.name && (
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{event.clubs.name}</div>
        )}
      </td>

      {/* Date */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-primary)]">
          <Calendar size={13} className="text-[var(--color-text-secondary)]" />
          {formattedDate}
        </div>
        {event.event_time && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] mt-0.5">
            <Clock size={11} />
            {event.event_time}
          </div>
        )}
      </td>

      {/* Campus */}
      <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{event.campus || '—'}</td>

      {/* Type */}
      <td className="px-4 py-3">
        {event.event_type ? (
          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-active-bg)] text-[var(--color-dark-ambient)]">
            {event.event_type}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
          isPast
            ? 'bg-gray-100 text-[var(--color-text-secondary)]'
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          {isPast ? 'Past' : 'Upcoming'}
        </span>
      </td>

      {/* Registration */}
      <td className="px-4 py-3">
        {event.registration_url ? (
          <a href={event.registration_url} target="_blank" rel="noreferrer" className="text-[var(--color-dark-ambient)] hover:underline">
            <ExternalLink size={14} />
          </a>
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={onGallery}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-dark-ambient)] hover:bg-[var(--color-active-bg)] transition-colors"
            title="Gallery"
          >
            <ImageIcon size={14} />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main Component ──────────────────────────────────────
export default function EventsClient({ initialEvents, initialTotal, campuses, clubs }: Props) {
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(0)

  // Filters
  const [filterCampus, setFilterCampus] = useState('')
  const [filterClub, setFilterClub] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterTime, setFilterTime] = useState<'upcoming' | 'past' | ''>('')
  const [search, setSearch] = useState('')

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', event_date: '', event_time: '', location: '',
    campus: '', club_id: '', event_type: '', conducted_by: '', registration_url: '', image_url: '',
  })

  // Gallery modal
  const [showGallery, setShowGallery] = useState(false)
  const [galleryEventId, setGalleryEventId] = useState<string | null>(null)
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // ── Fetch events ──────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('events')
      .select('*, clubs(id, name)', { count: 'exact' })
      .order('event_date', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterCampus) query = query.eq('campus', filterCampus)
    if (filterClub) query = query.eq('club_id', filterClub)
    if (filterType) query = query.eq('event_type', filterType)
    if (search) query = query.ilike('title', `%${search}%`)
    if (filterTime === 'upcoming') query = query.gte('event_date', new Date().toISOString().split('T')[0])
    if (filterTime === 'past') query = query.lt('event_date', new Date().toISOString().split('T')[0])

    const { data, count } = await query
    setEvents(data || [])
    setTotal(count || 0)
  }, [page, filterCampus, filterClub, filterType, filterTime, search])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  // Clubs filtered by campus
  const filteredClubs = filterCampus
    ? clubs.filter(c => c.campus === filterCampus)
    : clubs

  const formFilteredClubs = form.campus
    ? clubs.filter(c => c.campus === form.campus)
    : clubs

  // ── Open create/edit ──────────────────────────────────
  const openCreate = () => {
    setEditingEvent(null)
    setForm({
      title: '', description: '', event_date: '', event_time: '', location: '',
      campus: '', club_id: '', event_type: '', conducted_by: '', registration_url: '', image_url: '',
    })
    setError('')
    setShowModal(true)
  }

  const openEdit = (event: Event) => {
    setEditingEvent(event)
    setForm({
      title: event.title,
      description: event.description || '',
      event_date: event.event_date || '',
      event_time: event.event_time || '',
      location: event.location || '',
      campus: event.campus || '',
      club_id: event.club_id || '',
      event_type: event.event_type || '',
      conducted_by: event.conducted_by || '',
      registration_url: event.registration_url || '',
      image_url: event.image_url || '',
    })
    setError('')
    setShowModal(true)
  }

  // ── Save event ────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return }
    setError('')
    setSaving(true)

    const supabase = createClient()
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: form.event_date || null,
      event_time: form.event_time || null,
      location: form.location.trim() || null,
      campus: form.campus || null,
      club_id: form.club_id || null,
      event_type: form.event_type || null,
      conducted_by: form.conducted_by.trim() || null,
      registration_url: form.registration_url.trim() || null,
      image_url: form.image_url || null,
    }

    if (editingEvent) {
      const { error: err } = await supabase.from('events').update(payload).eq('id', editingEvent.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('events').insert(payload)
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    fetchEvents()
  }

  // ── Delete event ──────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return
    const supabase = createClient()
    await supabase.from('event_gallery').delete().eq('event_id', deleteId)
    await supabase.from('events').delete().eq('id', deleteId)
    setDeleteId(null)
    fetchEvents()
  }

  // ── Image upload ──────────────────────────────────────
  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', folder)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      return data.url || null
    } catch {
      return null
    }
  }

  // ── Gallery management ────────────────────────────────
  const openGallery = async (eventId: string) => {
    setGalleryEventId(eventId)
    setGallery([])
    setShowGallery(true)
    setGalleryLoading(true)

    const supabase = createClient()
    const { data } = await supabase
      .from('event_gallery')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order')
      .limit(50)

    setGallery(data || [])
    setGalleryLoading(false)
  }

  const uploadGalleryImages = async (files: FileList) => {
    if (!galleryEventId || files.length === 0) return
    setUploadingGallery(true)

    const supabase = createClient()
    const maxOrder = gallery.length > 0 ? Math.max(...gallery.map(g => g.sort_order)) : 0

    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i], 'gallery')
      if (url) {
        const { data } = await supabase
          .from('event_gallery')
          .insert({ event_id: galleryEventId, image_url: url, sort_order: maxOrder + i + 1 })
          .select()
          .single()

        if (data) {
          setGallery(prev => [...prev, data])
        }
      }
    }

    setUploadingGallery(false)
  }

  const deleteGalleryImage = async (id: string) => {
    const supabase = createClient()
    await supabase.from('event_gallery').delete().eq('id', id)
    setGallery(prev => prev.filter(g => g.id !== id))
  }

  const moveGalleryImage = async (id: string, direction: 'up' | 'down') => {
    const idx = gallery.findIndex(g => g.id === id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= gallery.length) return

    const supabase = createClient()
    const current = gallery[idx]
    const swap = gallery[swapIdx]

    await supabase.from('event_gallery').update({ sort_order: swap.sort_order }).eq('id', current.id)
    await supabase.from('event_gallery').update({ sort_order: current.sort_order }).eq('id', swap.id)

    setGallery(prev => {
      const updated = [...prev]
      const tempOrder = updated[idx].sort_order
      updated[idx] = { ...updated[idx], sort_order: updated[swapIdx].sort_order }
      updated[swapIdx] = { ...updated[swapIdx], sort_order: tempOrder }
      updated.sort((a, b) => a.sort_order - b.sort_order)
      return updated
    })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Events</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Manage campus events, workshops, and seminars.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          <Plus size={16} /> New Event
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCampus}
          onChange={e => { setFilterCampus(e.target.value); setFilterClub(''); setPage(0) }}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
        >
          <option value="">All Campuses</option>
          {campuses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <select
          value={filterClub}
          onChange={e => { setFilterClub(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
        >
          <option value="">All Clubs</option>
          {filteredClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
        >
          <option value="">All Types</option>
          {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filterTime}
          onChange={e => { setFilterTime(e.target.value as any); setPage(0) }}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
        >
          <option value="">All Time</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search events..."
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-primary)]/[0.03]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-16" />
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Campus</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-12">Link</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[var(--color-text-secondary)] text-sm">
                    <Calendar size={32} className="mx-auto mb-2 opacity-40" />
                    No events found.
                  </td>
                </tr>
              ) : (
                events.map(event => (
                  <EventRow
                    key={event.id}
                    event={event}
                    onEdit={() => openEdit(event)}
                    onDelete={() => setDeleteId(event.id)}
                    onGallery={() => openGallery(event.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ──────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingEvent ? 'Edit Event' : 'Create Event'}
        wide
      >
        <div className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors resize-y"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Date</label>
              <input
                type="date"
                value={form.event_date}
                onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Time</label>
              <input
                type="time"
                value={form.event_time}
                onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g., Auditorium A"
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Campus</label>
              <select
                value={form.campus}
                onChange={e => setForm(f => ({ ...f, campus: e.target.value, club_id: '' }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              >
                <option value="">Select campus...</option>
                {campuses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Club</label>
              <select
                value={form.club_id}
                onChange={e => setForm(f => ({ ...f, club_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              >
                <option value="">No club</option>
                {formFilteredClubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Event Type</label>
              <select
                value={form.event_type}
                onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              >
                <option value="">Select type...</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Conducted By</label>
              <input
                type="text"
                value={form.conducted_by}
                onChange={e => setForm(f => ({ ...f, conducted_by: e.target.value }))}
                placeholder="Speaker / organizer name"
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Registration URL</label>
              <input
                type="url"
                value={form.registration_url}
                onChange={e => setForm(f => ({ ...f, registration_url: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              />
            </div>
          </div>

          {/* Poster image */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Event Poster</label>
            <div className="flex items-start gap-4">
              {form.image_url ? (
                <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-[var(--color-border)]">
                  <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                    className="absolute top-1 right-1 p-1 rounded-md bg-white/80 text-[var(--color-danger)] hover:bg-white transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <div className="w-32 h-20 rounded-lg border-2 border-dashed border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                  <ImageIcon size={20} />
                </div>
              )}
              <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] cursor-pointer transition-colors">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Uploading...' : 'Upload Poster'}
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploading(true)
                  const url = await uploadImage(file, 'events')
                  if (url) setForm(f => ({ ...f, image_url: url }))
                  setUploading(false)
                }} />
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-primary)' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? 'Saving...' : editingEvent ? 'Update Event' : 'Create Event'}
            </button>
            <button
              onClick={() => setShowModal(false)}
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Gallery Modal ──────────────────────────────── */}
      <Modal
        open={showGallery}
        onClose={() => setShowGallery(false)}
        title="Event Gallery"
        wide
      >
        <div className="space-y-4">
          {/* Upload */}
          <label className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-ambient)] hover:text-[var(--color-text-primary)] cursor-pointer transition-colors">
            {uploadingGallery ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploadingGallery ? 'Uploading images...' : 'Click to upload gallery images (multiple allowed)'}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) uploadGalleryImages(e.target.files)
              }}
            />
          </label>

          {/* Gallery grid */}
          {galleryLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video bg-[var(--color-primary)]/[0.03] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : gallery.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] py-8 text-center">No gallery images yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {gallery.map((img, idx) => (
                <div key={img.id} className="relative group aspect-video rounded-lg overflow-hidden border border-[var(--color-border)]">
                  <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {idx > 0 && (
                      <button
                        onClick={() => moveGalleryImage(img.id, 'up')}
                        className="p-1.5 rounded-lg bg-white/90 text-[var(--color-text-primary)] hover:bg-white transition-colors"
                      >
                        <ChevronLeft size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteGalleryImage(img.id)}
                      className="p-1.5 rounded-lg bg-white/90 text-[var(--color-danger)] hover:bg-white transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    {idx < gallery.length - 1 && (
                      <button
                        onClick={() => moveGalleryImage(img.id, 'down')}
                        className="p-1.5 rounded-lg bg-white/90 text-[var(--color-text-primary)] hover:bg-white transition-colors"
                      >
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/50 text-white">
                    {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete Confirmation ─────────────────────────── */}
      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Event"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Are you sure you want to delete this event? Gallery images will also be removed. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors bg-[var(--color-danger)]"
            >
              Delete Event
            </button>
            <button
              onClick={() => setDeleteId(null)}
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
