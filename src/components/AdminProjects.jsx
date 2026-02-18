import { useState, useEffect } from 'react'
import { FolderGit2, Github, Globe, Trash2, ExternalLink, Search, Users, X } from 'lucide-react'
import { loadProjects, deleteProject, loadProjectMembers } from '../lib/db'

export default function AdminProjects({ adminUser }) {
  const isFaculty = adminUser?.role === 'faculty'
  const facultyCampus = adminUser?.campus
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [collegeFilter, setCollegeFilter] = useState(isFaculty && facultyCampus ? facultyCampus : 'all')
  const [selected, setSelected] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = async () => {
    setLoading(true)
    let data = await loadProjects()
    if (isFaculty && facultyCampus) {
      data = data.filter(p => p.college === facultyCampus)
    }
    setProjects(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const colleges = ['all', ...new Set(projects.map(p => p.college).filter(Boolean))].sort((a, b) => a === 'all' ? -1 : a.localeCompare(b))

  const filtered = projects.filter(p => {
    if (collegeFilter !== 'all' && p.college !== collegeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (p.title || '').toLowerCase().includes(q) ||
        (p.student_name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    }
    return true
  })

  const handleDelete = async (id) => {
    await deleteProject(id)
    setConfirmDelete(null)
    setSelected(null)
    load()
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Student Projects</h2>
        <p className="text-primary/60 mt-1">View and manage projects uploaded by students.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects or students..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-primary/20 rounded-lg text-sm text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
          />
        </div>
        <select
          value={collegeFilter}
          onChange={e => setCollegeFilter(e.target.value)}
          disabled={isFaculty && facultyCampus}
          className={`bg-white border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient ${isFaculty && facultyCampus ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <option value="all">All Campuses</option>
          {colleges.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm text-primary/40">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-primary/10">
          <FolderGit2 size={48} className="mx-auto mb-4 text-primary/15" />
          <p className="text-primary/40 font-medium">No projects found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className="bg-white rounded-xl border border-primary/10 overflow-hidden hover:shadow-md hover:border-ambient/30 transition-all cursor-pointer group"
            >
              {p.thumbnail_url ? (
                <div className="h-36 overflow-hidden bg-gray-100">
                  <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ) : (
                <div className="h-36 bg-gradient-to-br from-primary/5 to-ambient/10 flex items-center justify-center">
                  <FolderGit2 size={40} className="text-primary/15" />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold text-primary leading-tight mb-1 group-hover:text-dark-ambient transition-colors">
                  {p.title}
                </h3>
                <p className="text-primary/40 text-sm line-clamp-2 mb-3">{p.description || 'No description'}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-primary/60 font-medium">{p.student_name}</span>
                    {p.college && <span className="text-xs text-primary/30 ml-2">{p.college}</span>}
                  </div>
                  <div className="flex gap-1.5">
                    {p.github_url && <Github size={13} className="text-primary/25" />}
                    {p.deploy_url && <Globe size={13} className="text-primary/25" />}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <ProjectDetailModal
          project={selected}
          onClose={() => setSelected(null)}
          onDelete={(id) => setConfirmDelete(id)}
          canDelete={!isFaculty}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-primary text-lg mb-2">Delete Project?</h3>
            <p className="text-sm text-primary/50 mb-5">This will permanently remove the project and all team member data.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm text-primary/60 hover:bg-primary/5 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectDetailModal({ project, onClose, onDelete, canDelete }) {
  const [members, setMembers] = useState([])

  useEffect(() => {
    loadProjectMembers(project.id).then(setMembers)
  }, [project.id])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {project.thumbnail_url && (
          <div className="h-52 overflow-hidden rounded-t-2xl">
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
            {project.college && (
              <p className="text-sm text-primary/50">{project.college}{project.batch ? ` · ${project.batch}` : ''}</p>
            )}
          </div>

          {members.length > 0 && (
            <div className="border-t border-primary/10 pt-4 mt-4">
              <p className="text-xs text-primary/40 mb-2 flex items-center gap-1"><Users size={12} /> Team Members</p>
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

          {canDelete && (
            <div className="border-t border-primary/10 pt-4 mt-4">
              <button
                onClick={() => onDelete(project.id)}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={14} /> Delete Project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
