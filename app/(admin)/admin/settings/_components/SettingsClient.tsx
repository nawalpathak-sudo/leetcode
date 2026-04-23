'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Building2, GraduationCap, Check, X, Edit3 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Campus = {
  id: string
  name: string
  code: string
  city: string | null
  active: boolean
}

type Batch = {
  id: string
  campus_id: string
  admission_year: number
  program: string
  active: boolean
}

function CampusRow({
  campus,
  onUpdate,
  onDelete,
  onSelect,
  selected,
}: {
  campus: Campus
  onUpdate: (id: string, fields: Partial<Campus>) => Promise<void>
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  selected: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState(campus)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onUpdate(campus.id, { name: f.name, code: f.code, city: f.city, active: f.active })
      setEditing(false)
    } catch {
      // handled upstream
    }
    setSaving(false)
  }

  if (editing) {
    return (
      <tr style={{ background: 'rgba(59,195,226,0.05)' }}>
        <td className="px-4 py-2">
          <input
            value={f.name}
            onChange={e => setF({ ...f, name: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border rounded"
            style={{ borderColor: 'rgba(13,30,86,0.15)' }}
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={f.code || ''}
            onChange={e => setF({ ...f, code: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border rounded"
            style={{ borderColor: 'rgba(13,30,86,0.15)' }}
          />
        </td>
        <td className="px-4 py-2">
          <input
            value={f.city || ''}
            onChange={e => setF({ ...f, city: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border rounded"
            style={{ borderColor: 'rgba(13,30,86,0.15)' }}
          />
        </td>
        <td className="px-4 py-2 text-center">
          <input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />
        </td>
        <td className="px-4 py-2">
          <div className="flex gap-1">
            <button
              onClick={save}
              disabled={saving}
              className="p-1 rounded hover:opacity-80"
              style={{ color: 'var(--color-dark-ambient)' }}
            >
              <Check size={14} />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="p-1 rounded"
              style={{ color: 'rgba(13,30,86,0.3)' }}
            >
              <X size={14} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr
      onClick={() => onSelect(campus.id)}
      className="group cursor-pointer transition-colors"
      style={{
        background: selected ? 'rgba(59,195,226,0.05)' : undefined,
      }}
      onMouseEnter={e => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(13,30,86,0.02)'
      }}
      onMouseLeave={e => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = ''
      }}
    >
      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
        {campus.name}
      </td>
      <td className="px-4 py-3 text-sm font-mono" style={{ color: 'rgba(13,30,86,0.5)' }}>
        {campus.code}
      </td>
      <td className="px-4 py-3 text-sm" style={{ color: 'rgba(13,30,86,0.4)' }}>
        {campus.city || '\u2014'}
      </td>
      <td className="px-4 py-3 text-center">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: campus.active ? 'var(--color-dark-ambient)' : 'rgba(13,30,86,0.2)' }}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => {
              e.stopPropagation()
              setF(campus)
              setEditing(true)
            }}
            className="p-1 rounded"
            style={{ color: 'rgba(13,30,86,0.25)' }}
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={e => {
              e.stopPropagation()
              onDelete(campus.id)
            }}
            className="p-1 rounded hover:text-red-500"
            style={{ color: 'rgba(13,30,86,0.15)' }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function SettingsClient({ initialCampuses }: { initialCampuses: Campus[] }) {
  const supabase = createClient()
  const [campuses, setCampuses] = useState<Campus[]>(initialCampuses)
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedCampus, setSelectedCampus] = useState<string | null>(null)
  const [newCampus, setNewCampus] = useState({ name: '', code: '', city: '' })
  const [addingCampus, setAddingCampus] = useState(false)
  const [newBatch, setNewBatch] = useState({ admission_year: new Date().getFullYear(), program: 'B.Tech' })
  const [addingBatch, setAddingBatch] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadCampuses = async () => {
    const { data } = await supabase
      .from('master_campuses')
      .select('id, name, code, city, active')
      .order('name')
    setCampuses(data || [])
  }

  const loadBatches = async (campusId: string) => {
    const { data } = await supabase
      .from('master_batches')
      .select('id, campus_id, admission_year, program, active')
      .eq('campus_id', campusId)
      .order('admission_year', { ascending: false })
    setBatches(data || [])
  }

  useEffect(() => {
    if (selectedCampus) {
      loadBatches(selectedCampus)
    } else {
      setBatches([])
    }
  }, [selectedCampus])

  const handleAddCampus = async () => {
    setError('')
    setSuccess('')
    if (!newCampus.name) {
      setError('Name required')
      return
    }
    const { data, error: err } = await supabase
      .from('master_campuses')
      .insert({ name: newCampus.name, code: newCampus.code || newCampus.name, city: newCampus.city || null })
      .select()
      .single()
    if (err) {
      setError(err.message?.includes('duplicate') ? 'Campus already exists' : err.message)
      return
    }
    setNewCampus({ name: '', code: '', city: '' })
    setAddingCampus(false)
    await loadCampuses()
    setSelectedCampus(data.id)
    setSuccess('Campus created')
  }

  const handleUpdateCampus = async (id: string, fields: Partial<Campus>) => {
    setError('')
    const { error: err } = await supabase.from('master_campuses').update(fields).eq('id', id)
    if (err) {
      setError(err.message)
      throw err
    }
    setSuccess('Updated')
    await loadCampuses()
  }

  const handleDeleteCampus = async (id: string) => {
    if (!confirm('Delete this campus and all its batches?')) return
    setError('')
    const { error: err } = await supabase.from('master_campuses').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    if (selectedCampus === id) setSelectedCampus(null)
    await loadCampuses()
  }

  const handleAddBatch = async () => {
    setError('')
    if (!selectedCampus || !newBatch.admission_year) return
    const { error: err } = await supabase
      .from('master_batches')
      .insert({
        campus_id: selectedCampus,
        admission_year: Number(newBatch.admission_year),
        program: newBatch.program || 'B.Tech',
      })
      .select()
      .single()
    if (err) {
      setError(err.message?.includes('duplicate') ? 'Batch already exists for this campus' : err.message)
      return
    }
    setNewBatch({ admission_year: new Date().getFullYear(), program: 'B.Tech' })
    setAddingBatch(false)
    await loadBatches(selectedCampus)
    setSuccess('Batch created')
  }

  const handleDeleteBatch = async (id: string) => {
    if (!confirm('Delete this batch?')) return
    setError('')
    const { error: err } = await supabase.from('master_batches').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    if (selectedCampus) await loadBatches(selectedCampus)
  }

  const selectedCampusName = campuses.find(c => c.id === selectedCampus)?.name

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
          Master Data
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'rgba(13,30,86,0.4)' }}>
          Manage campuses and batches — used across all modules
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">{success}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campuses */}
        <div
          className="rounded-xl shadow-sm overflow-hidden"
          style={{ background: 'var(--color-surface)', border: '1px solid rgba(13,30,86,0.1)' }}
        >
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(13,30,86,0.05)' }}
          >
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
              <Building2 size={15} style={{ color: 'var(--color-ambient)' }} /> Campuses
            </h3>
            <button
              onClick={() => setAddingCampus(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
              style={{ color: 'var(--color-dark-ambient)' }}
            >
              <Plus size={13} /> Add
            </button>
          </div>

          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(13,30,86,0.02)' }}>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase" style={{ color: 'rgba(13,30,86,0.35)' }}>Name</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase" style={{ color: 'rgba(13,30,86,0.35)' }}>Code</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase" style={{ color: 'rgba(13,30,86,0.35)' }}>City</th>
                <th className="px-4 py-2 text-center text-[10px] font-semibold uppercase w-14" style={{ color: 'rgba(13,30,86,0.35)' }}>Active</th>
                <th className="px-4 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
              {campuses.map(c => (
                <CampusRow
                  key={c.id}
                  campus={c}
                  selected={selectedCampus === c.id}
                  onSelect={setSelectedCampus}
                  onUpdate={handleUpdateCampus}
                  onDelete={handleDeleteCampus}
                />
              ))}
              {addingCampus && (
                <tr style={{ background: 'rgba(59,195,226,0.05)' }}>
                  <td className="px-4 py-2">
                    <input
                      value={newCampus.name}
                      onChange={e => setNewCampus({ ...newCampus, name: e.target.value })}
                      placeholder="Campus name"
                      className="w-full px-2 py-1.5 text-sm border rounded"
                      style={{ borderColor: 'rgba(13,30,86,0.15)' }}
                      autoFocus
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={newCampus.code}
                      onChange={e => setNewCampus({ ...newCampus, code: e.target.value })}
                      placeholder="Code"
                      className="w-full px-2 py-1.5 text-sm border rounded"
                      style={{ borderColor: 'rgba(13,30,86,0.15)' }}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={newCampus.city}
                      onChange={e => setNewCampus({ ...newCampus, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-2 py-1.5 text-sm border rounded"
                      style={{ borderColor: 'rgba(13,30,86,0.15)' }}
                    />
                  </td>
                  <td></td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={handleAddCampus}
                        className="p-1 rounded"
                        style={{ color: 'var(--color-dark-ambient)' }}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setAddingCampus(false)}
                        className="p-1 rounded"
                        style={{ color: 'rgba(13,30,86,0.3)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {campuses.length === 0 && !addingCampus && (
            <p className="px-5 py-8 text-sm text-center" style={{ color: 'rgba(13,30,86,0.3)' }}>
              No campuses yet
            </p>
          )}
        </div>

        {/* Batches for selected campus */}
        <div
          className="rounded-xl shadow-sm overflow-hidden"
          style={{ background: 'var(--color-surface)', border: '1px solid rgba(13,30,86,0.1)' }}
        >
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(13,30,86,0.05)' }}
          >
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
              <GraduationCap size={15} style={{ color: 'var(--color-ambient)' }} />
              Batches{' '}
              {selectedCampusName && (
                <span className="font-normal" style={{ color: 'rgba(13,30,86,0.4)' }}>
                  — {selectedCampusName}
                </span>
              )}
            </h3>
            {selectedCampus && (
              <button
                onClick={() => setAddingBatch(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={{ color: 'var(--color-dark-ambient)' }}
              >
                <Plus size={13} /> Add
              </button>
            )}
          </div>

          {!selectedCampus ? (
            <p className="px-5 py-12 text-sm text-center" style={{ color: 'rgba(13,30,86,0.25)' }}>
              Select a campus to see batches
            </p>
          ) : (
            <>
              <div>
                {batches.map(b => (
                  <div
                    key={b.id}
                    className="px-5 py-3 flex items-center justify-between group transition-colors"
                    style={{ borderBottom: '1px solid rgba(13,30,86,0.05)' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(13,30,86,0.02)'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = ''
                    }}
                  >
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                        Batch {b.admission_year}
                      </span>
                      <span className="text-xs ml-2" style={{ color: 'rgba(13,30,86,0.3)' }}>
                        {b.program}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: b.active ? 'var(--color-dark-ambient)' : 'rgba(13,30,86,0.2)' }}
                      />
                      <button
                        onClick={() => handleDeleteBatch(b.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity hover:text-red-500"
                        style={{ color: 'rgba(13,30,86,0.15)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {addingBatch && (
                  <div
                    className="px-5 py-3 flex items-center gap-3"
                    style={{ background: 'rgba(59,195,226,0.05)' }}
                  >
                    <input
                      type="number"
                      value={newBatch.admission_year}
                      onChange={e => setNewBatch({ ...newBatch, admission_year: Number(e.target.value) })}
                      className="w-24 px-2 py-1.5 text-sm border rounded"
                      style={{ borderColor: 'rgba(13,30,86,0.15)' }}
                    />
                    <input
                      value={newBatch.program}
                      onChange={e => setNewBatch({ ...newBatch, program: e.target.value })}
                      className="w-28 px-2 py-1.5 text-sm border rounded"
                      style={{ borderColor: 'rgba(13,30,86,0.15)' }}
                    />
                    <button
                      onClick={handleAddBatch}
                      className="p-1 rounded"
                      style={{ color: 'var(--color-dark-ambient)' }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setAddingBatch(false)}
                      className="p-1 rounded"
                      style={{ color: 'rgba(13,30,86,0.3)' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
              {batches.length === 0 && !addingBatch && (
                <p className="px-5 py-8 text-sm text-center" style={{ color: 'rgba(13,30,86,0.3)' }}>
                  No batches for this campus
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
