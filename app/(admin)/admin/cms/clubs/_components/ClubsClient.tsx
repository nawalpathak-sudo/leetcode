'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Plus, Search, X, Edit3, Trash2, Upload, Users, Instagram,
  Mail, Loader2, ChevronLeft, ChevronRight, Image as ImageIcon,
  ToggleLeft, ToggleRight, UserPlus
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Campus = { id: string; name: string }

type Club = {
  id: string
  name: string
  description: string | null
  campus: string
  category: string | null
  logo_url: string | null
  cover_url: string | null
  instagram_url: string | null
  email: string | null
  active: boolean
  member_count: number
  created_at: string
}

type ClubMember = {
  id: string
  student_id: string
  role: string
  student_name?: string
}

type Props = {
  initialClubs: Club[]
  campuses: Campus[]
}

const CATEGORIES = [
  'Technical', 'Cultural', 'Sports', 'Literary', 'Social Service',
  'Media', 'Entrepreneurship', 'Music', 'Art', 'Other',
]

const PAGE_SIZE = 25

// ── Modal Wrapper ───────────────────────────────────────
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl border border-[var(--color-border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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

// ── Club Card ───────────────────────────────────────────
function ClubCard({
  club,
  onEdit,
  onDelete,
  onManageMembers,
}: {
  club: Club
  onEdit: () => void
  onDelete: () => void
  onManageMembers: () => void
}) {
  return (
    <div className={`bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden transition-opacity ${!club.active ? 'opacity-60' : ''}`}>
      {/* Cover / Logo */}
      <div className="h-24 bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-ambient)]/10 relative flex items-center justify-center">
        {club.logo_url ? (
          <img src={club.logo_url} alt={club.name} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-xl">
            {club.name.charAt(0)}
          </div>
        )}
        {!club.active && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-[var(--color-danger)] border border-red-100">
            Inactive
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{club.name}</h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{club.campus}</p>
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
          {club.category && (
            <span className="px-2 py-0.5 rounded-md bg-[var(--color-active-bg)] text-[var(--color-dark-ambient)] font-medium">
              {club.category}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={12} /> {club.member_count}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          {club.instagram_url && (
            <a href={club.instagram_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-[var(--color-hover)] transition-colors">
              <Instagram size={14} />
            </a>
          )}
          {club.email && (
            <a href={`mailto:${club.email}`} className="p-1.5 rounded-lg hover:bg-[var(--color-hover)] transition-colors">
              <Mail size={14} />
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
          <button
            onClick={onManageMembers}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-[var(--color-dark-ambient)] hover:bg-[var(--color-active-bg)] transition-colors"
          >
            <UserPlus size={13} /> Members
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
      </div>
    </div>
  )
}

// ── Main Component ──────────────────────────────────────
export default function ClubsClient({ initialClubs, campuses }: Props) {
  const [clubs, setClubs] = useState<Club[]>(initialClubs)
  const [filterCampus, setFilterCampus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(initialClubs.length)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingClub, setEditingClub] = useState<Club | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', campus: '', category: '',
    instagram_url: '', email: '', logo_url: '', cover_url: '',
  })

  // Members modal
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [membersClub, setMembersClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<ClubMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<any[]>([])
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [assignRole, setAssignRole] = useState('member')

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Upload states
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  const [error, setError] = useState('')

  // ── Fetch clubs with filters ──────────────────────────
  const fetchClubs = useCallback(async () => {
    const supabase = createClient()
    let query = supabase
      .from('clubs')
      .select('*, club_members(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterCampus) query = query.eq('campus', filterCampus)
    if (search) query = query.ilike('name', `%${search}%`)

    const { data, count } = await query
    const normalized = (data || []).map((club: any) => ({
      ...club,
      member_count: club.club_members?.[0]?.count || 0,
      club_members: undefined,
    }))
    setClubs(normalized)
    setTotal(count || 0)
  }, [filterCampus, search, page])

  useEffect(() => { fetchClubs() }, [fetchClubs])

  // ── Open create/edit modal ────────────────────────────
  const openCreate = () => {
    setEditingClub(null)
    setForm({ name: '', description: '', campus: '', category: '', instagram_url: '', email: '', logo_url: '', cover_url: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = (club: Club) => {
    setEditingClub(club)
    setForm({
      name: club.name,
      description: club.description || '',
      campus: club.campus || '',
      category: club.category || '',
      instagram_url: club.instagram_url || '',
      email: club.email || '',
      logo_url: club.logo_url || '',
      cover_url: club.cover_url || '',
    })
    setError('')
    setShowModal(true)
  }

  // ── Save club ─────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setError('Club name is required.'); return }
    if (!form.campus) { setError('Campus is required.'); return }
    setError('')
    setSaving(true)

    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      campus: form.campus,
      category: form.category || null,
      instagram_url: form.instagram_url.trim() || null,
      email: form.email.trim() || null,
      logo_url: form.logo_url || null,
      cover_url: form.cover_url || null,
    }

    if (editingClub) {
      const { error: err } = await supabase.from('clubs').update(payload).eq('id', editingClub.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('clubs').insert(payload)
      if (err) { setError(err.message); setSaving(false); return }
    }

    setSaving(false)
    setShowModal(false)
    fetchClubs()
  }

  // ── Delete club ───────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return
    const supabase = createClient()
    await supabase.from('club_members').delete().eq('club_id', deleteId)
    await supabase.from('clubs').delete().eq('id', deleteId)
    setDeleteId(null)
    fetchClubs()
  }

  // ── Image upload helper ───────────────────────────────
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

  // ── Members management ────────────────────────────────
  const openMembers = async (club: Club) => {
    setMembersClub(club)
    setMembers([])
    setStudentSearch('')
    setStudentResults([])
    setShowMembersModal(true)
    setMembersLoading(true)

    const supabase = createClient()
    const { data } = await supabase
      .from('club_members')
      .select('id, student_id, role, students(student_name)')
      .eq('club_id', club.id)
      .order('role')
      .limit(100)

    setMembers((data || []).map((m: any) => ({
      id: m.id,
      student_id: m.student_id,
      role: m.role,
      student_name: m.students?.student_name || 'Unknown',
    })))
    setMembersLoading(false)
  }

  const searchStudents = async (term: string) => {
    setStudentSearch(term)
    if (term.length < 2) { setStudentResults([]); return }
    setSearchingStudents(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('students')
      .select('lead_id, student_name')
      .ilike('student_name', `%${term}%`)
      .eq('active_status', 'Active')
      .limit(10)
    setStudentResults(data || [])
    setSearchingStudents(false)
  }

  const assignMember = async (studentId: string, studentName: string) => {
    if (!membersClub) return
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('club_members')
      .insert({ club_id: membersClub.id, student_id: studentId, role: assignRole })
      .select('id')
      .single()

    if (!err && data) {
      setMembers(prev => [...prev, { id: data.id, student_id: studentId, role: assignRole, student_name: studentName }])
      setStudentSearch('')
      setStudentResults([])
    }
  }

  const removeMember = async (memberId: string) => {
    const supabase = createClient()
    await supabase.from('club_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  // ── Filtered display ──────────────────────────────────
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Clubs</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Manage student clubs, assign leads, and track membership.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          <Plus size={16} /> New Club
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCampus}
          onChange={e => { setFilterCampus(e.target.value); setPage(0) }}
          className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
        >
          <option value="">All Campuses</option>
          {campuses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search clubs..."
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(0) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Club cards grid */}
      {clubs.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center shadow-sm">
          <Users size={40} className="mx-auto text-[var(--color-text-secondary)] mb-3" />
          <p className="text-sm text-[var(--color-text-secondary)]">No clubs found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {clubs.map(club => (
              <ClubCard
                key={club.id}
                club={club}
                onEdit={() => openEdit(club)}
                onDelete={() => setDeleteId(club.id)}
                onManageMembers={() => openMembers(club)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
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
        </>
      )}

      {/* ── Create/Edit Modal ──────────────────────────── */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingClub ? 'Edit Club' : 'Create Club'}
      >
        <div className="space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Club Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Campus *</label>
              <select
                value={form.campus}
                onChange={e => setForm(f => ({ ...f, campus: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              >
                <option value="">Select campus...</option>
                {campuses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              />
            </div>
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

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Instagram URL</label>
            <input
              type="url"
              value={form.instagram_url}
              onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value }))}
              placeholder="https://instagram.com/..."
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
            />
          </div>

          {/* Logo + Cover uploads */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Logo</label>
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="w-12 h-12 rounded-full object-cover border border-[var(--color-border)]" />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                    <ImageIcon size={16} />
                  </div>
                )}
                <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] cursor-pointer transition-colors">
                  {uploadingLogo ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploadingLogo(true)
                    const url = await uploadImage(file, 'clubs')
                    if (url) setForm(f => ({ ...f, logo_url: url }))
                    setUploadingLogo(false)
                  }} />
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Cover Image</label>
              <div className="flex items-center gap-3">
                {form.cover_url ? (
                  <img src={form.cover_url} alt="Cover" className="w-20 h-12 rounded-lg object-cover border border-[var(--color-border)]" />
                ) : (
                  <div className="w-20 h-12 rounded-lg border-2 border-dashed border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                    <ImageIcon size={16} />
                  </div>
                )}
                <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] cursor-pointer transition-colors">
                  {uploadingCover ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploadingCover(true)
                    const url = await uploadImage(file, 'clubs')
                    if (url) setForm(f => ({ ...f, cover_url: url }))
                    setUploadingCover(false)
                  }} />
                </label>
              </div>
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
              {saving ? 'Saving...' : editingClub ? 'Update Club' : 'Create Club'}
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

      {/* ── Members Modal ──────────────────────────────── */}
      <Modal
        open={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        title={`Members — ${membersClub?.name || ''}`}
      >
        <div className="space-y-4">
          {/* Add member */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)]">Add Member</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={e => searchStudents(e.target.value)}
                  placeholder="Search student by name..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
                />
                {searchingStudents && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-text-secondary)]" />
                )}
              </div>
              <select
                value={assignRole}
                onChange={e => setAssignRole(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              >
                <option value="member">Member</option>
                <option value="lead">Lead</option>
                <option value="co_lead">Co-Lead</option>
              </select>
            </div>

            {/* Search results dropdown */}
            {studentResults.length > 0 && (
              <div className="border border-[var(--color-border)] rounded-lg bg-white shadow-md max-h-40 overflow-y-auto">
                {studentResults.map((s: any) => (
                  <button
                    key={s.lead_id}
                    onClick={() => assignMember(s.lead_id, s.student_name)}
                    className="w-full px-4 py-2.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors border-b border-[var(--color-border)] last:border-0"
                  >
                    {s.student_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current members */}
          {membersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-[var(--color-primary)]/[0.03] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">No members yet.</p>
          ) : (
            <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{m.student_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      m.role === 'lead'
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : m.role === 'co_lead'
                        ? 'bg-[var(--color-active-bg)] text-[var(--color-dark-ambient)]'
                        : 'bg-gray-100 text-[var(--color-text-secondary)]'
                    }`}>
                      {m.role === 'co_lead' ? 'Co-Lead' : m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeMember(m.id)}
                    className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
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
        title="Delete Club"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Are you sure you want to delete this club? This will also remove all member associations. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors bg-[var(--color-danger)]"
            >
              Delete Club
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
