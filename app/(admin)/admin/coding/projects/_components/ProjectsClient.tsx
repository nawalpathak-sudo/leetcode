'use client'

import { useState, useEffect, useCallback } from 'react'
import { FolderGit2, Github, Globe, Trash2, Search, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ProjectsClient({ initialProjects, totalCount }: { initialProjects: any[]; totalCount: number }) {
  const [projects, setProjects] = useState(initialProjects)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [collegeFilter, setCollegeFilter] = useState('all')
  const [selected, setSelected] = useState<any>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    let query = supabase
      .from('projects')
      .select('*, students(student_name, student_username, college, batch)')
      .order('created_at', { ascending: false })

    if (collegeFilter !== 'all') {
      // Filter via student's college - need to fetch all then filter client-side
      // since cross-table filtering on joined data needs inner join
    }

    const { data } = await query.range(0, 99)
    let result = (data || []).map((p: any) => ({
      ...p,
      student_name: p.students?.student_name || '',
      student_username: p.students?.student_username || '',
      college: p.students?.college || '',
      batch: p.students?.batch || '',
    }))

    if (collegeFilter !== 'all') {
      result = result.filter((p: any) => p.college === collegeFilter)
    }

    setProjects(result)
    setLoading(false)
  }, [collegeFilter])

  useEffect(() => { load() }, [load])

  const colleges = ['all', ...new Set(projects.map((p: any) => p.college).filter(Boolean))].sort((a, b) => a === 'all' ? -1 : a.localeCompare(b))

  const filtered = projects.filter((p: any) => {
    if (search) {
      const q = search.toLowerCase()
      return (p.title || '').toLowerCase().includes(q) ||
        (p.student_name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    }
    return true
  })

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('projects').delete().eq('id', id)
    setConfirmDelete(null)
    setSelected(null)
    load()
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-ambient)', borderRightColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>Student Projects</h2>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>View and manage projects uploaded by students.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search projects or students..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }} />
        </div>
        <select value={collegeFilter} onChange={e => setCollegeFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
          <option value="all">All Campuses</option>
          {colleges.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <FolderGit2 size={48} className="mx-auto mb-4" style={{ color: 'rgba(13,30,86,0.1)' }} />
          <p className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>No projects found</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p: any) => (
            <div key={p.id} onClick={() => setSelected(p)}
              className="rounded-xl border overflow-hidden hover:shadow-md transition-all cursor-pointer group"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              {p.thumbnail_url ? (
                <div className="h-36 overflow-hidden bg-gray-100">
                  <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ) : (
                <div className="h-36 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(13,30,86,0.03), rgba(59,195,226,0.08))' }}>
                  <FolderGit2 size={40} style={{ color: 'rgba(13,30,86,0.1)' }} />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-bold leading-tight mb-1 group-hover:text-[var(--color-dark-ambient)] transition-colors" style={{ color: 'var(--color-primary)' }}>
                  {p.title}
                </h3>
                <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--color-text-secondary)' }}>{p.description || 'No description'}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{p.student_name}</span>
                    {p.college && <span className="text-xs ml-2" style={{ color: 'var(--color-text-secondary)' }}>{p.college}</span>}
                  </div>
                  <div className="flex gap-1.5">
                    {p.github_url && <Github size={13} style={{ color: 'rgba(13,30,86,0.2)' }} />}
                    {p.deploy_url && <Globe size={13} style={{ color: 'rgba(13,30,86,0.2)' }} />}
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
          onDelete={(id: string) => setConfirmDelete(id)}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="rounded-2xl p-6 max-w-sm w-full shadow-2xl" style={{ background: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--color-primary)' }}>Delete Project?</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>This will permanently remove the project and all team member data.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm rounded-lg transition-colors" style={{ color: 'var(--color-text-secondary)' }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectDetailModal({ project, onClose, onDelete }: { project: any; onClose: () => void; onDelete: (id: string) => void }) {
  const [members, setMembers] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('project_members')
        .select('*, students(student_name, student_username, college, batch)')
        .eq('project_id', project.id)
        .order('created_at')
      setMembers((data || []).map((m: any) => ({ ...m, student_name: m.students?.student_name || '' })))
    })()
  }, [project.id])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" style={{ background: 'var(--color-surface)' }} onClick={e => e.stopPropagation()}>
        {project.thumbnail_url && (
          <div className="h-52 overflow-hidden rounded-t-2xl">
            <img src={project.thumbnail_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-8">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{project.title}</h2>
            <button onClick={onClose} style={{ color: 'var(--color-text-secondary)' }}><X size={20} /></button>
          </div>

          <p className="mb-6 whitespace-pre-wrap" style={{ color: 'var(--color-text-secondary)' }}>{project.description || 'No description provided.'}</p>

          <div className="flex flex-wrap gap-3 mb-6">
            {project.deploy_url && (
              <a href={project.deploy_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'rgba(59,195,226,0.1)', color: 'var(--color-dark-ambient)' }}>
                <Globe size={14} /> Live Demo
              </a>
            )}
            {project.github_url && (
              <a href={project.github_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'rgba(13,30,86,0.03)', color: 'var(--color-primary)' }}>
                <Github size={14} /> Source Code
              </a>
            )}
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Created by</p>
            <p className="font-semibold" style={{ color: 'var(--color-primary)' }}>{project.student_name}</p>
            {project.college && (
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{project.college}{project.batch ? ` \u00B7 ${project.batch}` : ''}</p>
            )}
          </div>

          {members.length > 0 && (
            <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs mb-2 flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}><Users size={12} /> Team Members</p>
              <div className="space-y-2">
                {members.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 text-sm">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(59,195,226,0.15)', color: 'var(--color-dark-ambient)' }}>
                      {(m.student_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium" style={{ color: 'var(--color-primary)' }}>{m.student_name}</span>
                      {m.role && <span className="ml-2" style={{ color: 'var(--color-text-secondary)' }}>-- {m.role}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--color-border)' }}>
            <button onClick={() => onDelete(project.id)}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
              <Trash2 size={14} /> Delete Project
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
