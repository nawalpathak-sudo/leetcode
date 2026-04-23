'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit3, ChevronDown, ChevronRight, Clock, X, Check, ArrowLeft, Link2, Upload, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  BOS,
  BOSSubject,
  BOSAssignment,
  BOSCategory,
  updateBOS,
  fetchBOSSubjects,
  fetchBOSAssignments,
  fetchCategories,
  createBOSSubject,
  updateBOSSubject,
  deleteBOSSubject,
  createBOSAssignment,
  updateBOSAssignment,
  deleteBOSAssignment,
  fetchCampuses,
  fetchBatches,
  computeCredits,
  semesterSummary,
} from '../_lib/queries'
import toast from 'react-hot-toast'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  approved: 'bg-[var(--color-ambient)]/10 text-[var(--color-dark-ambient)]',
  archived: 'bg-[var(--color-primary)]/5 text-[var(--color-primary)]/40',
}

// ==================== ASSIGN MODAL ====================

function AssignModal({ bosId, existingAssignments, onSave, onCancel }: {
  bosId: string
  existingAssignments: BOSAssignment[]
  onSave: (form: { bos_id: string; campus_name: string; admission_year: number; current_semester: number }) => Promise<void>
  onCancel: () => void
}) {
  const supabase = createClient()
  const [campuses, setCampuses] = useState<{ id: string; name: string }[]>([])
  const [batches, setBatches] = useState<{ id: string; admission_year: number }[]>([])
  const [form, setForm] = useState({ campus_name: '', admission_year: '', current_semester: 1 })

  useEffect(() => { fetchCampuses(supabase).then(setCampuses) }, [])

  useEffect(() => {
    if (!form.campus_name) { setBatches([]); return }
    const campus = campuses.find(c => c.name === form.campus_name)
    if (campus) fetchBatches(supabase, campus.id).then(b => {
      const assigned = new Set(existingAssignments.filter(a => a.campus_name === form.campus_name).map(a => a.admission_year))
      setBatches(b.filter(x => !assigned.has(x.admission_year)))
    })
  }, [form.campus_name, campuses, existingAssignments])

  useEffect(() => {
    if (!form.admission_year) return
    const now = new Date()
    const year = parseInt(form.admission_year)
    const yearsIn = now.getFullYear() - year
    const isSecondHalf = now.getMonth() >= 6
    const sem = Math.max(1, Math.min(8, yearsIn * 2 + (isSecondHalf ? 1 : 2)))
    setForm(f => ({ ...f, current_semester: sem }))
  }, [form.admission_year])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.campus_name || !form.admission_year) return toast.error('Select campus and batch')
    try { await onSave({ bos_id: bosId, campus_name: form.campus_name, admission_year: parseInt(form.admission_year), current_semester: form.current_semester }) } catch (err: any) { toast.error(err.message) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-[var(--color-primary)]">Assign to Batch</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Campus</label>
            <select value={form.campus_name} onChange={e => setForm({ ...form, campus_name: e.target.value, admission_year: '' })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none bg-[var(--color-surface)]">
              <option value="">Select</option>
              {campuses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Batch</label>
            <select value={form.admission_year} onChange={e => setForm({ ...form, admission_year: e.target.value })}
              disabled={!form.campus_name} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none bg-[var(--color-surface)] disabled:opacity-40">
              <option value="">Select</option>
              {batches.map(b => <option key={b.id} value={b.admission_year}>{b.admission_year}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Current Semester</label>
          <select value={form.current_semester} onChange={e => setForm({ ...form, current_semester: parseInt(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none bg-[var(--color-surface)]">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
          <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">Auto-calculated from admission year. Override if needed.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Cancel</button>
          <button type="submit" disabled={!form.campus_name || !form.admission_year}
            className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40">Assign</button>
        </div>
      </form>
    </div>
  )
}

// ==================== SUBJECT ROW ====================

function SubjectRow({ subject, categories, onUpdate, onDelete }: {
  subject: BOSSubject
  categories: BOSCategory[]
  onUpdate: (id: string, fields: Record<string, unknown>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState(subject)
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    try {
      await onUpdate(subject.id, {
        subject_code: f.subject_code, subject_name: f.subject_name, category_id: f.category_id || null,
        lecture_hours: parseInt(String(f.lecture_hours)) || 0, tutorial_hours: parseInt(String(f.tutorial_hours)) || 0,
        practical_hours: parseInt(String(f.practical_hours)) || 0, is_elective: f.is_elective, is_audit: f.is_audit,
      })
      setEditing(false)
    } catch (err: any) { toast.error(err.message) }
  }

  const c = computeCredits(
    editing ? parseInt(String(f.lecture_hours)) || 0 : subject.lecture_hours,
    editing ? parseInt(String(f.tutorial_hours)) || 0 : subject.tutorial_hours,
    editing ? parseInt(String(f.practical_hours)) || 0 : subject.practical_hours
  )

  if (editing) {
    return (
      <tr className="bg-[var(--color-active-bg)]">
        <td className="px-3 py-2"><input value={f.subject_code} onChange={e => set('subject_code', e.target.value)} className="w-full px-2 py-1 text-xs border border-[var(--color-border)] rounded" /></td>
        <td className="px-3 py-2"><input value={f.subject_name} onChange={e => set('subject_name', e.target.value)} className="w-full px-2 py-1 text-xs border border-[var(--color-border)] rounded" /></td>
        <td className="px-3 py-2">
          <select value={f.category_id || ''} onChange={e => set('category_id', e.target.value)} className="w-full px-1 py-1 text-xs border border-[var(--color-border)] rounded">
            <option value="">—</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </td>
        <td className="px-3 py-2"><input type="number" min="0" value={f.lecture_hours} onChange={e => set('lecture_hours', e.target.value)} className="w-12 px-1 py-1 text-xs border border-[var(--color-border)] rounded text-center" /></td>
        <td className="px-3 py-2"><input type="number" min="0" value={f.tutorial_hours} onChange={e => set('tutorial_hours', e.target.value)} className="w-12 px-1 py-1 text-xs border border-[var(--color-border)] rounded text-center" /></td>
        <td className="px-3 py-2"><input type="number" min="0" value={f.practical_hours} onChange={e => set('practical_hours', e.target.value)} className="w-12 px-1 py-1 text-xs border border-[var(--color-border)] rounded text-center" /></td>
        <td className="px-3 py-2 text-center text-xs font-semibold text-[var(--color-text-primary)]">{c.total}</td>
        <td className="px-3 py-2 text-center text-xs text-[var(--color-text-secondary)]">{c.hours}h</td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button onClick={save} className="p-1 text-[var(--color-dark-ambient)] hover:bg-[var(--color-active-bg)] rounded"><Check size={14} /></button>
            <button onClick={() => setEditing(false)} className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded"><X size={14} /></button>
          </div>
        </td>
      </tr>
    )
  }

  const cat = subject.bos_subject_categories
  const topics = subject.topics || []
  return (
    <tr className="hover:bg-[var(--color-hover)] group">
      <td className="px-3 py-2.5 text-xs font-mono text-[var(--color-text-secondary)]">{subject.subject_code}</td>
      <td className="px-3 py-2.5">
        <div className="text-sm text-[var(--color-text-primary)] font-medium">
          {subject.subject_name}
          {subject.is_elective && <span className="ml-1.5 text-[10px] bg-[var(--color-active-bg)] text-[var(--color-dark-ambient)] px-1.5 py-0.5 rounded">Elective</span>}
          {subject.is_audit && <span className="ml-1.5 text-[10px] bg-[var(--color-hover)] text-[var(--color-text-secondary)] px-1.5 py-0.5 rounded">Audit</span>}
        </div>
        {topics.length > 0 && (
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{topics.join(' · ')}</p>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--color-text-secondary)]">{cat?.code || '—'}</td>
      <td className="px-3 py-2.5 text-xs text-center text-[var(--color-text-secondary)]">{subject.lecture_hours}</td>
      <td className="px-3 py-2.5 text-xs text-center text-[var(--color-text-secondary)]">{subject.tutorial_hours}</td>
      <td className="px-3 py-2.5 text-xs text-center text-[var(--color-text-secondary)]">{subject.practical_hours}</td>
      <td className="px-3 py-2.5 text-xs text-center font-semibold text-[var(--color-text-primary)]">{c.total}</td>
      <td className="px-3 py-2.5 text-xs text-center text-[var(--color-text-secondary)]">{c.hours}h</td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => { setF(subject); setEditing(true) }} className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded"><Edit3 size={13} /></button>
          <button onClick={() => onDelete(subject.id)} className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] rounded"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

// ==================== SEMESTER BLOCK ====================

function SemesterBlock({ sem, subjects, categories, bosId, onRefresh, highlightSemesters }: {
  sem: number
  subjects: BOSSubject[]
  categories: BOSCategory[]
  bosId: string
  onRefresh: () => void
  highlightSemesters: Set<number>
}) {
  const supabase = createClient()
  const isActive = highlightSemesters.has(sem)
  const [open, setOpen] = useState(isActive || sem <= 2)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ subject_code: '', subject_name: '', category_id: '', lecture_hours: 3, tutorial_hours: 1, practical_hours: 0 })
  const set = (k: string, v: any) => setF(prev => ({ ...prev, [k]: v }))

  const s = semesterSummary(subjects, sem)
  const semSubs = subjects.filter(x => x.semester === sem)
  const preview = computeCredits(parseInt(String(f.lecture_hours)) || 0, parseInt(String(f.tutorial_hours)) || 0, parseInt(String(f.practical_hours)) || 0)

  const add = async () => {
    if (!f.subject_code || !f.subject_name) return toast.error('Code and name required')
    try {
      await createBOSSubject(supabase, {
        bos_id: bosId, semester: sem, subject_code: f.subject_code, subject_name: f.subject_name,
        category_id: f.category_id || null, lecture_hours: parseInt(String(f.lecture_hours)) || 0,
        tutorial_hours: parseInt(String(f.tutorial_hours)) || 0, practical_hours: parseInt(String(f.practical_hours)) || 0,
      })
      setF({ subject_code: '', subject_name: '', category_id: '', lecture_hours: 3, tutorial_hours: 1, practical_hours: 0 })
      setAdding(false)
      onRefresh()
    } catch (err: any) { toast.error(err.message?.includes('duplicate') ? 'Subject code already exists in this semester' : err.message) }
  }

  return (
    <div className={`bg-[var(--color-surface)] rounded-xl border shadow-sm overflow-hidden ${isActive ? 'border-[var(--color-ambient)]' : 'border-[var(--color-border)]'}`}>
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-[var(--color-hover)] transition-colors">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={15} className="text-[var(--color-text-secondary)]" /> : <ChevronRight size={15} className="text-[var(--color-text-secondary)]" />}
          <span className="text-sm font-semibold text-[var(--color-primary)]">Semester {sem}</span>
          {isActive && <span className="text-[10px] bg-[var(--color-active-bg)] text-[var(--color-dark-ambient)] px-2 py-0.5 rounded-full font-medium">Active</span>}
          {s.count > 0 && <span className="text-xs text-[var(--color-text-secondary)]">{s.count} subjects</span>}
        </div>
        {s.count > 0 && (
          <div className="flex items-center gap-5 text-[11px] text-[var(--color-text-secondary)]">
            <span>{s.totalCredits} cr</span>
            <span>{s.totalContact}h/wk</span>
          </div>
        )}
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)]">
          {semSubs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--color-hover)]">
                    {['Code', 'Subject', 'Cat', 'L', 'T', 'P', 'Credits', 'Hrs/Wk', ''].map(h => (
                      <th key={h} className={`px-3 py-2 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide ${['L', 'T', 'P', 'Credits', 'Hrs/Wk'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {semSubs.map(sub => (
                    <SubjectRow key={sub.id} subject={sub} categories={categories}
                      onUpdate={async (id, fields) => { await updateBOSSubject(supabase, id, fields); onRefresh() }}
                      onDelete={async id => { if (confirm('Delete?')) { await deleteBOSSubject(supabase, id); onRefresh() } }} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adding ? (
            <div className="px-5 py-3 bg-[var(--color-hover)] border-t border-[var(--color-border)]">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2"><label className="text-[10px] text-[var(--color-text-secondary)]">Code</label><input value={f.subject_code} onChange={e => set('subject_code', e.target.value)} placeholder="CS301" className="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded" /></div>
                <div className="col-span-3"><label className="text-[10px] text-[var(--color-text-secondary)]">Subject</label><input value={f.subject_name} onChange={e => set('subject_name', e.target.value)} placeholder="Data Structures" className="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded" /></div>
                <div className="col-span-2"><label className="text-[10px] text-[var(--color-text-secondary)]">Category</label>
                  <select value={f.category_id} onChange={e => set('category_id', e.target.value)} className="w-full px-1 py-1.5 text-xs border border-[var(--color-border)] rounded">
                    <option value="">—</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                  </select>
                </div>
                <div><label className="text-[10px] text-[var(--color-text-secondary)]">L</label><input type="number" min="0" value={f.lecture_hours} onChange={e => set('lecture_hours', e.target.value)} className="w-full px-1 py-1.5 text-xs border border-[var(--color-border)] rounded text-center" /></div>
                <div><label className="text-[10px] text-[var(--color-text-secondary)]">T</label><input type="number" min="0" value={f.tutorial_hours} onChange={e => set('tutorial_hours', e.target.value)} className="w-full px-1 py-1.5 text-xs border border-[var(--color-border)] rounded text-center" /></div>
                <div><label className="text-[10px] text-[var(--color-text-secondary)]">P</label><input type="number" min="0" value={f.practical_hours} onChange={e => set('practical_hours', e.target.value)} className="w-full px-1 py-1.5 text-xs border border-[var(--color-border)] rounded text-center" /></div>
                <div className="col-span-2 flex gap-1">
                  <button onClick={add} className="px-3 py-1.5 bg-[var(--color-primary)] text-[var(--color-white)] rounded text-xs font-medium">Add</button>
                  <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-[var(--color-text-secondary)] text-xs">Cancel</button>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">{preview.total} credits · {preview.hours}h/week</p>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="w-full px-5 py-2.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-dark-ambient)] hover:bg-[var(--color-active-bg)] flex items-center gap-1.5 border-t border-[var(--color-border)] transition-colors">
              <Plus size={12} /> Add subject
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== PDF IMPORT (for append) ====================

function PDFImportInline({ bosId, onDone, onCancel }: { bosId: string; onDone: () => void; onCancel: () => void }) {
  const supabase = createClient()
  const [step, setStep] = useState<'upload' | 'extracting' | 'preview' | 'saving'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<any>(null)
  const [error, setError] = useState('')

  const handleUpload = async () => {
    if (!file) return toast.error('Select a file')
    setStep('extracting')
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/extract-bos', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('sync_secret') || 'alta_sync_2026_secret'}` },
        body: formData,
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error + (data.preview ? '\n\nPreview: ' + data.preview : ''))
      const parsed = data.data
      if (!parsed.semesters || !Array.isArray(parsed.semesters)) throw new Error('AI did not return semesters.')
      setExtracted(parsed)
      setStep('preview')
    } catch (err: any) {
      setError(err.message)
      setStep('upload')
      toast.error('Extraction failed: ' + err.message)
    }
  }

  const handleSave = async () => {
    if (!extracted) return
    setStep('saving')
    try {
      const cats = await fetchCategories(supabase)
      const catMap: Record<string, string> = {}
      cats.forEach(c => { catMap[c.code] = c.id })

      for (const sem of extracted.semesters) {
        for (const sub of sem.subjects) {
          try {
            await createBOSSubject(supabase, {
              bos_id: bosId, semester: sem.semester,
              subject_code: sub.subject_code || `SEM${sem.semester}-${String(sem.subjects.indexOf(sub) + 1).padStart(2, '0')}`,
              subject_name: sub.subject_name, category_id: catMap[sub.category] || null,
              lecture_hours: parseInt(sub.lecture_hours) || 0, tutorial_hours: parseInt(sub.tutorial_hours) || 0,
              practical_hours: parseInt(sub.practical_hours) || 0, is_elective: sub.is_elective || false, topics: sub.topics || [],
            })
          } catch (err: any) { console.warn(`Skip subject ${sub.subject_code}:`, err.message) }
        }
      }
      const subCount = extracted.semesters.reduce((s: number, sem: any) => s + sem.subjects.length, 0)
      toast.success(`Added ${subCount} subjects`)
      onDone()
    } catch (err: any) {
      toast.error(err.message)
      setStep('preview')
    }
  }

  const updateSubject = (semIdx: number, subIdx: number, field: string, value: any) => {
    setExtracted((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      next.semesters[semIdx].subjects[subIdx][field] = value
      return next
    })
  }

  const deleteSubject = (semIdx: number, subIdx: number) => {
    setExtracted((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      next.semesters[semIdx].subjects.splice(subIdx, 1)
      return next
    })
  }

  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <div>
          <button onClick={onCancel} className="flex items-center gap-1 text-xs text-[var(--color-dark-ambient)] hover:underline mb-3"><ArrowLeft size={12} /> Back</button>
          <h2 className="text-lg font-bold text-[var(--color-primary)]">Import more subjects</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Upload a file to add subjects to this BOS</p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">PDF File</label>
            <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-[var(--color-border)] rounded-xl cursor-pointer hover:border-[var(--color-ambient)] transition-colors">
              <Upload size={20} className="text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">{file ? file.name : 'Click to select PDF or CSV'}</span>
              <input type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
            </label>
          </div>
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
          <button onClick={handleUpload} disabled={!file}
            className="w-full py-2.5 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-colors">
            Extract with AI
          </button>
        </div>
      </div>
    )
  }

  if (step === 'extracting') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={32} className="text-[var(--color-ambient)] animate-spin mb-4" />
        <p className="text-sm font-medium text-[var(--color-primary)]">Extracting BOS from PDF...</p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">Gemini 2.5 Flash is reading your document</p>
      </div>
    )
  }

  if (step === 'saving') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={32} className="text-[var(--color-ambient)] animate-spin mb-4" />
        <p className="text-sm font-medium text-[var(--color-primary)]">Saving BOS...</p>
      </div>
    )
  }

  if (!extracted?.semesters) return <p className="text-[var(--color-text-secondary)] py-10 text-center">No data extracted. Try again.</p>
  const totalSubjects = extracted.semesters.reduce((s: number, sem: any) => s + (sem.subjects?.length || 0), 0)

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => setStep('upload')} className="flex items-center gap-1 text-xs text-[var(--color-dark-ambient)] hover:underline mb-3"><ArrowLeft size={12} /> Back to upload</button>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-primary)]">Preview Import</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{extracted.semesters.length} semesters · {totalSubjects} subjects extracted</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-colors">Discard All</button>
            <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors"><Check size={16} /> Save</button>
          </div>
        </div>
      </div>
      {extracted.semesters.sort((a: any, b: any) => a.semester - b.semester).map((sem: any, semIdx: number) => (
        <div key={sem.semester} className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[var(--color-hover)] border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-[var(--color-primary)]">Semester {sem.semester}</span>
              <span className="text-xs text-[var(--color-text-secondary)] ml-2">{sem.subjects.length} subjects</span>
            </div>
            <button onClick={() => {
              setExtracted((prev: any) => { const next = JSON.parse(JSON.stringify(prev)); next.semesters.splice(semIdx, 1); return next })
            }} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-colors">Discard semester</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--color-hover)]">
                  {['Code', 'Subject', 'Cat', 'L', 'T', 'P', 'Topics', ''].map(h => (
                    <th key={h} className={`px-3 py-2 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase ${['L', 'T', 'P'].includes(h) ? 'text-center w-12' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {sem.subjects.map((sub: any, subIdx: number) => (
                  <tr key={subIdx} className="hover:bg-[var(--color-hover)] group">
                    <td className="px-3 py-2"><input value={sub.subject_code} onChange={e => updateSubject(semIdx, subIdx, 'subject_code', e.target.value)} className="w-20 px-1 py-0.5 text-xs font-mono text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none" /></td>
                    <td className="px-3 py-2"><input value={sub.subject_name} onChange={e => updateSubject(semIdx, subIdx, 'subject_name', e.target.value)} className="w-full px-1 py-0.5 text-sm text-[var(--color-text-primary)] font-medium border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none" /></td>
                    <td className="px-3 py-2"><input value={sub.category || ''} onChange={e => updateSubject(semIdx, subIdx, 'category', e.target.value)} className="w-12 px-1 py-0.5 text-xs text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center" /></td>
                    <td className="px-3 py-2"><input type="number" min="0" value={sub.lecture_hours} onChange={e => updateSubject(semIdx, subIdx, 'lecture_hours', parseInt(e.target.value) || 0)} className="w-10 px-1 py-0.5 text-xs border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center" /></td>
                    <td className="px-3 py-2"><input type="number" min="0" value={sub.tutorial_hours} onChange={e => updateSubject(semIdx, subIdx, 'tutorial_hours', parseInt(e.target.value) || 0)} className="w-10 px-1 py-0.5 text-xs border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center" /></td>
                    <td className="px-3 py-2"><input type="number" min="0" value={sub.practical_hours} onChange={e => updateSubject(semIdx, subIdx, 'practical_hours', parseInt(e.target.value) || 0)} className="w-10 px-1 py-0.5 text-xs border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center" /></td>
                    <td className="px-3 py-2 text-[11px] text-[var(--color-text-secondary)] max-w-xs truncate">{(sub.topics || []).join(', ') || '—'}</td>
                    <td className="px-3 py-2"><button onClick={() => deleteSubject(semIdx, subIdx)} className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] rounded transition-opacity"><Trash2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ==================== MAIN DETAIL CLIENT ====================

export default function BOSDetailClient({ bos: initialBos, initialSubjects, initialAssignments, categories }: {
  bos: BOS
  initialSubjects: BOSSubject[]
  initialAssignments: BOSAssignment[]
  categories: BOSCategory[]
}) {
  const router = useRouter()
  const supabase = createClient()
  const [bos, setBos] = useState(initialBos)
  const [subjects, setSubjects] = useState(initialSubjects)
  const [assignments, setAssignments] = useState(initialAssignments)
  const [showAssign, setShowAssign] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const refresh = async () => {
    const [s, a] = await Promise.all([
      fetchBOSSubjects(supabase, bos.id),
      fetchBOSAssignments(supabase, bos.id),
    ])
    setSubjects(s)
    setAssignments(a)
  }

  if (showImport) {
    return <PDFImportInline bosId={bos.id} onDone={() => { setShowImport(false); refresh() }} onCancel={() => setShowImport(false)} />
  }

  const totals = subjects.reduce((acc, s) => ({
    credits: acc.credits + (s.total_credits || 0),
    hours: acc.hours + (s.lecture_hours || 0) + (s.tutorial_hours || 0) + (s.practical_hours || 0),
    theory: acc.theory + (s.theory_credits || 0),
    practical: acc.practical + (s.practical_credits || 0),
  }), { credits: 0, hours: 0, theory: 0, practical: 0 })

  const highlightSemesters = new Set(assignments.map(a => a.current_semester))

  const handleAssign = async (form: { bos_id: string; campus_name: string; admission_year: number; current_semester: number }) => {
    await createBOSAssignment(supabase, form)
    setShowAssign(false)
    refresh()
    toast.success('Assigned')
  }

  const handleSemChange = async (assignmentId: string, newSem: number) => {
    await updateBOSAssignment(supabase, assignmentId, { current_semester: newSem })
    refresh()
  }

  const handleRemoveAssignment = async (id: string) => {
    if (!confirm('Remove this batch assignment?')) return
    await deleteBOSAssignment(supabase, id)
    refresh()
  }

  const handleStatusChange = async (newStatus: string) => {
    await updateBOS(supabase, bos.id, { status: newStatus })
    setBos(prev => ({ ...prev, status: newStatus as BOS['status'] }))
    toast.success(`Status changed to ${newStatus}`)
  }

  // Semester overview stats
  const semStats = Array.from({ length: bos.total_semesters }, (_, i) => {
    const s = semesterSummary(subjects, i + 1)
    return { sem: i + 1, ...s }
  }).filter(s => s.count > 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={() => router.push('/admin/academics/bos')} className="flex items-center gap-1 text-xs text-[var(--color-dark-ambient)] hover:underline mb-3">
          <ArrowLeft size={12} /> All BOS
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-primary)]">{bos.name}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{bos.program} · {bos.total_semesters} semesters</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-lg text-xs font-medium hover:bg-[var(--color-hover)] transition-colors">
              <Upload size={13} /> Import more subjects
            </button>
            <select value={bos.status} onChange={e => handleStatusChange(e.target.value)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-full uppercase cursor-pointer border-none outline-none ${STATUS_BADGE[bos.status]}`}>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assigned batches */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-2">
            <Link2 size={14} className="text-[var(--color-ambient)]" /> Assigned Batches
          </h3>
          <button onClick={() => setShowAssign(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[var(--color-dark-ambient)] hover:bg-[var(--color-active-bg)] rounded-lg transition-colors">
            <Plus size={13} /> Assign
          </button>
        </div>
        {assignments.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)] py-2">No batches assigned yet</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {assignments.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 bg-[var(--color-hover)] rounded-lg group">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-primary)]">{a.campus_name} · {a.admission_year}</span>
                  <span className="text-[10px] text-[var(--color-text-secondary)] ml-2">Sem</span>
                  <select value={a.current_semester} onChange={e => handleSemChange(a.id, parseInt(e.target.value))}
                    className="ml-1 text-[11px] font-semibold text-[var(--color-dark-ambient)] bg-transparent border-none outline-none cursor-pointer">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button onClick={() => handleRemoveAssignment(a.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-opacity">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Semester overview table */}
      {subjects.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-primary)]">Semester Overview</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--color-hover)]">
                <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">Semester</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">Subjects</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">Theory Cr</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">Practical Cr</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">Total Credits</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">Hrs/Week</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">Hrs/Day</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {semStats.map(s => {
                const isActive = highlightSemesters.has(s.sem)
                return (
                  <tr key={s.sem} className={isActive ? 'bg-[var(--color-active-bg)]' : ''}>
                    <td className="px-5 py-3 text-sm font-medium text-[var(--color-primary)]">
                      Sem {s.sem}
                      {isActive && <span className="ml-2 text-[10px] bg-[var(--color-active-bg)] text-[var(--color-dark-ambient)] px-1.5 py-0.5 rounded">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-[var(--color-text-secondary)]">{s.count}</td>
                    <td className="px-4 py-3 text-sm text-center text-[var(--color-text-secondary)]">{s.theoryCredits}</td>
                    <td className="px-4 py-3 text-sm text-center text-[var(--color-text-secondary)]">{s.practicalCredits}</td>
                    <td className="px-4 py-3 text-sm text-center font-semibold text-[var(--color-primary)]">{s.totalCredits}</td>
                    <td className="px-4 py-3 text-sm text-center font-semibold text-[var(--color-dark-ambient)]">{s.totalContact}h</td>
                    <td className="px-4 py-3 text-sm text-center text-[var(--color-text-secondary)]">{(s.totalContact / 5).toFixed(1)}h</td>
                    <td className="px-4 py-3 text-center">
                      {isActive ? (
                        <span className="text-[10px] bg-[var(--color-active-bg)] text-[var(--color-dark-ambient)] px-2 py-0.5 rounded-full font-medium">Running</span>
                      ) : s.sem < Math.min(...[...highlightSemesters]) ? (
                        <span className="text-[10px] text-[var(--color-text-secondary)]">Completed</span>
                      ) : (
                        <span className="text-[10px] text-[var(--color-text-secondary)]">Upcoming</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--color-hover)] border-t border-[var(--color-border)]">
                <td className="px-5 py-3 text-sm font-semibold text-[var(--color-primary)]">Total</td>
                <td className="px-4 py-3 text-sm text-center font-medium text-[var(--color-primary)]">{subjects.length}</td>
                <td className="px-4 py-3 text-sm text-center font-medium text-[var(--color-primary)]">{totals.theory}</td>
                <td className="px-4 py-3 text-sm text-center font-medium text-[var(--color-primary)]">{totals.practical}</td>
                <td className="px-4 py-3 text-sm text-center font-bold text-[var(--color-primary)]">{totals.credits}</td>
                <td className="px-4 py-3 text-sm text-center font-bold text-[var(--color-dark-ambient)]">{totals.hours}h</td>
                <td className="px-4 py-3 text-sm text-center text-[var(--color-text-secondary)]">{semStats.length > 0 ? (totals.hours / semStats.length / 5).toFixed(1) : '0'}h</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Semesters */}
      {Array.from({ length: bos.total_semesters }, (_, i) => i + 1).map(sem => (
        <SemesterBlock key={sem} sem={sem} subjects={subjects} categories={categories} bosId={bos.id} onRefresh={refresh} highlightSemesters={highlightSemesters} />
      ))}

      {showAssign && <AssignModal bosId={bos.id} existingAssignments={assignments} onSave={handleAssign} onCancel={() => setShowAssign(false)} />}
    </div>
  )
}
