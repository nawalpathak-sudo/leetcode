import { useState, useEffect } from 'react'
import { UserPlus, Shield, GraduationCap, ToggleLeft, ToggleRight } from 'lucide-react'
import { loadAllAdminUsers, createAdminUser, updateAdminUser, loadAllStudents } from '../lib/db'

export default function UserManagement({ adminUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [campuses, setCampuses] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', role: 'faculty', campus: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isMaster = adminUser.id === 'master'
  const isAdmin = adminUser.role === 'admin'
  const canCreateAdmin = isMaster
  const canCreateFaculty = isMaster || isAdmin

  const reload = async () => {
    setLoading(true)
    const [adminData, studentsData] = await Promise.all([
      loadAllAdminUsers(),
      loadAllStudents(),
    ])
    setUsers(adminData)
    setCampuses([...new Set(studentsData.map(s => s.college).filter(Boolean))].sort())
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
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
    const result = await createAdminUser({
      name: form.name.trim(),
      phone: formatted,
      role: form.role,
      campus: form.role === 'faculty' ? form.campus : null,
    })

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`${form.role === 'admin' ? 'Admin' : 'Faculty'} user "${form.name.trim()}" created successfully.`)
      setForm({ name: '', phone: '', role: 'faculty', campus: '' })
      setShowForm(false)
      await reload()
    }
    setSaving(false)
  }

  const handleToggleActive = async (user) => {
    const result = await updateAdminUser(user.id, { active: !user.active })
    if (result.error) {
      setError(result.error)
    } else {
      await reload()
    }
  }

  const admins = users.filter(u => u.role === 'admin')
  const faculty = users.filter(u => u.role === 'faculty')

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Manage Users</h2>
          <p className="text-primary/60 mt-1">
            {isMaster ? 'Create and manage admin & faculty users.' : 'Create and manage faculty users.'}
          </p>
        </div>
        {canCreateFaculty && (
          <button
            onClick={() => { setShowForm(!showForm); setError(''); setSuccess('') }}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <UserPlus size={18} /> Add User
          </button>
        )}
      </div>

      {success && (
        <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">{success}</div>
      )}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 border border-primary/10 shadow-sm">
          <h3 className="font-semibold text-lg text-primary mb-4">New User</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary/70 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter full name"
                  className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/70 mb-1">Phone Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-primary/5 border border-r-0 border-primary/20 rounded-l-lg text-primary/50 text-sm">+91</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="10-digit number"
                    maxLength={10}
                    className="flex-1 border border-primary/20 rounded-r-lg px-3 py-2.5 text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary/70 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-primary focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
                >
                  <option value="faculty">Faculty</option>
                  {canCreateAdmin && <option value="admin">Admin</option>}
                </select>
              </div>
              {form.role === 'faculty' && (
                <div>
                  <label className="block text-sm font-medium text-primary/70 mb-1">Campus</label>
                  <select
                    value={form.campus}
                    onChange={e => setForm({ ...form, campus: e.target.value })}
                    className="w-full border border-primary/20 rounded-lg px-3 py-2.5 text-primary focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
                  >
                    <option value="">Select campus...</option>
                    {campuses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-lg font-medium transition-colors"
              >
                {saving ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary/60 rounded-lg font-medium transition-colors border border-primary/10"
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
          icon={<Shield size={18} className="text-dark-ambient" />}
          users={admins}
          onToggle={isMaster ? handleToggleActive : null}
        />
      )}

      {/* Faculty Users */}
      {faculty.length > 0 && (
        <UserTable
          title="Faculty"
          icon={<GraduationCap size={18} className="text-dark-ambient" />}
          users={faculty}
          onToggle={canCreateFaculty ? handleToggleActive : null}
        />
      )}

      {users.length === 0 && !showForm && (
        <div className="bg-ambient/10 border border-ambient/30 text-primary px-6 py-8 rounded-xl text-center">
          <p className="font-medium">No users created yet.</p>
          <p className="text-primary/50 text-sm mt-1">Click "Add User" to create your first admin or faculty user.</p>
        </div>
      )}
    </div>
  )
}

function UserTable({ title, icon, users, onToggle }) {
  return (
    <div className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-primary/[0.03] border-b border-primary/10 flex items-center gap-2">
        {icon}
        <span className="font-semibold text-primary">{title}</span>
        <span className="text-primary/30 text-sm ml-1">({users.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-primary/5">
            <tr className="text-primary/50">
              <th className="py-2.5 px-4 text-left font-medium">Name</th>
              <th className="py-2.5 px-4 text-left font-medium">Phone</th>
              {title === 'Faculty' && <th className="py-2.5 px-4 text-left font-medium">Campus</th>}
              <th className="py-2.5 px-4 text-left font-medium">Status</th>
              <th className="py-2.5 px-4 text-left font-medium">Created</th>
              {onToggle && <th className="py-2.5 px-4 text-right font-medium">Action</th>}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={`border-t border-primary/5 ${!u.active ? 'opacity-50' : ''}`}>
                <td className="py-2.5 px-4 font-medium text-primary">{u.name}</td>
                <td className="py-2.5 px-4 text-primary/60">+{u.phone}</td>
                {title === 'Faculty' && <td className="py-2.5 px-4 text-primary/60">{u.campus || '—'}</td>}
                <td className="py-2.5 px-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    u.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-primary/40 text-xs">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}
                </td>
                {onToggle && (
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => onToggle(u)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        u.active
                          ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                          : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                      }`}
                    >
                      {u.active ? <><ToggleRight size={14} /> Deactivate</> : <><ToggleLeft size={14} /> Activate</>}
                    </button>
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
