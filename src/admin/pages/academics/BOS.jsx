import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Edit3, ChevronDown, ChevronRight, BookOpen, Clock, X, Check, ArrowLeft, Link2, Upload, Loader2 } from 'lucide-react'
import { loadBOSList, loadBOS, createBOS, updateBOS, deleteBOS, loadBOSSubjects, createBOSSubject, updateBOSSubject, deleteBOSSubject, loadCategories, loadBOSAssignments, createBOSAssignment, updateBOSAssignment, deleteBOSAssignment, computeCredits, semesterSummary } from '../../../lib/bosDb'
import { loadCampuses, loadBatches } from '../../../lib/masterDb'
import toast from 'react-hot-toast'

const STATUS_BADGE = { draft: 'bg-amber-50 text-amber-700', approved: 'bg-ambient/10 text-dark-ambient', archived: 'bg-primary/5 text-primary/40' }

// ==================== LIST VIEW ====================

function BOSList({ bosList, onSelect, onNew, onDelete, onImport }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary">Board of Studies</h2>
          <p className="text-sm text-primary/40 mt-0.5">Curriculum templates — assign to campus × batch</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onImport} className="flex items-center gap-2 px-4 py-2 border border-primary/15 text-primary rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors">
            <Upload size={16} /> Import PDF
          </button>
          <button onClick={onNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={16} /> New BOS
          </button>
        </div>
      </div>

      {bosList.length === 0 ? (
        <div className="bg-white rounded-xl border border-primary/10 p-16 text-center shadow-sm">
          <BookOpen size={40} className="mx-auto text-primary/15 mb-3" />
          <p className="text-sm text-primary/40">No BOS templates yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bosList.map(b => (
            <div key={b.id} onClick={() => onSelect(b.id)}
              className="bg-white rounded-xl border border-primary/10 p-5 shadow-sm cursor-pointer hover:border-ambient/40 transition-all group">
              <div className="flex items-start justify-between mb-1">
                <p className="text-sm font-semibold text-primary">{b.name}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${STATUS_BADGE[b.status]}`}>{b.status}</span>
              </div>
              <p className="text-xs text-primary/40">{b.program} · {b.total_semesters} semesters</p>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-primary/5">
                <span className="text-xs text-primary/30">{b.bos_subjects?.[0]?.count || 0} subjects</span>
                <span className="text-xs text-dark-ambient flex items-center gap-1">
                  <Link2 size={11} /> {b.bos_assignments?.[0]?.count || 0} batches
                </span>
                <button onClick={e => { e.stopPropagation(); onDelete(b.id) }}
                  className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-primary/15 hover:text-red-500 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== CREATE MODAL ====================

function CreateModal({ onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', program: 'B.Tech', total_semesters: 8 })

  const submit = async e => {
    e.preventDefault()
    if (!form.name) return toast.error('Name required')
    try { await onSave(form) } catch (err) {
      toast.error(err.message?.includes('duplicate') ? 'BOS with this name already exists' : err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-primary">New BOS Template</h3>
        <div>
          <label className="block text-xs font-medium text-primary/50 mb-1">Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., B.Tech CSE 2024 Curriculum"
            className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary focus:border-ambient outline-none" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-primary/50 mb-1">Program</label>
            <input value={form.program} onChange={e => setForm({ ...form, program: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary focus:border-ambient outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/50 mb-1">Semesters</label>
            <input type="number" value={form.total_semesters} onChange={e => setForm({ ...form, total_semesters: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary focus:border-ambient outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-primary/50 hover:text-primary">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90">Create</button>
        </div>
      </form>
    </div>
  )
}

// ==================== PDF IMPORT FLOW ====================

function PDFImportFlow({ existingBosId, onDone, onCancel }) {
  const isAppend = !!existingBosId
  const [step, setStep] = useState('upload') // upload → extracting → preview → saving
  const [name, setName] = useState('')
  const [program, setProgram] = useState('B.Tech')
  const [file, setFile] = useState(null)
  const [extracted, setExtracted] = useState(null)
  const [error, setError] = useState('')

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
        console.error('Extract response:', data)
        throw new Error(data.error + (data.preview ? '\n\nPreview: ' + data.preview : ''))
      }

      const parsed = data.data
      // Normalize — ensure semesters array exists
      if (!parsed.semesters || !Array.isArray(parsed.semesters)) {
        throw new Error('AI did not return semesters. Got: ' + JSON.stringify(parsed).slice(0, 200))
      }
      setExtracted(parsed)
      setStep('preview')
    } catch (err) {
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
        const totalSemesters = Math.max(...extracted.semesters.map(s => s.semester), 8)
        const bos = await createBOS({ name, program, total_semesters: totalSemesters })
        bosId = bos.id
      }

      const cats = await loadCategories()
      const catMap = {}
      cats.forEach(c => { catMap[c.code] = c.id })

      // Insert all subjects
      for (const sem of extracted.semesters) {
        for (const sub of sem.subjects) {
          try {
            await createBOSSubject({
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
          } catch (err) {
            console.warn(`Skip subject ${sub.subject_code}:`, err.message)
          }
        }
      }

      const subCount = extracted.semesters.reduce((s, sem) => s + sem.subjects.length, 0)
      toast.success(`${isAppend ? 'Added' : 'Created'} ${subCount} subjects`)
      onDone(bosId)
    } catch (err) {
      toast.error(err.message)
      setStep('preview')
    }
  }

  // Edit subject in preview
  const updateSubject = (semIdx, subIdx, field, value) => {
    setExtracted(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.semesters[semIdx].subjects[subIdx][field] = value
      return next
    })
  }

  const deleteSubject = (semIdx, subIdx) => {
    setExtracted(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.semesters[semIdx].subjects.splice(subIdx, 1)
      return next
    })
  }

  // Upload step
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <div>
          <button onClick={onCancel} className="flex items-center gap-1 text-xs text-dark-ambient hover:underline mb-3">
            <ArrowLeft size={12} /> Back
          </button>
          <h2 className="text-lg font-bold text-primary">{isAppend ? 'Import more subjects' : 'Import BOS from file'}</h2>
          <p className="text-sm text-primary/40 mt-0.5">{isAppend ? 'Upload a file to add subjects to this BOS' : 'Upload a BOS PDF or CSV — AI will extract subjects, L-T-P, and topics'}</p>
        </div>

        <div className="bg-white rounded-xl border border-primary/10 p-6 shadow-sm space-y-4 max-w-lg">
          {!isAppend && (
            <>
              <div>
                <label className="block text-xs font-medium text-primary/50 mb-1">BOS Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., B.Tech CSE — SSU 2024"
                  className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary focus:border-ambient outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary/50 mb-1">Program</label>
                <input value={program} onChange={e => setProgram(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary focus:border-ambient outline-none" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-primary/50 mb-1">PDF File</label>
            <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-primary/15 rounded-xl cursor-pointer hover:border-ambient/50 transition-colors">
              <Upload size={20} className="text-primary/25" />
              <span className="text-sm text-primary/40">{file ? file.name : 'Click to select PDF or CSV'}</span>
              <input type="file" className="hidden" onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]) }} />
            </label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={handleUpload} disabled={!file || (!isAppend && !name)}
            className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
            Extract with AI
          </button>
        </div>
      </div>
    )
  }

  // Extracting step
  if (step === 'extracting') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={32} className="text-ambient animate-spin mb-4" />
        <p className="text-sm font-medium text-primary">Extracting BOS from PDF...</p>
        <p className="text-xs text-primary/40 mt-1">Gemini 2.5 Flash is reading your document</p>
      </div>
    )
  }

  // Saving step
  if (step === 'saving') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={32} className="text-ambient animate-spin mb-4" />
        <p className="text-sm font-medium text-primary">Saving BOS...</p>
      </div>
    )
  }

  // Preview step
  if (!extracted?.semesters) return <p className="text-primary/40 py-10 text-center">No data extracted. Try again.</p>
  const totalSubjects = extracted.semesters.reduce((s, sem) => s + (sem.subjects?.length || 0), 0)

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => setStep('upload')} className="flex items-center gap-1 text-xs text-dark-ambient hover:underline mb-3">
          <ArrowLeft size={12} /> Back to upload
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Preview: {name}</h2>
            <p className="text-sm text-primary/40">{extracted.semesters.length} semesters · {totalSubjects} subjects extracted</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel}
              className="px-4 py-2.5 text-sm text-primary/40 hover:text-red-500 transition-colors">
              Discard All
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <Check size={16} /> Save BOS
            </button>
          </div>
        </div>
      </div>

      {extracted.semesters.sort((a, b) => a.semester - b.semester).map((sem, semIdx) => (
        <div key={sem.semester} className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-primary/[0.02] border-b border-primary/5 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-primary">Semester {sem.semester}</span>
              <span className="text-xs text-primary/30 ml-2">{sem.subjects.length} subjects</span>
            </div>
            <button onClick={() => {
              setExtracted(prev => {
                const next = JSON.parse(JSON.stringify(prev))
                next.semesters.splice(semIdx, 1)
                return next
              })
            }} className="text-xs text-primary/25 hover:text-red-500 transition-colors">
              Discard semester
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-primary/[0.015]">
                  {['Code','Subject','Cat','L','T','P','Topics',''].map(h => (
                    <th key={h} className={`px-3 py-2 text-[10px] font-semibold text-primary/35 uppercase ${['L','T','P'].includes(h) ? 'text-center w-12' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {sem.subjects.map((sub, subIdx) => (
                  <tr key={subIdx} className="hover:bg-primary/[0.01] group">
                    <td className="px-3 py-2">
                      <input value={sub.subject_code} onChange={e => updateSubject(semIdx, subIdx, 'subject_code', e.target.value)}
                        className="w-20 px-1 py-0.5 text-xs font-mono text-primary/60 border border-transparent hover:border-primary/15 rounded focus:border-ambient outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={sub.subject_name} onChange={e => updateSubject(semIdx, subIdx, 'subject_name', e.target.value)}
                        className="w-full px-1 py-0.5 text-sm text-primary font-medium border border-transparent hover:border-primary/15 rounded focus:border-ambient outline-none" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={sub.category || ''} onChange={e => updateSubject(semIdx, subIdx, 'category', e.target.value)}
                        className="w-12 px-1 py-0.5 text-xs text-primary/40 border border-transparent hover:border-primary/15 rounded focus:border-ambient outline-none text-center" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={sub.lecture_hours} onChange={e => updateSubject(semIdx, subIdx, 'lecture_hours', parseInt(e.target.value) || 0)}
                        className="w-10 px-1 py-0.5 text-xs border border-transparent hover:border-primary/15 rounded focus:border-ambient outline-none text-center" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={sub.tutorial_hours} onChange={e => updateSubject(semIdx, subIdx, 'tutorial_hours', parseInt(e.target.value) || 0)}
                        className="w-10 px-1 py-0.5 text-xs border border-transparent hover:border-primary/15 rounded focus:border-ambient outline-none text-center" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={sub.practical_hours} onChange={e => updateSubject(semIdx, subIdx, 'practical_hours', parseInt(e.target.value) || 0)}
                        className="w-10 px-1 py-0.5 text-xs border border-transparent hover:border-primary/15 rounded focus:border-ambient outline-none text-center" />
                    </td>
                    <td className="px-3 py-2 text-[11px] text-primary/30 max-w-xs truncate">{(sub.topics || []).join(', ') || '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deleteSubject(semIdx, subIdx)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-primary/15 hover:text-red-500 rounded transition-opacity">
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

// ==================== ASSIGN MODAL ====================

function AssignModal({ bosId, existingAssignments, onSave, onCancel }) {
  const [campuses, setCampuses] = useState([])
  const [batches, setBatches] = useState([])
  const [form, setForm] = useState({ campus_name: '', admission_year: '', current_semester: 1 })

  useEffect(() => { loadCampuses().then(setCampuses) }, [])

  useEffect(() => {
    if (!form.campus_name) { setBatches([]); return }
    const campus = campuses.find(c => c.name === form.campus_name)
    if (campus) loadBatches(campus.id).then(b => {
      // Filter out already assigned
      const assigned = new Set(existingAssignments.filter(a => a.campus_name === form.campus_name).map(a => a.admission_year))
      setBatches(b.filter(x => !assigned.has(x.admission_year)))
    })
  }, [form.campus_name, campuses, existingAssignments])

  // Auto-calculate current semester from admission year
  useEffect(() => {
    if (!form.admission_year) return
    const now = new Date()
    const year = parseInt(form.admission_year)
    const yearsIn = now.getFullYear() - year
    const isSecondHalf = now.getMonth() >= 6 // Jul-Dec
    const sem = Math.max(1, Math.min(8, yearsIn * 2 + (isSecondHalf ? 1 : 2)))
    setForm(f => ({ ...f, current_semester: sem }))
  }, [form.admission_year])

  const submit = async e => {
    e.preventDefault()
    if (!form.campus_name || !form.admission_year) return toast.error('Select campus and batch')
    try { await onSave({ bos_id: bosId, ...form }) } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onCancel}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-primary">Assign to Batch</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-primary/50 mb-1">Campus</label>
            <select value={form.campus_name} onChange={e => setForm({ ...form, campus_name: e.target.value, admission_year: '' })}
              className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary focus:border-ambient outline-none bg-white">
              <option value="">Select</option>
              {campuses.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-primary/50 mb-1">Batch</label>
            <select value={form.admission_year} onChange={e => setForm({ ...form, admission_year: e.target.value })}
              disabled={!form.campus_name} className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary focus:border-ambient outline-none bg-white disabled:opacity-40">
              <option value="">Select</option>
              {batches.map(b => <option key={b.id} value={b.admission_year}>{b.admission_year}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-primary/50 mb-1">Current Semester</label>
          <select value={form.current_semester} onChange={e => setForm({ ...form, current_semester: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-primary/15 text-sm text-primary focus:border-ambient outline-none bg-white">
            {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
          </select>
          <p className="text-[10px] text-primary/30 mt-1">Auto-calculated from admission year. Override if needed.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-primary/50 hover:text-primary">Cancel</button>
          <button type="submit" disabled={!form.campus_name || !form.admission_year}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40">Assign</button>
        </div>
      </form>
    </div>
  )
}

// ==================== SUBJECT ROW ====================

function SubjectRow({ subject, categories, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState(subject)
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    try {
      await onUpdate(subject.id, {
        subject_code: f.subject_code, subject_name: f.subject_name, category_id: f.category_id || null,
        lecture_hours: parseInt(f.lecture_hours) || 0, tutorial_hours: parseInt(f.tutorial_hours) || 0,
        practical_hours: parseInt(f.practical_hours) || 0, is_elective: f.is_elective, is_audit: f.is_audit,
      })
      setEditing(false)
    } catch (err) { toast.error(err.message) }
  }

  const c = computeCredits(
    editing ? parseInt(f.lecture_hours) || 0 : subject.lecture_hours,
    editing ? parseInt(f.tutorial_hours) || 0 : subject.tutorial_hours,
    editing ? parseInt(f.practical_hours) || 0 : subject.practical_hours
  )

  if (editing) {
    return (
      <tr className="bg-ambient/5">
        <td className="px-3 py-2"><input value={f.subject_code} onChange={e => set('subject_code', e.target.value)} className="w-full px-2 py-1 text-xs border border-primary/15 rounded" /></td>
        <td className="px-3 py-2"><input value={f.subject_name} onChange={e => set('subject_name', e.target.value)} className="w-full px-2 py-1 text-xs border border-primary/15 rounded" /></td>
        <td className="px-3 py-2">
          <select value={f.category_id || ''} onChange={e => set('category_id', e.target.value)} className="w-full px-1 py-1 text-xs border border-primary/15 rounded">
            <option value="">—</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
          </select>
        </td>
        <td className="px-3 py-2"><input type="number" min="0" value={f.lecture_hours} onChange={e => set('lecture_hours', e.target.value)} className="w-12 px-1 py-1 text-xs border border-primary/15 rounded text-center" /></td>
        <td className="px-3 py-2"><input type="number" min="0" value={f.tutorial_hours} onChange={e => set('tutorial_hours', e.target.value)} className="w-12 px-1 py-1 text-xs border border-primary/15 rounded text-center" /></td>
        <td className="px-3 py-2"><input type="number" min="0" value={f.practical_hours} onChange={e => set('practical_hours', e.target.value)} className="w-12 px-1 py-1 text-xs border border-primary/15 rounded text-center" /></td>
        <td className="px-3 py-2 text-center text-xs font-semibold text-primary">{c.total}</td>
        <td className="px-3 py-2 text-center text-xs text-primary/40">{c.hours}h</td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button onClick={save} className="p-1 text-dark-ambient hover:bg-ambient/10 rounded"><Check size={14} /></button>
            <button onClick={() => setEditing(false)} className="p-1 text-primary/30 hover:text-primary rounded"><X size={14} /></button>
          </div>
        </td>
      </tr>
    )
  }

  const cat = subject.bos_subject_categories
  const topics = subject.topics || []
  return (
    <tr className="hover:bg-primary/[0.02] group">
      <td className="px-3 py-2.5 text-xs font-mono text-primary/50">{subject.subject_code}</td>
      <td className="px-3 py-2.5">
        <div className="text-sm text-primary font-medium">
          {subject.subject_name}
          {subject.is_elective && <span className="ml-1.5 text-[10px] bg-ambient/10 text-dark-ambient px-1.5 py-0.5 rounded">Elective</span>}
          {subject.is_audit && <span className="ml-1.5 text-[10px] bg-primary/5 text-primary/40 px-1.5 py-0.5 rounded">Audit</span>}
        </div>
        {topics.length > 0 && (
          <p className="text-[11px] text-primary/30 mt-0.5 line-clamp-2">{topics.join(' · ')}</p>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-primary/40">{cat?.code || '—'}</td>
      <td className="px-3 py-2.5 text-xs text-center text-primary/50">{subject.lecture_hours}</td>
      <td className="px-3 py-2.5 text-xs text-center text-primary/50">{subject.tutorial_hours}</td>
      <td className="px-3 py-2.5 text-xs text-center text-primary/50">{subject.practical_hours}</td>
      <td className="px-3 py-2.5 text-xs text-center font-semibold text-primary">{c.total}</td>
      <td className="px-3 py-2.5 text-xs text-center text-primary/40">{c.hours}h</td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => { setF(subject); setEditing(true) }} className="p-1 text-primary/25 hover:text-primary rounded"><Edit3 size={13} /></button>
          <button onClick={() => onDelete(subject.id)} className="p-1 text-primary/15 hover:text-red-500 rounded"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

// ==================== SEMESTER BLOCK ====================

function SemesterBlock({ sem, subjects, categories, bosId, onRefresh, highlightSemesters }) {
  const isActive = highlightSemesters.has(sem)
  const [open, setOpen] = useState(isActive || sem <= 2)
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ subject_code: '', subject_name: '', category_id: '', lecture_hours: 3, tutorial_hours: 1, practical_hours: 0 })
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  const s = semesterSummary(subjects, sem)
  const semSubs = subjects.filter(x => x.semester === sem)
  const preview = computeCredits(parseInt(f.lecture_hours) || 0, parseInt(f.tutorial_hours) || 0, parseInt(f.practical_hours) || 0)

  const add = async () => {
    if (!f.subject_code || !f.subject_name) return toast.error('Code and name required')
    try {
      await createBOSSubject({
        bos_id: bosId, semester: sem, subject_code: f.subject_code, subject_name: f.subject_name,
        category_id: f.category_id || null, lecture_hours: parseInt(f.lecture_hours) || 0,
        tutorial_hours: parseInt(f.tutorial_hours) || 0, practical_hours: parseInt(f.practical_hours) || 0,
      })
      setF({ subject_code: '', subject_name: '', category_id: '', lecture_hours: 3, tutorial_hours: 1, practical_hours: 0 })
      setAdding(false)
      onRefresh()
    } catch (err) { toast.error(err.message?.includes('duplicate') ? 'Subject code already exists in this semester' : err.message) }
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isActive ? 'border-ambient/40' : 'border-primary/10'}`}>
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-primary/[0.015] transition-colors">
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={15} className="text-primary/25" /> : <ChevronRight size={15} className="text-primary/25" />}
          <span className="text-sm font-semibold text-primary">Semester {sem}</span>
          {isActive && <span className="text-[10px] bg-ambient/10 text-dark-ambient px-2 py-0.5 rounded-full font-medium">Active</span>}
          {s.count > 0 && <span className="text-xs text-primary/25">{s.count} subjects</span>}
        </div>
        {s.count > 0 && (
          <div className="flex items-center gap-5 text-[11px] text-primary/30">
            <span>{s.totalCredits} cr</span>
            <span>{s.totalContact}h/wk</span>
          </div>
        )}
      </button>

      {open && (
        <div className="border-t border-primary/5">
          {semSubs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary/[0.02]">
                    {['Code','Subject','Cat','L','T','P','Credits','Hrs/Wk',''].map(h => (
                      <th key={h} className={`px-3 py-2 text-[10px] font-semibold text-primary/35 uppercase tracking-wide ${['L','T','P','Credits','Hrs/Wk'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {semSubs.map(sub => (
                    <SubjectRow key={sub.id} subject={sub} categories={categories}
                      onUpdate={async (id, fields) => { await updateBOSSubject(id, fields); onRefresh() }}
                      onDelete={async id => { if (confirm('Delete?')) { await deleteBOSSubject(id); onRefresh() } }} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adding ? (
            <div className="px-5 py-3 bg-primary/[0.015] border-t border-primary/5">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2"><label className="text-[10px] text-primary/35">Code</label><input value={f.subject_code} onChange={e => set('subject_code', e.target.value)} placeholder="CS301" className="w-full px-2 py-1.5 text-xs border border-primary/15 rounded" /></div>
                <div className="col-span-3"><label className="text-[10px] text-primary/35">Subject</label><input value={f.subject_name} onChange={e => set('subject_name', e.target.value)} placeholder="Data Structures" className="w-full px-2 py-1.5 text-xs border border-primary/15 rounded" /></div>
                <div className="col-span-2"><label className="text-[10px] text-primary/35">Category</label>
                  <select value={f.category_id} onChange={e => set('category_id', e.target.value)} className="w-full px-1 py-1.5 text-xs border border-primary/15 rounded">
                    <option value="">—</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                  </select>
                </div>
                <div><label className="text-[10px] text-primary/35">L</label><input type="number" min="0" value={f.lecture_hours} onChange={e => set('lecture_hours', e.target.value)} className="w-full px-1 py-1.5 text-xs border border-primary/15 rounded text-center" /></div>
                <div><label className="text-[10px] text-primary/35">T</label><input type="number" min="0" value={f.tutorial_hours} onChange={e => set('tutorial_hours', e.target.value)} className="w-full px-1 py-1.5 text-xs border border-primary/15 rounded text-center" /></div>
                <div><label className="text-[10px] text-primary/35">P</label><input type="number" min="0" value={f.practical_hours} onChange={e => set('practical_hours', e.target.value)} className="w-full px-1 py-1.5 text-xs border border-primary/15 rounded text-center" /></div>
                <div className="col-span-2 flex gap-1">
                  <button onClick={add} className="px-3 py-1.5 bg-primary text-white rounded text-xs font-medium">Add</button>
                  <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-primary/40 text-xs">Cancel</button>
                </div>
              </div>
              <p className="mt-1 text-[10px] text-primary/25">{preview.total} credits · {preview.hours}h/week</p>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="w-full px-5 py-2.5 text-xs text-primary/25 hover:text-dark-ambient hover:bg-ambient/5 flex items-center gap-1.5 border-t border-primary/5 transition-colors">
              <Plus size={12} /> Add subject
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ==================== DETAIL VIEW ====================

function BOSDetail({ bosId, onBack, onImport }) {
  const [bos, setBos] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [categories, setCategories] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAssign, setShowAssign] = useState(false)

  const load = async () => {
    const [b, s, c, a] = await Promise.all([loadBOS(bosId), loadBOSSubjects(bosId), loadCategories(), loadBOSAssignments(bosId)])
    setBos(b); setSubjects(s); setCategories(c); setAssignments(a); setLoading(false)
  }
  useEffect(() => { load() }, [bosId])

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" /></div>
  if (!bos) return <p className="text-primary/40 text-center py-20">BOS not found</p>

  const totals = subjects.reduce((acc, s) => ({
    credits: acc.credits + (s.total_credits || 0),
    hours: acc.hours + (s.lecture_hours || 0) + (s.tutorial_hours || 0) + (s.practical_hours || 0),
    theory: acc.theory + (s.theory_credits || 0),
    practical: acc.practical + (s.practical_credits || 0),
  }), { credits: 0, hours: 0, theory: 0, practical: 0 })

  const activeSemesters = [...new Set(subjects.map(s => s.semester))].length
  const avgHours = activeSemesters > 0 ? Math.round(totals.hours / activeSemesters) : 0

  // Which semesters are "current" across all assignments
  const highlightSemesters = new Set(assignments.map(a => a.current_semester))

  // Category breakdown
  const catBreakdown = {}
  subjects.forEach(s => {
    const code = s.bos_subject_categories?.code || 'Other'
    if (!catBreakdown[code]) catBreakdown[code] = { code, credits: 0, count: 0 }
    catBreakdown[code].credits += s.total_credits || 0
    catBreakdown[code].count++
  })

  const handleAssign = async (form) => {
    await createBOSAssignment(form)
    setShowAssign(false)
    load()
    toast.success('Assigned')
  }

  const handleSemChange = async (assignmentId, newSem) => {
    await updateBOSAssignment(assignmentId, { current_semester: parseInt(newSem) })
    load()
  }

  const handleRemoveAssignment = async (id) => {
    if (!confirm('Remove this batch assignment?')) return
    await deleteBOSAssignment(id)
    load()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-dark-ambient hover:underline mb-3">
          <ArrowLeft size={12} /> All BOS
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">{bos.name}</h2>
            <p className="text-sm text-primary/40">{bos.program} · {bos.total_semesters} semesters</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onImport} className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/15 text-primary/60 rounded-lg text-xs font-medium hover:bg-primary/5 transition-colors">
              <Upload size={13} /> Import more subjects
            </button>
            <select value={bos.status} onChange={async e => {
              await updateBOS(bosId, { status: e.target.value })
              load()
              toast.success(`Status changed to ${e.target.value}`)
            }} className={`text-[11px] font-semibold px-3 py-1.5 rounded-full uppercase cursor-pointer border-none outline-none ${STATUS_BADGE[bos.status]}`}>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assigned batches */}
      <div className="bg-white rounded-xl border border-primary/10 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            <Link2 size={14} className="text-ambient" /> Assigned Batches
          </h3>
          <button onClick={() => setShowAssign(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-dark-ambient hover:bg-ambient/10 rounded-lg transition-colors">
            <Plus size={13} /> Assign
          </button>
        </div>
        {assignments.length === 0 ? (
          <p className="text-xs text-primary/30 py-2">No batches assigned yet</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {assignments.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 bg-primary/[0.03] rounded-lg group">
                <div>
                  <span className="text-xs font-semibold text-primary">{a.campus_name} · {a.admission_year}</span>
                  <span className="text-[10px] text-primary/30 ml-2">Sem</span>
                  <select value={a.current_semester} onChange={e => handleSemChange(a.id, e.target.value)}
                    className="ml-1 text-[11px] font-semibold text-dark-ambient bg-transparent border-none outline-none cursor-pointer">
                    {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button onClick={() => handleRemoveAssignment(a.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-primary/15 hover:text-red-500 transition-opacity">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Semester overview table */}
      {subjects.length > 0 && (() => {
        const semStats = Array.from({ length: bos.total_semesters }, (_, i) => {
          const s = semesterSummary(subjects, i + 1)
          return { sem: i + 1, ...s }
        }).filter(s => s.count > 0)

        return (
          <div className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-primary/5">
              <h3 className="text-sm font-semibold text-primary">Semester Overview</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-primary/[0.02]">
                  <th className="px-5 py-2.5 text-left text-[10px] font-semibold text-primary/40 uppercase">Semester</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-primary/40 uppercase">Subjects</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-primary/40 uppercase">Theory Cr</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-primary/40 uppercase">Practical Cr</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-primary/40 uppercase">Total Credits</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-primary/40 uppercase">Hrs/Week</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-primary/40 uppercase">Hrs/Day</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-primary/40 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {semStats.map(s => {
                  const isActive = highlightSemesters.has(s.sem)
                  return (
                    <tr key={s.sem} className={isActive ? 'bg-ambient/5' : ''}>
                      <td className="px-5 py-3 text-sm font-medium text-primary">
                        Sem {s.sem}
                        {isActive && <span className="ml-2 text-[10px] bg-ambient/10 text-dark-ambient px-1.5 py-0.5 rounded">Active</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-primary/60">{s.count}</td>
                      <td className="px-4 py-3 text-sm text-center text-primary/60">{s.theoryCredits}</td>
                      <td className="px-4 py-3 text-sm text-center text-primary/60">{s.practicalCredits}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-primary">{s.totalCredits}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-dark-ambient">{s.totalContact}h</td>
                      <td className="px-4 py-3 text-sm text-center text-primary/50">{(s.totalContact / 5).toFixed(1)}h</td>
                      <td className="px-4 py-3 text-center">
                        {isActive ? (
                          <span className="text-[10px] bg-ambient/10 text-dark-ambient px-2 py-0.5 rounded-full font-medium">Running</span>
                        ) : s.sem < Math.min(...[...highlightSemesters]) ? (
                          <span className="text-[10px] text-primary/25">Completed</span>
                        ) : (
                          <span className="text-[10px] text-primary/20">Upcoming</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-primary/[0.03] border-t border-primary/10">
                  <td className="px-5 py-3 text-sm font-semibold text-primary">Total</td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-primary">{subjects.length}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-primary">{totals.theory}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-primary">{totals.practical}</td>
                  <td className="px-4 py-3 text-sm text-center font-bold text-primary">{totals.credits}</td>
                  <td className="px-4 py-3 text-sm text-center font-bold text-dark-ambient">{totals.hours}h</td>
                  <td className="px-4 py-3 text-sm text-center text-primary/50">{(totals.hours / semStats.length / 5).toFixed(1)}h</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      })()}

      {/* Semesters */}
      {Array.from({ length: bos.total_semesters }, (_, i) => i + 1).map(sem => (
        <SemesterBlock key={sem} sem={sem} subjects={subjects} categories={categories} bosId={bosId} onRefresh={load} highlightSemesters={highlightSemesters} />
      ))}

      {showAssign && <AssignModal bosId={bosId} existingAssignments={assignments} onSave={handleAssign} onCancel={() => setShowAssign(false)} />}
    </div>
  )
}

// ==================== MAIN ====================

export default function BOSPage() {
  const { bosId } = useParams()
  const navigate = useNavigate()
  const [bosList, setBosList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importTarget, setImportTarget] = useState(null) // null = new BOS, id = append to existing

  const load = async () => { setBosList(await loadBOSList()); setLoading(false) }
  useEffect(() => { load() }, [])

  const handleCreate = async form => {
    const bos = await createBOS(form)
    setShowCreate(false); await load()
    navigate(`/admin/academics/bos/${bos.id}`)
  }

  const handleDelete = async id => {
    if (!confirm('Delete this BOS and all subjects/assignments?')) return
    await deleteBOS(id)
    if (bosId === id) navigate('/admin/academics/bos')
    load()
  }

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" /></div>

  if (showImport) return <PDFImportFlow
    existingBosId={importTarget}
    onDone={id => { setShowImport(false); setImportTarget(null); load().then(() => navigate(`/admin/academics/bos/${id}`)) }}
    onCancel={() => { setShowImport(false); setImportTarget(null) }} />

  if (bosId) return <BOSDetail bosId={bosId} onBack={() => { navigate('/admin/academics/bos'); load() }}
    onImport={() => { setImportTarget(bosId); setShowImport(true) }} />

  return (
    <>
      <BOSList bosList={bosList} onSelect={id => navigate(`/admin/academics/bos/${id}`)}
        onNew={() => setShowCreate(true)} onDelete={handleDelete}
        onImport={() => { setImportTarget(null); setShowImport(true) }} />
      {showCreate && <CreateModal onSave={handleCreate} onCancel={() => setShowCreate(false)} />}
    </>
  )
}
