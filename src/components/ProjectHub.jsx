import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderGit2, ExternalLink, Github, Globe, Plus, X, Search, Trash2, Users,
  ChevronDown, ChevronUp, Edit3, Save, UserPlus, ArrowLeft,
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import {
  loadProjects, loadStudentProjects, saveProject, deleteProject,
  loadProjectMembers, addProjectMember, removeProjectMember,
  searchStudents, getStudent,
} from '../lib/db'

// ── Public Gallery (no login) ──────────────────────────────

function ProjectCard({ project, onOpen }) {
  return (
    <div
      onClick={() => onOpen(project)}
      className="bg-white rounded-2xl border border-primary/10 overflow-hidden hover:shadow-lg hover:border-ambient/40 transition-all cursor-pointer group"
    >
      {project.thumbnail_url ? (
        <div className="h-44 overflow-hidden bg-gray-100">
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="h-44 bg-gradient-to-br from-primary/5 to-ambient/10 flex items-center justify-center">
          <FolderGit2 size={48} className="text-primary/20" />
        </div>
      )}
      <div className="p-5">
        <h3 className="font-bold text-primary text-lg leading-tight mb-1 group-hover:text-dark-ambient transition-colors">
          {project.title}
        </h3>
        <p className="text-primary/50 text-sm line-clamp-2 mb-3">{project.description || 'No description'}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-primary/40 bg-primary/5 px-2.5 py-1 rounded-full">
            {project.student_name}
          </span>
          <div className="flex gap-2">
            {project.github_url && <Github size={14} className="text-primary/30" />}
            {project.deploy_url && <Globe size={14} className="text-primary/30" />}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectDetail({ project, onClose }) {
  const [members, setMembers] = useState([])

  useEffect(() => {
    loadProjectMembers(project.id).then(setMembers)
  }, [project.id])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {project.thumbnail_url && (
          <div className="h-56 overflow-hidden rounded-t-2xl">
            <img src={project.thumbnail_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-8">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-primary">{project.title}</h2>
            <button onClick={onClose} className="text-primary/30 hover:text-primary"><X size={20} /></button>
          </div>

          <p className="text-primary/60 mb-6 whitespace-pre-wrap">{project.description || 'No description provided.'}</p>

          <div className="flex flex-wrap gap-3 mb-6">
            {project.deploy_url && (
              <a href={project.deploy_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-ambient/10 text-dark-ambient rounded-xl text-sm font-medium hover:bg-ambient/20 transition-colors">
                <Globe size={14} /> Live Demo
              </a>
            )}
            {project.github_url && (
              <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary rounded-xl text-sm font-medium hover:bg-primary/10 transition-colors">
                <Github size={14} /> Source Code
              </a>
            )}
          </div>

          <div className="border-t border-primary/10 pt-4">
            <p className="text-xs text-primary/40 mb-1">Created by</p>
            <p className="font-semibold text-primary">{project.student_name}</p>
            {project.college && <p className="text-sm text-primary/50">{project.college} {project.batch && `· ${project.batch}`}</p>}
          </div>

          {members.length > 0 && (
            <div className="border-t border-primary/10 pt-4 mt-4">
              <p className="text-xs text-primary/40 mb-2">Team Contributions</p>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 rounded-full bg-ambient/15 flex items-center justify-center text-dark-ambient font-bold text-xs">
                      {(m.student_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-primary">{m.student_name}</span>
                      {m.role && <span className="text-primary/40 ml-2">— {m.role}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PublicGallery() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    loadProjects().then(p => { setProjects(p); setLoading(false) })
  }, [])

  const filtered = projects.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.student_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary sticky top-0 z-40 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <img src="/alta-white-text.png" alt="ALTA" className="h-7" />
            </Link>
            <span className="text-white/30">|</span>
            <span className="text-white font-medium flex items-center gap-2">
              <FolderGit2 size={18} /> ProjectHub
            </span>
          </div>
          <Link
            to="/portal"
            className="text-white/50 hover:text-white text-sm font-medium transition-colors"
          >
            Student Portal →
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">ProjectHub</h1>
          <p className="text-primary/50">Student projects built at ALTA School of Technology</p>
        </div>

        <div className="relative mb-8">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects, students..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-primary/10 bg-white focus:outline-none focus:border-ambient text-primary placeholder:text-primary/30"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-primary/40">
            <FolderGit2 size={48} className="mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">No projects yet</p>
            <p className="text-sm">Students can add projects from the Student Portal.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(p => <ProjectCard key={p.id} project={p} onOpen={setSelected} />)}
          </div>
        )}
      </div>

      {selected && <ProjectDetail project={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ── Student Dashboard (logged in via portal) ──────────────

function MemberSearch({ projectId, existingIds, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [role, setRole] = useState('')
  const [adding, setAdding] = useState(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(() => {
      searchStudents(query).then(r => setResults(r.filter(s => !existingIds.includes(s.lead_id))))
    }, 300)
    return () => clearTimeout(t)
  }, [query, existingIds])

  const handleAdd = async (student) => {
    setAdding(student.lead_id)
    const member = await addProjectMember(projectId, student.lead_id, role)
    if (member) {
      onAdd({ ...member, student_name: student.student_name })
      setQuery('')
      setRole('')
      toast.success(`Added ${student.student_name}`)
    }
    setAdding(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search student by name or lead ID..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-primary/10 text-sm focus:outline-none focus:border-ambient"
          />
        </div>
        <input
          value={role}
          onChange={e => setRole(e.target.value)}
          placeholder="Their role (e.g. Frontend)"
          className="w-48 px-3 py-2 rounded-lg border border-primary/10 text-sm focus:outline-none focus:border-ambient"
        />
      </div>
      {results.length > 0 && (
        <div className="bg-white border border-primary/10 rounded-lg divide-y divide-primary/5 max-h-48 overflow-y-auto">
          {results.map(s => (
            <button
              key={s.lead_id}
              onClick={() => handleAdd(s)}
              disabled={adding === s.lead_id}
              className="w-full px-4 py-2.5 text-left flex items-center justify-between hover:bg-ambient/5 transition-colors disabled:opacity-50"
            >
              <div>
                <span className="text-sm font-medium text-primary">{s.student_name}</span>
                <span className="text-xs text-primary/40 ml-2">{s.college}</span>
              </div>
              <UserPlus size={14} className="text-ambient" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectForm({ project, leadId, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: project?.title || '',
    description: project?.description || '',
    deploy_url: project?.deploy_url || '',
    github_url: project?.github_url || '',
    thumbnail_url: project?.thumbnail_url || '',
  })
  const [members, setMembers] = useState([])
  const [saving, setSaving] = useState(false)
  const [showMembers, setShowMembers] = useState(!!project?.id)

  useEffect(() => {
    if (project?.id) loadProjectMembers(project.id).then(setMembers)
  }, [project?.id])

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error('Project title is required')
    setSaving(true)
    const saved = await saveProject({ ...form, lead_id: leadId, id: project?.id })
    if (saved) {
      toast.success(project?.id ? 'Project updated' : 'Project created')
      onSave(saved)
    }
    setSaving(false)
  }

  const handleRemoveMember = async (member) => {
    if (await removeProjectMember(member.id)) {
      setMembers(prev => prev.filter(m => m.id !== member.id))
      toast.success('Member removed')
    }
  }

  const existingIds = [leadId, ...members.map(m => m.lead_id)]

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-primary mb-1">Project Title *</label>
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="My Awesome Project"
          className="w-full px-4 py-2.5 rounded-xl border border-primary/10 focus:outline-none focus:border-ambient text-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-primary mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="What does this project do? What technologies did you use?"
          rows={4}
          className="w-full px-4 py-2.5 rounded-xl border border-primary/10 focus:outline-none focus:border-ambient text-primary resize-none"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            <Github size={14} className="inline mr-1" /> GitHub Repo URL
          </label>
          <input
            value={form.github_url}
            onChange={e => setForm(f => ({ ...f, github_url: e.target.value }))}
            placeholder="https://github.com/user/repo"
            className="w-full px-4 py-2.5 rounded-xl border border-primary/10 focus:outline-none focus:border-ambient text-primary text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-primary mb-1">
            <Globe size={14} className="inline mr-1" /> Deployed URL
          </label>
          <input
            value={form.deploy_url}
            onChange={e => setForm(f => ({ ...f, deploy_url: e.target.value }))}
            placeholder="https://myproject.vercel.app"
            className="w-full px-4 py-2.5 rounded-xl border border-primary/10 focus:outline-none focus:border-ambient text-primary text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-primary mb-1">Thumbnail URL</label>
        <input
          value={form.thumbnail_url}
          onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
          placeholder="https://example.com/screenshot.png"
          className="w-full px-4 py-2.5 rounded-xl border border-primary/10 focus:outline-none focus:border-ambient text-primary text-sm"
        />
      </div>

      {/* Team Members Section */}
      {project?.id && (
        <div className="border-t border-primary/10 pt-5">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="flex items-center gap-2 text-sm font-semibold text-primary mb-3"
          >
            <Users size={16} /> Team Members
            {showMembers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {members.length > 0 && (
              <span className="bg-ambient/15 text-dark-ambient text-xs px-2 py-0.5 rounded-full">{members.length}</span>
            )}
          </button>

          {showMembers && (
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-primary/3 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-ambient/15 flex items-center justify-center text-dark-ambient font-bold text-xs">
                      {(m.student_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-primary">{m.student_name}</span>
                      {m.role && <span className="text-xs text-primary/40 ml-2">— {m.role}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveMember(m)} className="text-primary/20 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}

              <MemberSearch
                projectId={project.id}
                existingIds={existingIds}
                onAdd={m => setMembers(prev => [...prev, m])}
              />

              <p className="text-xs text-primary/30">
                Team members are only visible when viewing project details. The project card shows only your name.
              </p>
            </div>
          )}
        </div>
      )}

      {!project?.id && (
        <p className="text-xs text-primary/40 bg-primary/3 px-4 py-2 rounded-lg">
          Save the project first, then you can add team members and assign roles.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Save size={14} /> {saving ? 'Saving...' : project?.id ? 'Update Project' : 'Create Project'}
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 border border-primary/10 text-primary/60 rounded-xl text-sm hover:bg-primary/5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function StudentProjectDashboard({ leadId, studentName, onBack }) {
  const [data, setData] = useState({ owned: [], memberOf: [] })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // null | 'new' | project object
  const [confirmDelete, setConfirmDelete] = useState(null)

  const refresh = async () => {
    setLoading(true)
    const result = await loadStudentProjects(leadId)
    setData(result)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [leadId])

  const handleSave = (saved) => {
    if (editing === 'new') {
      setEditing(saved) // switch to edit mode so they can add members
      refresh()
    } else {
      setEditing(null)
      refresh()
    }
  }

  const handleDelete = async (id) => {
    if (await deleteProject(id)) {
      toast.success('Project deleted')
      setConfirmDelete(null)
      refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="text-primary/40 hover:text-primary transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <FolderGit2 size={22} /> My Projects
            </h2>
            <p className="text-sm text-primary/40">Manage your projects and team</p>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing('new')}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      {editing ? (
        <div className="bg-white rounded-2xl border border-primary/10 p-6">
          <h3 className="text-lg font-bold text-primary mb-4">
            {editing === 'new' ? 'Create New Project' : `Edit: ${editing.title}`}
          </h3>
          <ProjectForm
            project={editing === 'new' ? null : editing}
            leadId={leadId}
            onSave={handleSave}
            onCancel={() => setEditing(null)}
          />
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
        </div>
      ) : (
        <>
          {data.owned.length === 0 && data.memberOf.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
              <FolderGit2 size={48} className="mx-auto mb-4 text-primary/15" />
              <p className="text-primary/40 font-medium mb-1">No projects yet</p>
              <p className="text-sm text-primary/30">Click "New Project" to showcase your work.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.owned.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-primary/10 p-5 flex items-start gap-4">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-20 h-14 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                      <FolderGit2 size={20} className="text-primary/20" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-primary">{p.title}</h4>
                    <p className="text-sm text-primary/40 truncate">{p.description || 'No description'}</p>
                    <div className="flex gap-3 mt-2">
                      {p.github_url && (
                        <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary/40 hover:text-dark-ambient flex items-center gap-1">
                          <Github size={12} /> Repo
                        </a>
                      )}
                      {p.deploy_url && (
                        <a href={p.deploy_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary/40 hover:text-dark-ambient flex items-center gap-1">
                          <Globe size={12} /> Live
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setEditing(p)} className="p-2 rounded-lg hover:bg-primary/5 text-primary/30 hover:text-primary transition-colors">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => setConfirmDelete(p.id)} className="p-2 rounded-lg hover:bg-red-50 text-primary/30 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {data.memberOf.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-primary/40 pt-4">Contributed to</h3>
                  {data.memberOf.map(p => (
                    <div key={p.id} className="bg-white rounded-xl border border-dashed border-primary/10 p-5 flex items-start gap-4">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt="" className="w-20 h-14 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-20 h-14 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                          <FolderGit2 size={20} className="text-primary/20" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-primary">{p.title}</h4>
                        <p className="text-sm text-primary/40">{p.my_role ? `Role: ${p.my_role}` : 'Team member'}</p>
                        <p className="text-xs text-primary/30 mt-1">by {p.student_name}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-primary text-lg mb-2">Delete Project?</h3>
            <p className="text-sm text-primary/50 mb-5">This will permanently remove the project and all team member data.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-primary/60 hover:bg-primary/5 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Toaster position="bottom-right" />
    </div>
  )
}

// ── Standalone page with login ────────────────────────────

export default function ProjectHub() {
  return <PublicGallery />
}

export { StudentProjectDashboard }
