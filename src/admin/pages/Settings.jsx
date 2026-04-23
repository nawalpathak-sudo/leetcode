import { useState, useEffect } from 'react'
import { Plus, Trash2, Building2, GraduationCap, Check, X, Edit3 } from 'lucide-react'
import { loadCampuses, createCampus, updateCampus, deleteCampus, loadBatches, createBatch, deleteBatch } from '../../lib/masterDb'
import toast from 'react-hot-toast'

function CampusRow({ campus, onUpdate, onDelete, onSelect, selected }) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState(campus)

  const save = async () => {
    try {
      await onUpdate(campus.id, { name: f.name, code: f.code, city: f.city, active: f.active })
      setEditing(false)
      toast.success('Updated')
    } catch (err) { toast.error(err.message) }
  }

  if (editing) {
    return (
      <tr className="bg-ambient/5">
        <td className="px-4 py-2"><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-primary/15 rounded" /></td>
        <td className="px-4 py-2"><input value={f.code || ''} onChange={e => setF({ ...f, code: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-primary/15 rounded" /></td>
        <td className="px-4 py-2"><input value={f.city || ''} onChange={e => setF({ ...f, city: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-primary/15 rounded" /></td>
        <td className="px-4 py-2 text-center">
          <input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />
        </td>
        <td className="px-4 py-2">
          <div className="flex gap-1">
            <button onClick={save} className="p-1 text-dark-ambient hover:bg-ambient/10 rounded"><Check size={14} /></button>
            <button onClick={() => setEditing(false)} className="p-1 text-primary/30 hover:text-primary rounded"><X size={14} /></button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr onClick={() => onSelect(campus.id)}
      className={`group cursor-pointer transition-colors ${selected ? 'bg-ambient/5' : 'hover:bg-primary/[0.02]'}`}>
      <td className="px-4 py-3 text-sm font-medium text-primary">{campus.name}</td>
      <td className="px-4 py-3 text-sm text-primary/50 font-mono">{campus.code}</td>
      <td className="px-4 py-3 text-sm text-primary/40">{campus.city || '—'}</td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-block w-2 h-2 rounded-full ${campus.active ? 'bg-dark-ambient' : 'bg-primary/20'}`} />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); setF(campus); setEditing(true) }} className="p-1 text-primary/25 hover:text-primary rounded"><Edit3 size={13} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(campus.id) }} className="p-1 text-primary/15 hover:text-red-500 rounded"><Trash2 size={13} /></button>
        </div>
      </td>
    </tr>
  )
}

export default function Settings() {
  const [campuses, setCampuses] = useState([])
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCampus, setSelectedCampus] = useState(null)
  const [newCampus, setNewCampus] = useState({ name: '', code: '', city: '' })
  const [addingCampus, setAddingCampus] = useState(false)
  const [newBatch, setNewBatch] = useState({ admission_year: new Date().getFullYear(), program: 'B.Tech' })
  const [addingBatch, setAddingBatch] = useState(false)

  const load = async () => {
    const c = await loadCampuses(false)
    setCampuses(c)
    if (selectedCampus) {
      const b = await loadBatches(selectedCampus, false)
      setBatches(b)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (selectedCampus) {
      loadBatches(selectedCampus, false).then(setBatches)
    } else {
      setBatches([])
    }
  }, [selectedCampus])

  const handleAddCampus = async () => {
    if (!newCampus.name) return toast.error('Name required')
    try {
      const c = await createCampus(newCampus)
      setNewCampus({ name: '', code: '', city: '' })
      setAddingCampus(false)
      await load()
      setSelectedCampus(c.id)
    } catch (err) { toast.error(err.message?.includes('duplicate') ? 'Campus already exists' : err.message) }
  }

  const handleDeleteCampus = async (id) => {
    if (!confirm('Delete this campus and all its batches?')) return
    try {
      await deleteCampus(id)
      if (selectedCampus === id) setSelectedCampus(null)
      load()
    } catch (err) { toast.error(err.message) }
  }

  const handleAddBatch = async () => {
    if (!selectedCampus || !newBatch.admission_year) return
    try {
      await createBatch({ campus_id: selectedCampus, ...newBatch })
      setNewBatch({ admission_year: new Date().getFullYear(), program: 'B.Tech' })
      setAddingBatch(false)
      loadBatches(selectedCampus, false).then(setBatches)
    } catch (err) { toast.error(err.message?.includes('duplicate') ? 'Batch already exists for this campus' : err.message) }
  }

  const handleDeleteBatch = async (id) => {
    if (!confirm('Delete this batch?')) return
    try {
      await deleteBatch(id)
      loadBatches(selectedCampus, false).then(setBatches)
    } catch (err) { toast.error(err.message) }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" /></div>

  const selectedCampusName = campuses.find(c => c.id === selectedCampus)?.name

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">Master Data</h2>
        <p className="text-sm text-primary/40 mt-0.5">Manage campuses and batches — used across all modules</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campuses */}
        <div className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2"><Building2 size={15} className="text-ambient" /> Campuses</h3>
            <button onClick={() => setAddingCampus(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-dark-ambient hover:bg-ambient/10 rounded-lg transition-colors">
              <Plus size={13} /> Add
            </button>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-primary/[0.02]">
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-primary/35 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-primary/35 uppercase">Code</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold text-primary/35 uppercase">City</th>
                <th className="px-4 py-2 text-center text-[10px] font-semibold text-primary/35 uppercase w-14">Active</th>
                <th className="px-4 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {campuses.map(c => (
                <CampusRow key={c.id} campus={c} selected={selectedCampus === c.id}
                  onSelect={setSelectedCampus} onUpdate={async (id, f) => { await updateCampus(id, f); load() }}
                  onDelete={handleDeleteCampus} />
              ))}
              {addingCampus && (
                <tr className="bg-ambient/5">
                  <td className="px-4 py-2"><input value={newCampus.name} onChange={e => setNewCampus({ ...newCampus, name: e.target.value })} placeholder="Campus name" className="w-full px-2 py-1.5 text-sm border border-primary/15 rounded" autoFocus /></td>
                  <td className="px-4 py-2"><input value={newCampus.code} onChange={e => setNewCampus({ ...newCampus, code: e.target.value })} placeholder="Code" className="w-full px-2 py-1.5 text-sm border border-primary/15 rounded" /></td>
                  <td className="px-4 py-2"><input value={newCampus.city} onChange={e => setNewCampus({ ...newCampus, city: e.target.value })} placeholder="City" className="w-full px-2 py-1.5 text-sm border border-primary/15 rounded" /></td>
                  <td></td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={handleAddCampus} className="p-1 text-dark-ambient hover:bg-ambient/10 rounded"><Check size={14} /></button>
                      <button onClick={() => setAddingCampus(false)} className="p-1 text-primary/30 hover:text-primary rounded"><X size={14} /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {campuses.length === 0 && !addingCampus && (
            <p className="px-5 py-8 text-sm text-primary/30 text-center">No campuses yet</p>
          )}
        </div>

        {/* Batches for selected campus */}
        <div className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-primary/5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <GraduationCap size={15} className="text-ambient" />
              Batches {selectedCampusName && <span className="font-normal text-primary/40">— {selectedCampusName}</span>}
            </h3>
            {selectedCampus && (
              <button onClick={() => setAddingBatch(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-dark-ambient hover:bg-ambient/10 rounded-lg transition-colors">
                <Plus size={13} /> Add
              </button>
            )}
          </div>

          {!selectedCampus ? (
            <p className="px-5 py-12 text-sm text-primary/25 text-center">Select a campus to see batches</p>
          ) : (
            <>
              <div className="divide-y divide-primary/5">
                {batches.map(b => (
                  <div key={b.id} className="px-5 py-3 flex items-center justify-between group hover:bg-primary/[0.02]">
                    <div>
                      <span className="text-sm font-medium text-primary">Batch {b.admission_year}</span>
                      <span className="text-xs text-primary/30 ml-2">{b.program}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-block w-2 h-2 rounded-full ${b.active ? 'bg-dark-ambient' : 'bg-primary/20'}`} />
                      <button onClick={() => handleDeleteBatch(b.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-primary/15 hover:text-red-500 rounded transition-opacity">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {addingBatch && (
                  <div className="px-5 py-3 bg-ambient/5 flex items-center gap-3">
                    <input type="number" value={newBatch.admission_year} onChange={e => setNewBatch({ ...newBatch, admission_year: e.target.value })}
                      className="w-24 px-2 py-1.5 text-sm border border-primary/15 rounded" />
                    <input value={newBatch.program} onChange={e => setNewBatch({ ...newBatch, program: e.target.value })}
                      className="w-28 px-2 py-1.5 text-sm border border-primary/15 rounded" />
                    <button onClick={handleAddBatch} className="p-1 text-dark-ambient hover:bg-ambient/10 rounded"><Check size={14} /></button>
                    <button onClick={() => setAddingBatch(false)} className="p-1 text-primary/30 hover:text-primary rounded"><X size={14} /></button>
                  </div>
                )}
              </div>
              {batches.length === 0 && !addingBatch && (
                <p className="px-5 py-8 text-sm text-primary/30 text-center">No batches for this campus</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
