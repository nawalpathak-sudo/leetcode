'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, BookOpen, Link2, Upload, X, ArrowLeft, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  BOS,
  createBOS,
  deleteBOS,
  fetchBOSList,
  createBOSSubject,
  fetchCategories,
} from '../_lib/queries'
import toast from 'react-hot-toast'

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  approved: 'bg-[var(--color-ambient)]/10 text-[var(--color-dark-ambient)]',
  archived: 'bg-[var(--color-primary)]/5 text-[var(--color-primary)]/40',
}

// ==================== CREATE MODAL ====================

function CreateModal({ onSave, onCancel }: { onSave: (form: { name: string; program: string; total_semesters: number }) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', program: 'B.Tech', total_semesters: 8 })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return toast.error('Name required')
    try { await onSave(form) } catch (err: any) {
      toast.error(err.message?.includes('duplicate') ? 'BOS with this name already exists' : err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-[var(--color-surface)] rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-[var(--color-primary)]">New BOS Template</h3>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., B.Tech CSE 2024 Curriculum"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Program</label>
            <input value={form.program} onChange={e => setForm({ ...form, program: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Semesters</label>
            <input type="number" value={form.total_semesters} onChange={e => setForm({ ...form, total_semesters: parseInt(e.target.value) || 8 })}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors">Create</button>
        </div>
      </form>
    </div>
  )
}

// ==================== PDF IMPORT FLOW ====================

function PDFImportFlow({ existingBosId, onDone, onCancel }: {
  existingBosId: string | null
  onDone: (id: string) => void
  onCancel: () => void
}) {
  const isAppend = !!existingBosId
  const [step, setStep] = useState<'upload' | 'extracting' | 'preview' | 'saving'>('upload')
  const [name, setName] = useState('')
  const [program, setProgram] = useState('B.Tech')
  const [file, setFile] = useState<File | null>(null)
  const [extracted, setExtracted] = useState<any>(null)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleUpload = async () => {
    if (!file) return toast.error('Select a file')
    if (!isAppend && !name) return toast.error('Name required')
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
      if (!data.ok) {
        throw new Error(data.error + (data.preview ? '\n\nPreview: ' + data.preview : ''))
      }

      const parsed = data.data
      if (!parsed.semesters || !Array.isArray(parsed.semesters)) {
        throw new Error('AI did not return semesters. Got: ' + JSON.stringify(parsed).slice(0, 200))
      }
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
      let bosId = existingBosId
      if (!bosId) {
        const totalSemesters = Math.max(...extracted.semesters.map((s: any) => s.semester), 8)
        const bos = await createBOS(supabase, { name, program, total_semesters: totalSemesters })
        bosId = bos.id
      }

      const cats = await fetchCategories(supabase)
      const catMap: Record<string, string> = {}
      cats.forEach(c => { catMap[c.code] = c.id })

      for (const sem of extracted.semesters) {
        for (const sub of sem.subjects) {
          try {
            await createBOSSubject(supabase, {
              bos_id: bosId,
              semester: sem.semester,
              subject_code: sub.subject_code || `SEM${sem.semester}-${String(sem.subjects.indexOf(sub) + 1).padStart(2, '0')}`,
              subject_name: sub.subject_name,
              category_id: catMap[sub.category] || null,
              lecture_hours: parseInt(sub.lecture_hours) || 0,
              tutorial_hours: parseInt(sub.tutorial_hours) || 0,
              practical_hours: parseInt(sub.practical_hours) || 0,
              is_elective: sub.is_elective || false,
              topics: sub.topics || [],
            })
          } catch (err: any) {
            console.warn(`Skip subject ${sub.subject_code}:`, err.message)
          }
        }
      }

      const subCount = extracted.semesters.reduce((s: number, sem: any) => s + sem.subjects.length, 0)
      toast.success(`${isAppend ? 'Added' : 'Created'} ${subCount} subjects`)
      onDone(bosId!)
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
          <button onClick={onCancel} className="flex items-center gap-1 text-xs text-[var(--color-dark-ambient)] hover:underline mb-3">
            <ArrowLeft size={12} /> Back
          </button>
          <h2 className="text-lg font-bold text-[var(--color-primary)]">{isAppend ? 'Import more subjects' : 'Import BOS from file'}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{isAppend ? 'Upload a file to add subjects to this BOS' : 'Upload a BOS PDF or CSV — AI will extract subjects, L-T-P, and topics'}</p>
        </div>
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm space-y-4 max-w-lg">
          {!isAppend && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">BOS Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., B.Tech CSE — SSU 2024"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Program</label>
                <input value={program} onChange={e => setProgram(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-ambient)] outline-none" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">PDF File</label>
            <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-[var(--color-border)] rounded-xl cursor-pointer hover:border-[var(--color-ambient)] transition-colors">
              <Upload size={20} className="text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">{file ? file.name : 'Click to select PDF or CSV'}</span>
              <input type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }} />
            </label>
          </div>
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
          <button onClick={handleUpload} disabled={!file || (!isAppend && !name)}
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
        <button onClick={() => setStep('upload')} className="flex items-center gap-1 text-xs text-[var(--color-dark-ambient)] hover:underline mb-3">
          <ArrowLeft size={12} /> Back to upload
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-primary)]">Preview: {name}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{extracted.semesters.length} semesters · {totalSubjects} subjects extracted</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-colors">
              Discard All
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
              <Check size={16} /> Save BOS
            </button>
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
              setExtracted((prev: any) => {
                const next = JSON.parse(JSON.stringify(prev))
                next.semesters.splice(semIdx, 1)
                return next
              })
            }} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-colors">
              Discard semester
            </button>
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
                    <td className="px-3 py-2">
                      <input value={sub.subject_code} onChange={e => updateSubject(semIdx, subIdx, 'subject_code', e.target.value)}
                        className="w-20 px-1 py-0.5 text-xs font-mono text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={sub.subject_name} onChange={e => updateSubject(semIdx, subIdx, 'subject_name', e.target.value)}
                        className="w-full px-1 py-0.5 text-sm text-[var(--color-text-primary)] font-medium border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={sub.category || ''} onChange={e => updateSubject(semIdx, subIdx, 'category', e.target.value)}
                        className="w-12 px-1 py-0.5 text-xs text-[var(--color-text-secondary)] border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={sub.lecture_hours} onChange={e => updateSubject(semIdx, subIdx, 'lecture_hours', parseInt(e.target.value) || 0)}
                        className="w-10 px-1 py-0.5 text-xs border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={sub.tutorial_hours} onChange={e => updateSubject(semIdx, subIdx, 'tutorial_hours', parseInt(e.target.value) || 0)}
                        className="w-10 px-1 py-0.5 text-xs border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={sub.practical_hours} onChange={e => updateSubject(semIdx, subIdx, 'practical_hours', parseInt(e.target.value) || 0)}
                        className="w-10 px-1 py-0.5 text-xs border border-transparent hover:border-[var(--color-border)] rounded focus:border-[var(--color-ambient)] outline-none text-center" />
                    </td>
                    <td className="px-3 py-2 text-[11px] text-[var(--color-text-secondary)] max-w-xs truncate">{(sub.topics || []).join(', ') || '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deleteSubject(semIdx, subIdx)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] rounded transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    </td>
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

// ==================== MAIN LIST CLIENT ====================

export default function BOSListClient({ initialData }: { initialData: BOS[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [bosList, setBosList] = useState<BOS[]>(initialData)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const refresh = async () => {
    const data = await fetchBOSList(supabase)
    setBosList(data)
  }

  const handleCreate = async (form: { name: string; program: string; total_semesters: number }) => {
    const bos = await createBOS(supabase, form)
    setShowCreate(false)
    await refresh()
    router.push(`/admin/academics/bos/${bos.id}`)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this BOS and all subjects/assignments?')) return
    await deleteBOS(supabase, id)
    refresh()
  }

  if (showImport) {
    return (
      <PDFImportFlow
        existingBosId={null}
        onDone={(id) => { setShowImport(false); refresh().then(() => router.push(`/admin/academics/bos/${id}`)) }}
        onCancel={() => setShowImport(false)}
      />
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-primary)]">Board of Studies</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Curriculum templates — assign to campus x batch</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-primary)] rounded-lg text-sm font-medium hover:bg-[var(--color-hover)] transition-colors">
              <Upload size={16} /> Import PDF
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-white)] rounded-lg text-sm font-medium hover:opacity-90 transition-colors">
              <Plus size={16} /> New BOS
            </button>
          </div>
        </div>

        {bosList.length === 0 ? (
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-16 text-center shadow-sm">
            <BookOpen size={40} className="mx-auto text-[var(--color-text-secondary)] mb-3 opacity-40" />
            <p className="text-sm text-[var(--color-text-secondary)]">No BOS templates yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bosList.map(b => (
              <div key={b.id} onClick={() => router.push(`/admin/academics/bos/${b.id}`)}
                className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-5 shadow-sm cursor-pointer hover:border-[var(--color-ambient)] transition-all group">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-semibold text-[var(--color-primary)]">{b.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${STATUS_BADGE[b.status]}`}>{b.status}</span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">{b.program} · {b.total_semesters} semesters</p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]">
                  <span className="text-xs text-[var(--color-text-secondary)]">{b.bos_subjects?.[0]?.count || 0} subjects</span>
                  <span className="text-xs text-[var(--color-dark-ambient)] flex items-center gap-1">
                    <Link2 size={11} /> {b.bos_assignments?.[0]?.count || 0} batches
                  </span>
                  <button onClick={e => { e.stopPropagation(); handleDelete(b.id) }}
                    className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateModal onSave={handleCreate} onCancel={() => setShowCreate(false)} />}
    </>
  )
}
