'use client'

import { useState } from 'react'
import { UserPlus, Shield, GraduationCap, ToggleLeft, ToggleRight, Pencil, X, Save } from 'lucide-react'

type AdminUser = {
  id: string
  name: string
  phone: string
  role: string
  campus: string | null
  active: boolean
  created_at: string
}

type Props = {
  initialUsers: AdminUser[]
  campuses: string[]
  adminUser: { id: string; role: string }
}

function UserTable({
  title,
  icon,
  users,
  onToggle,
  onEdit,
}: {
  title: string
  icon: React.ReactNode
  users: AdminUser[]
  onToggle: ((user: AdminUser) => void) | null
  onEdit: ((user: AdminUser) => void) | null
}) {
  return (
    <div
      className="rounded-xl shadow-sm overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1px solid rgba(13,30,86,0.1)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ background: 'rgba(13,30,86,0.03)', borderBottom: '1px solid rgba(13,30,86,0.1)' }}
      >
        {icon}
        <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>
          {title}
        </span>
        <span className="text-sm ml-1" style={{ color: 'rgba(13,30,86,0.3)' }}>
          ({users.length})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: 'rgba(13,30,86,0.05)' }}>
            <tr style={{ color: 'rgba(13,30,86,0.5)' }}>
              <th className="py-2.5 px-4 text-left font-medium">Name</th>
              <th className="py-2.5 px-4 text-left font-medium">Phone</th>
              {title === 'Faculty' && <th className="py-2.5 px-4 text-left font-medium">Campus(es)</th>}
              <th className="py-2.5 px-4 text-left font-medium">Status</th>
              <th className="py-2.5 px-4 text-left font-medium">Created</th>
              {(onToggle || onEdit) && <th className="py-2.5 px-4 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr
                key={u.id}
                style={{
                  borderTop: '1px solid rgba(13,30,86,0.05)',
                  opacity: u.active ? 1 : 0.5,
                }}
              >
                <td className="py-2.5 px-4 font-medium" style={{ color: 'var(--color-primary)' }}>
                  {u.name}
                </td>
                <td className="py-2.5 px-4" style={{ color: 'rgba(13,30,86,0.6)' }}>
                  +{u.phone}
                </td>
                {title === 'Faculty' && (
                  <td className="py-2.5 px-4">
                    {u.campus ? (
                      <div className="flex flex-wrap gap-1">
                        {u.campus.split(',').map(c => (
                          <span
                            key={c}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{ background: 'rgba(59,195,226,0.1)', color: 'var(--color-dark-ambient)', border: '1px solid rgba(59,195,226,0.3)' }}
                          >
                            {c.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'rgba(13,30,86,0.3)' }}>&mdash;</span>
                    )}
                  </td>
                )}
                <td className="py-2.5 px-4">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
                    style={
                      u.active
                        ? { background: 'rgb(240,253,244)', color: 'rgb(21,128,61)', borderColor: 'rgb(187,247,208)' }
                        : { background: 'rgb(254,242,242)', color: 'rgb(220,38,38)', borderColor: 'rgb(254,202,202)' }
                    }
                  >
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-xs" style={{ color: 'rgba(13,30,86,0.4)' }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}
                </td>
                {(onToggle || onEdit) && (
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(u)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors border"
                          style={{ background: 'rgba(59,195,226,0.1)', color: 'var(--color-dark-ambient)', borderColor: 'rgba(59,195,226,0.3)' }}
                        >
                          <Pencil size={12} /> Edit
                        </button>
                      )}
                      {onToggle && (
                        <button
                          onClick={() => onToggle(u)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors border"
                          style={
                            u.active
                              ? { background: 'rgb(254,242,242)', color: 'rgb(220,38,38)', borderColor: 'rgb(254,202,202)' }
                              : { background: 'rgb(240,253,244)', color: 'rgb(21,128,61)', borderColor: 'rgb(187,247,208)' }
                          }
                        >
                          {u.active ? (
                            <><ToggleRight size={14} /> Deactivate</>
                          ) : (
                            <><ToggleLeft size={14} /> Activate</>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EditModal({
  user,
  campuses,
  onClose,
  onSave,
}: {
  user: AdminUser
  campuses: string[]
  onClose: () => void
  onSave: (updated: AdminUser) => void
}) {
  const [name, setName] = useState(user.name)
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>(
    user.campus ? user.campus.split(',').map(c => c.trim()).filter(Boolean) : []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleCampus = (campus: string) => {
    setSelectedCampuses(prev =>
      prev.includes(campus) ? prev.filter(c => c !== campus) : [...prev, campus]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (user.role === 'faculty' && selectedCampuses.length === 0) {
      setError('Select at least one campus.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/manage-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          id: user.id,
          name: name.trim(),
          campus: user.role === 'faculty' ? selectedCampuses.join(',') : user.campus,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update')
        setSaving(false)
        return
      }
      onSave({
        ...user,
        name: name.trim(),
        campus: user.role === 'faculty' ? selectedCampuses.join(',') : user.campus,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to update')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl shadow-xl p-6 space-y-5 mx-4"
        style={{ background: 'var(--color-surface)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
            Edit {user.role === 'admin' ? 'Admin' : 'Faculty'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} style={{ color: 'rgba(13,30,86,0.4)' }} />
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(13,30,86,0.7)' }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 border focus:outline-none focus:ring-1"
            style={{ color: 'var(--color-primary)', borderColor: 'rgba(13,30,86,0.2)' }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(13,30,86,0.7)' }}>
            Phone
          </label>
          <input
            type="text"
            value={`+${user.phone}`}
            disabled
            className="w-full rounded-lg px-3 py-2.5 border bg-gray-50 cursor-not-allowed"
            style={{ color: 'rgba(13,30,86,0.4)', borderColor: 'rgba(13,30,86,0.1)' }}
          />
        </div>

        {user.role === 'faculty' && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'rgba(13,30,86,0.7)' }}>
              Assigned Campuses
            </label>
            <div className="flex flex-wrap gap-2">
              {campuses.map(c => {
                const selected = selectedCampuses.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCampus(c)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
                    style={
                      selected
                        ? { background: 'var(--color-dark-ambient)', color: '#fff', borderColor: 'var(--color-dark-ambient)' }
                        : { background: 'rgba(13,30,86,0.03)', color: 'rgba(13,30,86,0.6)', borderColor: 'rgba(13,30,86,0.15)' }
                    }
                  >
                    {c}
                  </button>
                )
              })}
            </div>
            {selectedCampuses.length > 0 && (
              <p className="text-xs mt-2" style={{ color: 'rgba(13,30,86,0.4)' }}>
                {selectedCampuses.length} campus{selectedCampuses.length > 1 ? 'es' : ''} selected
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-5 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'var(--color-primary)' }}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg font-medium transition-colors border"
            style={{ background: 'rgba(13,30,86,0.05)', color: 'rgba(13,30,86,0.6)', borderColor: 'rgba(13,30,86,0.1)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsersClient({ initialUsers, campuses, adminUser }: Props) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', role: 'faculty', campus: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isMaster = adminUser.id === 'master' || adminUser.role === 'master'
  const isAdmin = adminUser.role === 'admin'
  const canCreateAdmin = isMaster
  const canCreateFaculty = isMaster || isAdmin

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required.')
      return
    }
    if (form.role === 'faculty' && !form.campus) {
      setError('Campus is required for faculty.')
      return
    }
    if (form.role === 'admin' && !canCreateAdmin) {
      setError('You do not have permission to create admin users.')
      return
    }

    const digits = form.phone.replace(/\D/g, '')
    let formatted = digits
    if (digits.length === 10) formatted = '91' + digits
    if (formatted.length !== 12 || !formatted.startsWith('91')) {
      setError('Enter a valid 10-digit mobile number.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/manage-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: form.name.trim(),
          phone: formatted,
          role: form.role,
          campus: form.role === 'faculty' ? form.campus : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create user')
      } else {
        setSuccess(`${form.role === 'admin' ? 'Admin' : 'Faculty'} user "${form.name.trim()}" created successfully.`)
        setForm({ name: '', phone: '', role: 'faculty', campus: '' })
        setShowForm(false)
        if (data.user) {
          setUsers(prev => [data.user, ...prev])
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    }
    setSaving(false)
  }

  const handleToggleActive = async (user: AdminUser) => {
    setError('')
    try {
      const res = await fetch('/api/manage-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id: user.id, active: !user.active }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update user')
      } else {
        setUsers(prev =>
          prev.map(u => (u.id === user.id ? { ...u, active: !u.active } : u))
        )
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
    }
  }

  const handleEditSave = (updated: AdminUser) => {
    setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))
    setEditingUser(null)
    setSuccess(`User "${updated.name}" updated successfully.`)
  }

  const admins = users.filter(u => u.role === 'admin')
  const faculty = users.filter(u => u.role === 'faculty')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
            Manage Users
          </h2>
          <p className="mt-1" style={{ color: 'rgba(13,30,86,0.6)' }}>
            {isMaster ? 'Create and manage admin & faculty users.' : 'Create and manage faculty users.'}
          </p>
        </div>
        {canCreateFaculty && (
          <button
            onClick={() => {
              setShowForm(!showForm)
              setError('')
              setSuccess('')
            }}
            className="px-5 py-2.5 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            style={{ background: 'var(--color-primary)' }}
          >
            <UserPlus size={18} /> Add User
          </button>
        )}
      </div>

      {success && (
        <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <div
          className="rounded-xl p-6 shadow-sm"
          style={{ background: 'var(--color-surface)', border: '1px solid rgba(13,30,86,0.1)' }}
        >
          <h3 className="font-semibold text-lg mb-4" style={{ color: 'var(--color-primary)' }}>
            New User
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(13,30,86,0.7)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full rounded-lg px-3 py-2.5 border focus:outline-none focus:ring-1"
                  style={{ color: 'var(--color-primary)', borderColor: 'rgba(13,30,86,0.2)' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(13,30,86,0.7)' }}>
                  Phone Number
                </label>
                <div className="flex">
                  <span
                    className="inline-flex items-center px-3 border border-r-0 rounded-l-lg text-sm"
                    style={{ background: 'rgba(13,30,86,0.05)', borderColor: 'rgba(13,30,86,0.2)', color: 'rgba(13,30,86,0.5)' }}
                  >
                    +91
                  </span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="10-digit number"
                    maxLength={10}
                    className="flex-1 border rounded-r-lg px-3 py-2.5 focus:outline-none focus:ring-1"
                    style={{ color: 'var(--color-primary)', borderColor: 'rgba(13,30,86,0.2)' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(13,30,86,0.7)' }}>
                  Role
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1"
                  style={{ color: 'var(--color-primary)', borderColor: 'rgba(13,30,86,0.2)' }}
                >
                  <option value="faculty">Faculty</option>
                  {canCreateAdmin && <option value="admin">Admin</option>}
                </select>
              </div>
              {form.role === 'faculty' && (
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'rgba(13,30,86,0.7)' }}>
                    Campus
                  </label>
                  <select
                    value={form.campus}
                    onChange={e => setForm({ ...form, campus: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1"
                    style={{ color: 'var(--color-primary)', borderColor: 'rgba(13,30,86,0.2)' }}
                  >
                    <option value="">Select campus...</option>
                    {campuses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
                style={{ background: 'var(--color-primary)' }}
              >
                {saving ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 rounded-lg font-medium transition-colors border"
                style={{ background: 'rgba(13,30,86,0.05)', color: 'rgba(13,30,86,0.6)', borderColor: 'rgba(13,30,86,0.1)' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Users */}
      {(isMaster || isAdmin) && admins.length > 0 && (
        <UserTable
          title="Admins"
          icon={<Shield size={18} style={{ color: 'var(--color-dark-ambient)' }} />}
          users={admins}
          onToggle={isMaster ? handleToggleActive : null}
          onEdit={isMaster ? setEditingUser : null}
        />
      )}

      {/* Faculty Users */}
      {faculty.length > 0 && (
        <UserTable
          title="Faculty"
          icon={<GraduationCap size={18} style={{ color: 'var(--color-dark-ambient)' }} />}
          users={faculty}
          onToggle={canCreateFaculty ? handleToggleActive : null}
          onEdit={canCreateFaculty ? setEditingUser : null}
        />
      )}

      {users.length === 0 && !showForm && (
        <div
          className="px-6 py-8 rounded-xl text-center border"
          style={{ background: 'rgba(59,195,226,0.1)', borderColor: 'rgba(59,195,226,0.3)', color: 'var(--color-primary)' }}
        >
          <p className="font-medium">No users created yet.</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(13,30,86,0.5)' }}>
            Click &quot;Add User&quot; to create your first admin or faculty user.
          </p>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <EditModal
          user={editingUser}
          campuses={campuses}
          onClose={() => setEditingUser(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  )
}
