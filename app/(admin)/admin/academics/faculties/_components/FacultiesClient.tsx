'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  GraduationCap,
  Plus,
  Search,
  X,
  Pencil,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react'

interface Faculty {
  id: string
  name: string
  email: string | null
  phone: string | null
  department: string
  designation: string
  campus_name: string
  active: boolean
  created_at: string
  updated_at: string
}

interface Campus {
  id: string
  name: string
}

interface Props {
  initialFaculties: Faculty[]
  initialTotal: number
  campuses: Campus[]
}

const PAGE_SIZE = 25

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  department: '',
  designation: '',
  campus_name: '',
}

export default function FacultiesClient({ initialFaculties, initialTotal, campuses }: Props) {
  const supabase = createClient()

  const [faculties, setFaculties] = useState<Faculty[]>(initialFaculties)
  const [total, setTotal] = useState(initialTotal)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  // Filters
  const [campusFilter, setCampusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Faculty | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchFaculties = useCallback(async () => {
    setLoading(true)
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('faculties')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(from, to)

    if (campusFilter) {
      query = query.eq('campus_name', campusFilter)
    }
    if (debouncedSearch) {
      query = query.or(`name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,department.ilike.%${debouncedSearch}%`)
    }

    const { data, count } = await query
    setFaculties(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, campusFilter, debouncedSearch, supabase])

  // Re-fetch when filters or page change (skip initial render since server already fetched)
  useEffect(() => {
    // If it's the initial state with no filters, skip
    if (page === 0 && !campusFilter && !debouncedSearch) return
    fetchFaculties()
  }, [page, campusFilter, debouncedSearch, fetchFaculties])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [campusFilter, debouncedSearch])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (f: Faculty) => {
    setEditing(f)
    setForm({
      name: f.name,
      email: f.email ?? '',
      phone: f.phone ?? '',
      department: f.department,
      designation: f.designation,
      campus_name: f.campus_name,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.campus_name) return
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      department: form.department.trim(),
      designation: form.designation.trim(),
      campus_name: form.campus_name,
    }

    if (editing) {
      await supabase.from('faculties').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('faculties').insert(payload)
    }

    setSaving(false)
    closeModal()
    fetchFaculties()
  }

  const toggleActive = async (f: Faculty) => {
    await supabase.from('faculties').update({ active: !f.active }).eq('id', f.id)
    fetchFaculties()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-active-bg)' }}
          >
            <GraduationCap size={20} style={{ color: 'var(--color-dark-ambient)' }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-primary)' }}>
              Faculties
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {total} total facult{total === 1 ? 'y' : 'ies'}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--color-primary)' }}
        >
          <Plus size={16} />
          Add Faculty
        </button>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap gap-4 items-center"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {/* Campus filter */}
        <select
          value={campusFilter}
          onChange={e => setCampusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
            '--tw-ring-color': 'var(--color-ambient)',
          } as React.CSSProperties}
        >
          <option value="">All Campuses</option>
          {campuses.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-text-secondary)' }}
          />
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
              '--tw-ring-color': 'var(--color-ambient)',
            } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-xl shadow-sm border overflow-hidden"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-ambient)' }} />
          </div>
        ) : faculties.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap size={32} className="mx-auto mb-2" style={{ color: 'var(--color-text-secondary)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              No faculties found
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                {['Name', 'Email', 'Phone', 'Department', 'Designation', 'Campus', 'Status', 'Actions'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {faculties.map((f, i) => (
                <tr
                  key={f.id}
                  className="border-t transition-colors"
                  style={{
                    borderColor: 'var(--color-border)',
                    background: i % 2 === 1 ? 'var(--color-bg)' : undefined,
                  }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {f.name}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.email || '-'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.phone || '-'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.department || '-'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.designation || '-'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {f.campus_name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: f.active ? 'rgba(59,195,226,0.1)' : 'rgba(239,68,68,0.1)',
                        color: f.active ? 'var(--color-dark-ambient)' : 'var(--color-danger)',
                      }}
                    >
                      {f.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(f)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                        title="Edit"
                      >
                        <Pencil size={14} style={{ color: 'var(--color-text-secondary)' }} />
                      </button>
                      <button
                        onClick={() => toggleActive(f)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                        title={f.active ? 'Deactivate' : 'Activate'}
                      >
                        {f.active ? (
                          <ToggleRight size={16} style={{ color: 'var(--color-dark-ambient)' }} />
                        ) : (
                          <ToggleLeft size={16} style={{ color: 'var(--color-text-secondary)' }} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg border transition-colors disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <ChevronLeft size={16} style={{ color: 'var(--color-text-secondary)' }} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg border transition-colors disabled:opacity-40"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <ChevronRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
                {editing ? 'Edit Faculty' : 'Add Faculty'}
              </h2>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Name <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--color-border)', '--tw-ring-color': 'var(--color-ambient)' } as React.CSSProperties}
                  placeholder="Full name"
                />
              </div>

              {/* Email + Phone row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', '--tw-ring-color': 'var(--color-ambient)' } as React.CSSProperties}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', '--tw-ring-color': 'var(--color-ambient)' } as React.CSSProperties}
                    placeholder="9876543210"
                  />
                </div>
              </div>

              {/* Department + Designation row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Department
                  </label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', '--tw-ring-color': 'var(--color-ambient)' } as React.CSSProperties}
                    placeholder="Computer Science"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                    Designation
                  </label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: 'var(--color-border)', '--tw-ring-color': 'var(--color-ambient)' } as React.CSSProperties}
                    placeholder="Assistant Professor"
                  />
                </div>
              </div>

              {/* Campus */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Campus <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <select
                  value={form.campus_name}
                  onChange={e => setForm(f => ({ ...f, campus_name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ borderColor: 'var(--color-border)', '--tw-ring-color': 'var(--color-ambient)' } as React.CSSProperties}
                >
                  <option value="">Select campus</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.campus_name}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                style={{ background: 'var(--color-primary)' }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
