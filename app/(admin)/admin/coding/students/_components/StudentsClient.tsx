'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Upload, Trash2, UserMinus, RefreshCw, Users, Link2, Mail, ClipboardList,
  ExternalLink, ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const PAGE_SIZE = 25

interface Platform {
  slug: string
  display_name: string
}

// --- API functions ---
async function fetchLeetCodeData(username: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ username }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.matchedUser ? json.data : null
  } catch { return null }
}

async function fetchCodeforcesData(username: string) {
  try {
    const userRes = await fetch(`https://codeforces.com/api/user.info?handles=${username}`)
    if (!userRes.ok) return null
    const userData = await userRes.json()
    if (userData.status !== 'OK') return null
    const ratingRes = await fetch(`https://codeforces.com/api/user.rating?handle=${username}`)
    let ratingHistory: any[] = []
    if (ratingRes.ok) { const d = await ratingRes.json(); if (d.status === 'OK') ratingHistory = d.result || [] }
    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${username}`)
    let submissions: any[] = []
    if (statusRes.ok) { const d = await statusRes.json(); if (d.status === 'OK') submissions = d.result || [] }
    return { user: userData.result[0], ratingHistory, submissions }
  } catch { return null }
}

async function fetchGitHubData(username: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ githubFull: username }),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.user ? json : null
  } catch { return null }
}

function getFetcher(platform: string) {
  if (platform === 'leetcode') return fetchLeetCodeData
  if (platform === 'codeforces') return fetchCodeforcesData
  if (platform === 'github') return fetchGitHubData
  return null
}

function sanitizeUsername(raw: string) {
  if (!raw) return null
  let u = raw.trim()
  if (u.includes('leetcode.com') || u.includes('codeforces.com')) {
    const parts = u.replace(/\/+$/, '').split('/')
    u = parts[parts.length - 1] || ''
  }
  u = u.replace(/^https?:\/\/.*/, '')
  if (!u || !/^[\w.\-]+$/.test(u)) return null
  return u
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// --- Components ---
function Spinner() {
  return (
    <div className="text-center py-8">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-ambient)', borderRightColor: 'transparent' }} />
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 text-sm"
      style={{
        background: active ? 'var(--color-primary)' : 'rgba(13,30,86,0.03)',
        color: active ? 'var(--color-white)' : 'var(--color-text-secondary)',
        border: active ? 'none' : '1px solid var(--color-border)',
      }}>
      {icon} {label}
    </button>
  )
}

// --- Student Import Tab ---
function StudentImport({ platforms, totalStudents: initialTotal }: { platforms: Platform[]; totalStudents: number }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [csvData, setCsvData] = useState<any[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState('')
  const [students, setStudents] = useState<any[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [profileMap, setProfileMap] = useState<Record<string, Record<string, string>>>({})
  const [collegeFilter, setCollegeFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(initialTotal)
  const [editingCell, setEditingCell] = useState<{ lead_id: string; platform: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingCell, setSavingCell] = useState(false)
  const [editingDetail, setEditingDetail] = useState<{ lead_id: string; field: string } | null>(null)
  const [detailValue, setDetailValue] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ lead_id: '', student_name: '', email: '', college: '', batch: '' })
  const [addSaving, setAddSaving] = useState(false)
  const [addResult, setAddResult] = useState('')

  const loadPage = useCallback(async () => {
    setLoadingStudents(true)
    const supabase = createClient()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase.from('students').select('lead_id, student_name, email, phone, college, batch', { count: 'exact' })
    if (collegeFilter !== 'all') query = query.eq('college', collegeFilter)
    if (batchFilter !== 'all') query = query.eq('batch', batchFilter)
    if (searchQuery) query = query.or(`student_name.ilike.%${searchQuery}%,lead_id.ilike.%${searchQuery}%`)

    const { data, count, error } = await query.order('student_name').range(from, to)
    if (!error) {
      setStudents(data || [])
      setTotalCount(count || 0)
    }

    // Load profile map for current page students
    if (data && data.length > 0) {
      const leadIds = data.map(s => s.lead_id)
      const { data: profiles } = await supabase
        .from('coding_profiles')
        .select('lead_id, platform, username')
        .in('lead_id', leadIds)
      const map: Record<string, Record<string, string>> = {}
      for (const row of (profiles || [])) {
        if (!map[row.lead_id]) map[row.lead_id] = {}
        map[row.lead_id][row.platform] = row.username
      }
      setProfileMap(map)
    }
    setLoadingStudents(false)
  }, [page, collegeFilter, batchFilter, searchQuery])

  useEffect(() => { loadPage() }, [loadPage])

  const colleges = ['all'] // We'll need a separate query for distinct values
  const batches = ['all']

  // Fetch distinct colleges and batches
  const [allColleges, setAllColleges] = useState<string[]>([])
  const [allBatches, setAllBatches] = useState<string[]>([])
  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: cData } = await supabase.from('students').select('college').not('college', 'is', null).limit(1000)
      const { data: bData } = await supabase.from('students').select('batch').not('batch', 'is', null).limit(1000)
      setAllColleges([...new Set((cData || []).map((r: any) => r.college).filter(Boolean))].sort())
      setAllBatches([...new Set((bData || []).map((r: any) => r.batch).filter(Boolean))].sort())
    })()
  }, [])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    import('papaparse').then(Papa => {
      Papa.default.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res: any) => {
          const cols = res.meta.fields.map((f: string) => f.trim().toLowerCase())
          if (!cols.includes('lead_id')) { alert('CSV must have a lead_id column'); return }
          const rows = res.data.map((r: any) => {
            const n: any = {}
            for (const [k, v] of Object.entries(r)) n[k.toString().trim().toLowerCase()] = ((v as string) || '').trim()
            return { lead_id: n.lead_id, student_name: n.student_name || n.name || '', email: n.email || '', college: n.college || '', batch: n.batch || '' }
          }).filter((r: any) => r.lead_id)
          setCsvData(rows)
        },
      })
    })
  }

  const handleSave = async () => {
    if (!csvData?.length) return
    setSaving(true)
    setResult('')
    const supabase = createClient()
    const { error } = await supabase.from('students').upsert(csvData, { onConflict: 'lead_id' })
    setResult(error ? 'Error saving students.' : `Saved ${csvData.length} students successfully.`)
    if (!error) { setCsvData(null); if (fileRef.current) fileRef.current.value = ''; loadPage() }
    setSaving(false)
  }

  const handleAddStudent = async () => {
    if (!addForm.lead_id.trim()) { setAddResult('Lead ID is required.'); return }
    setAddSaving(true)
    setAddResult('')
    const supabase = createClient()
    const { error } = await supabase.from('students').upsert([{
      lead_id: addForm.lead_id.trim(), student_name: addForm.student_name.trim(),
      email: addForm.email.trim(), college: addForm.college.trim(), batch: addForm.batch.trim(),
    }], { onConflict: 'lead_id' })
    if (!error) {
      setAddResult('Student added successfully.')
      setAddForm({ lead_id: '', student_name: '', email: '', college: '', batch: '' })
      loadPage()
    } else { setAddResult('Error adding student.') }
    setAddSaving(false)
  }

  const handleStartEdit = (lead_id: string, platform: string) => {
    setEditingCell({ lead_id, platform })
    setEditValue(profileMap[lead_id]?.[platform] || '')
  }

  const handleSaveId = async () => {
    if (!editingCell) return
    const { lead_id, platform } = editingCell
    const username = sanitizeUsername(editValue.trim())
    if (!username) { setEditingCell(null); setEditValue(''); return }
    setSavingCell(true)
    const supabase = createClient()
    const { error } = await supabase.from('coding_profiles').upsert({
      lead_id, platform, username, score: 0, stats: {}, fetched_at: null,
    }, { onConflict: 'lead_id,platform' })
    if (!error) {
      setProfileMap(prev => ({ ...prev, [lead_id]: { ...(prev[lead_id] || {}), [platform]: username } }))
    }
    setSavingCell(false)
    setEditingCell(null)
    setEditValue('')
  }

  const handleStartDetailEdit = (lead_id: string, field: string, currentValue: string) => {
    setEditingDetail({ lead_id, field })
    setDetailValue(currentValue || '')
  }

  const handleSaveDetail = async () => {
    if (!editingDetail) return
    const { lead_id, field } = editingDetail
    const val = detailValue.trim()
    setSavingDetail(true)
    const supabase = createClient()
    const { error } = await supabase.from('students').update({ [field]: val }).eq('lead_id', lead_id)
    if (!error) {
      setStudents(prev => prev.map(s => s.lead_id === lead_id ? { ...s, [field]: val } : s))
    }
    setSavingDetail(false)
    setEditingDetail(null)
    setDetailValue('')
  }

  return (
    <div className="space-y-6">
      {/* Add Individual Student */}
      <div className="rounded-xl p-6 space-y-4 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg" style={{ color: 'var(--color-primary)' }}>Add Individual Student</h3>
          <button onClick={() => { setShowAddForm(!showAddForm); setAddResult('') }}
            className="px-4 py-2 text-white rounded-lg font-medium text-sm transition-colors"
            style={{ background: 'var(--color-ambient)' }}>
            {showAddForm ? 'Cancel' : '+ Add Student'}
          </button>
        </div>
        {showAddForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {['lead_id', 'student_name', 'email', 'college', 'batch'].map(field => (
                <input key={field} placeholder={field === 'lead_id' ? 'Lead ID *' : field.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  value={(addForm as any)[field]} onChange={e => setAddForm(f => ({ ...f, [field]: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }} />
              ))}
            </div>
            {addResult && (
              <div className={`px-4 py-3 rounded-lg text-sm ${addResult.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                {addResult}
              </div>
            )}
            <button onClick={handleAddStudent} disabled={addSaving}
              className="px-6 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}>
              {addSaving ? 'Adding...' : 'Add Student'}
            </button>
          </div>
        )}
      </div>

      {/* CSV Upload */}
      <div className="rounded-xl p-6 space-y-4 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h3 className="font-semibold text-lg" style={{ color: 'var(--color-primary)' }}>Upload Students CSV</h3>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          CSV columns: <strong>lead_id</strong> (required), student_name, email, college, batch (all optional)
        </p>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile}
          className="block text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-white file:font-medium file:cursor-pointer"
          style={{ color: 'var(--color-text-secondary)' }} />

        {csvData && (
          <>
            <p className="font-medium" style={{ color: 'var(--color-dark-ambient)' }}>{csvData.length} students found</p>
            <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: 'rgba(13,30,86,0.03)' }}>
                  <tr style={{ color: 'var(--color-text-secondary)' }}>
                    <th className="py-2 px-3 text-left font-medium">Lead ID</th>
                    <th className="py-2 px-3 text-left font-medium">Name</th>
                    <th className="py-2 px-3 text-left font-medium">Email</th>
                    <th className="py-2 px-3 text-left font-medium">College</th>
                    <th className="py-2 px-3 text-left font-medium">Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
                      <td className="py-1.5 px-3" style={{ color: 'var(--color-dark-ambient)' }}>{r.lead_id}</td>
                      <td className="py-1.5 px-3">{r.student_name}</td>
                      <td className="py-1.5 px-3">{r.email}</td>
                      <td className="py-1.5 px-3">{r.college}</td>
                      <td className="py-1.5 px-3">{r.batch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvData.length > 20 && <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Showing first 20 of {csvData.length}</p>}

            {result && (
              <div className={`px-4 py-3 rounded-lg text-sm ${result.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                {result}
              </div>
            )}

            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}>
              {saving ? 'Saving...' : 'Save Students'}
            </button>
          </>
        )}
      </div>

      {/* Students Table */}
      {loadingStudents ? <Spinner /> : (
        <div className="rounded-xl p-6 border shadow-sm space-y-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-primary)' }}>
              {totalCount} Students in Database
            </h3>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Page {page + 1} of {totalPages || 1}
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <input type="text" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0) }}
              placeholder="Search name or ID..."
              className="border rounded-lg px-3 py-2 text-sm w-52 focus:outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }} />
            <select value={collegeFilter} onChange={e => { setCollegeFilter(e.target.value); setPage(0) }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
              <option value="all">All Campuses</option>
              {allColleges.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={batchFilter} onChange={e => { setBatchFilter(e.target.value); setPage(0) }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
              <option value="all">All Years</option>
              {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {(collegeFilter !== 'all' || batchFilter !== 'all' || searchQuery) && (
              <button onClick={() => { setCollegeFilter('all'); setBatchFilter('all'); setSearchQuery(''); setPage(0) }}
                className="text-xs hover:underline" style={{ color: 'var(--color-dark-ambient)' }}>Clear filters</button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10" style={{ background: '#f3f4f8' }}>
                <tr style={{ color: 'var(--color-text-secondary)' }}>
                  <th className="py-2.5 px-3 text-left font-medium">Name</th>
                  <th className="py-2.5 px-3 text-left font-medium">Email</th>
                  <th className="py-2.5 px-3 text-left font-medium">Phone</th>
                  <th className="py-2.5 px-3 text-left font-medium">College</th>
                  <th className="py-2.5 px-3 text-left font-medium">Batch</th>
                  {platforms.map(p => (
                    <th key={p.slug} className="py-2.5 px-3 text-left font-medium">{p.display_name} ID</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.lead_id} className="border-t hover:bg-[rgba(59,195,226,0.03)]" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
                    <td className="py-2 px-3">
                      <div className="font-medium" style={{ color: 'var(--color-primary)' }}>{s.student_name || '\u2014'}</div>
                      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.lead_id}</div>
                    </td>
                    {['email', 'phone'].map(field => {
                      const isEditingThis = editingDetail?.lead_id === s.lead_id && editingDetail?.field === field
                      const val = s[field]
                      return (
                        <td key={field} className="py-2 px-3">
                          {isEditingThis ? (
                            <input autoFocus value={detailValue}
                              onChange={e => setDetailValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveDetail(); if (e.key === 'Escape') { setEditingDetail(null); setDetailValue('') } }}
                              onBlur={handleSaveDetail}
                              disabled={savingDetail}
                              className="border rounded px-2 py-1 text-sm w-40 focus:outline-none"
                              style={{ borderColor: 'var(--color-ambient)', color: 'var(--color-primary)' }} />
                          ) : (
                            <button onClick={() => handleStartDetailEdit(s.lead_id, field, val)}
                              className="text-left text-sm"
                              style={{ color: val ? 'var(--color-text-secondary)' : 'rgba(13,30,86,0.2)' }}>
                              {val || '+ Add'}
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>{s.college}</td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>{s.batch}</td>
                    {platforms.map(p => {
                      const isEditing = editingCell?.lead_id === s.lead_id && editingCell?.platform === p.slug
                      const linked = profileMap[s.lead_id]?.[p.slug]
                      return (
                        <td key={p.slug} className="py-2 px-3">
                          {isEditing ? (
                            <input autoFocus value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSaveId(); if (e.key === 'Escape') { setEditingCell(null); setEditValue('') } }}
                              onBlur={handleSaveId}
                              disabled={savingCell}
                              className="border rounded px-2 py-1 text-sm w-32 focus:outline-none"
                              style={{ borderColor: 'var(--color-ambient)', color: 'var(--color-primary)' }}
                              placeholder={`${p.display_name} username`} />
                          ) : linked ? (
                            <button onClick={() => handleStartEdit(s.lead_id, p.slug)}
                              className="font-medium hover:underline cursor-pointer text-left"
                              style={{ color: 'var(--color-dark-ambient)' }}>
                              {linked}
                            </button>
                          ) : (
                            <button onClick={() => handleStartEdit(s.lead_id, p.slug)}
                              className="cursor-pointer text-sm"
                              style={{ color: 'rgba(13,30,86,0.2)' }}>
                              + Add
                            </button>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-30 transition-colors"
              style={{ color: 'var(--color-primary)', background: 'rgba(13,30,86,0.03)' }}>
              <ChevronLeft size={16} /> Previous
            </button>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-30 transition-colors"
              style={{ color: 'var(--color-primary)', background: 'rgba(13,30,86,0.03)' }}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Link & Fetch Tab ---
function LinkAndFetch({ platforms }: { platforms: Platform[] }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'csv' | 'manual'>('csv')
  const [manualPlatform, setManualPlatform] = useState(platforms[0]?.slug || '')
  const [text, setText] = useState('')
  const [csvData, setCsvData] = useState<any[] | null>(null)
  const [detectedPlatforms, setDetectedPlatforms] = useState<string[]>([])
  const [fetching, setFetching] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' })
  const [results, setResults] = useState<any>(null)

  const platformSlugs = platforms.map(p => p.slug)
  const platformNames = Object.fromEntries(platforms.map(p => [p.slug, p.display_name]))

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    import('papaparse').then(Papa => {
      Papa.default.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res: any) => {
          const cols = res.meta.fields.map((f: string) => f.trim().toLowerCase())
          if (!cols.includes('lead_id')) { alert('CSV must have a lead_id column'); return }
          const detected = platformSlugs.filter(s => cols.includes(s))
          if (detected.length === 0) { alert(`CSV must have at least one platform column: ${platformSlugs.join(', ')}`); return }
          setDetectedPlatforms(detected)
          const rows = res.data.map((r: any) => {
            const n: any = {}
            for (const [k, v] of Object.entries(r)) n[k.toString().trim().toLowerCase()] = ((v as string) || '').trim()
            return n
          }).filter((r: any) => r.lead_id)
          setCsvData(rows)
        },
      })
    })
  }

  const buildEntries = () => {
    const entries: { lead_id: string; platform: string; username: string }[] = []
    const invalid: string[] = []
    if (mode === 'manual') {
      for (const line of text.split('\n')) {
        const parts = line.split(',').map(s => s.trim())
        if (!parts[0] || !parts[1]) continue
        const clean = sanitizeUsername(parts[1])
        if (clean) entries.push({ lead_id: parts[0], platform: manualPlatform, username: clean })
        else invalid.push(parts[1])
      }
    } else {
      for (const row of (csvData || [])) {
        for (const plat of detectedPlatforms) {
          if (!row[plat]) continue
          const clean = sanitizeUsername(row[plat])
          if (clean) entries.push({ lead_id: row.lead_id, platform: plat, username: clean })
          else invalid.push(row[plat])
        }
      }
    }
    return { entries, invalid }
  }

  const handleLinkOnly = async () => {
    const { entries, invalid } = buildEntries()
    if (!entries.length) return
    setFetching(true)
    setResults(null)
    const supabase = createClient()
    let success = 0
    const failed: string[] = []
    for (let i = 0; i < entries.length; i++) {
      const { lead_id, platform, username } = entries[i]
      setProgress({ current: i + 1, total: entries.length, name: `${username} (${platformNames[platform] || platform})` })
      const { error } = await supabase.from('coding_profiles').upsert({ lead_id, platform, username, score: 0, stats: {}, fetched_at: null }, { onConflict: 'lead_id,platform' })
      if (!error) success++
      else failed.push(`${username} (link failed)`)
    }
    setResults({ success, total: entries.length, failed, invalid: invalid.length, linkOnly: true })
    setFetching(false)
  }

  const runLinkAndFetch = async (limit?: number) => {
    const { entries: allEntries, invalid } = buildEntries()
    if (!allEntries.length) return
    const entries = limit ? allEntries.slice(0, limit) : allEntries
    setFetching(true)
    setResults(null)
    const supabase = createClient()
    let success = 0
    const failed: string[] = []

    for (let i = 0; i < entries.length; i++) {
      const { lead_id, platform, username } = entries[i]
      setProgress({ current: i + 1, total: entries.length, name: `${username} (${platformNames[platform] || platform})` })
      const { error } = await supabase.from('coding_profiles').upsert({ lead_id, platform, username, score: 0, stats: {}, fetched_at: null }, { onConflict: 'lead_id,platform' })
      if (error) { failed.push(`${username} (link failed)`); if (i < entries.length - 1) await sleep(500); continue }
      const fetcher = getFetcher(platform)
      if (fetcher) {
        const data = await fetcher(username)
        if (data) {
          // Save profile data (simplified - just save raw)
          await supabase.from('coding_profiles').update({ raw_json: data, fetched_at: new Date().toISOString() }).eq('lead_id', lead_id).eq('platform', platform)
          success++
        } else { failed.push(`${username} (API fetch failed)`) }
      } else { success++ }
      if (i < entries.length - 1) await sleep(2000)
    }

    const remaining = limit ? Math.max(0, allEntries.length - limit) : 0
    setResults({ success, total: entries.length, failed, invalid: invalid.length, remaining })
    setFetching(false)
  }

  return (
    <div className="rounded-xl p-6 space-y-4 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h3 className="font-semibold text-lg" style={{ color: 'var(--color-primary)' }}>Link Coding Profiles</h3>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Link student lead IDs to their platform usernames, then fetch API data.</p>

      <div className="flex gap-2">
        {(['csv', 'manual'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: mode === m ? 'var(--color-primary)' : 'rgba(13,30,86,0.03)',
              color: mode === m ? 'var(--color-white)' : 'var(--color-text-secondary)',
              border: mode === m ? 'none' : '1px solid var(--color-border)',
            }}>
            {m === 'csv' ? 'Upload CSV' : 'Manual Entry'}
          </button>
        ))}
      </div>

      {mode === 'csv' ? (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>CSV must have a <strong>lead_id</strong> column, plus a column for each platform username.</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile}
            className="block text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-white file:font-medium file:cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }} />
          {csvData && (
            <>
              <p className="font-medium" style={{ color: 'var(--color-dark-ambient)' }}>{csvData.length} students</p>
              <div className="flex gap-1.5">
                {detectedPlatforms.map(p => (
                  <span key={p} className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: 'rgba(59,195,226,0.15)', color: 'var(--color-dark-ambient)' }}>
                    {platformNames[p] || p}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Platform</label>
            <select value={manualPlatform} onChange={e => setManualPlatform(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
              {platforms.map(p => <option key={p.slug} value={p.slug}>{p.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>One per line: lead_id,username</label>
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder={"LEAD001,john_doe\nLEAD002,jane_smith"} rows={6}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono resize-y focus:outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }} />
          </div>
        </div>
      )}

      {/* Progress */}
      {fetching && (
        <div>
          <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            <span>Fetching {progress.name}...</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'rgba(13,30,86,0.1)' }}>
            <div className="h-2 rounded-full transition-all" style={{ background: 'var(--color-ambient)', width: `${(progress.current / progress.total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className={`px-4 py-3 rounded-lg text-sm ${results.failed?.length ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
          {results.linkOnly ? 'Linked' : 'Fetched'} {results.success}/{results.total} profiles.
          {results.remaining > 0 && <> ({results.remaining} remaining)</>}
          {results.invalid > 0 && <> Rejected {results.invalid} invalid usernames.</>}
          {results.failed?.length > 0 && <> Failed: {results.failed.join(', ')}</>}
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <button onClick={handleLinkOnly} disabled={fetching}
          className="px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-40"
          style={{ background: 'var(--color-ambient)', color: 'var(--color-primary)' }}>
          {fetching ? 'Linking...' : 'Link Only'}
        </button>
        <button onClick={() => runLinkAndFetch(10)} disabled={fetching}
          className="px-6 py-2.5 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg font-medium transition-colors">
          {fetching ? 'Testing...' : 'Test (10 only)'}
        </button>
        <button onClick={() => runLinkAndFetch()} disabled={fetching}
          className="px-6 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-40"
          style={{ background: 'var(--color-primary)' }}>
          {fetching ? 'Fetching...' : 'Link & Fetch All'}
        </button>
      </div>
    </div>
  )
}

// --- Manage Data Tab ---
function ManageData({ platforms }: { platforms: Platform[] }) {
  const [platform, setPlatform] = useState(platforms[0]?.slug || '')
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [delUser, setDelUser] = useState('')
  const [sortKey, setSortKey] = useState('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const current = platforms.find(p => p.slug === platform)

  const reload = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('coding_profiles')
      .select('lead_id, platform, username, score, stats, fetched_at, students(student_name, college, batch, email)')
      .eq('platform', platform)
      .order('score', { ascending: false })
    setProfiles((data || []).map((row: any) => ({
      lead_id: row.lead_id, platform: row.platform, username: row.username, score: row.score,
      fetched_at: row.fetched_at, student_name: row.students?.student_name || '',
      college: row.students?.college || '', batch: row.students?.batch || '',
      ...(row.stats || {}),
    })))
    setLoading(false)
  }, [platform])

  useEffect(() => { reload() }, [reload])

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...profiles].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  const handleDelete = async () => {
    if (!delUser.trim()) return
    const match = profiles.find(p => p.username.toLowerCase() === delUser.trim().toLowerCase())
    if (!match) { alert('Username not found'); return }
    const supabase = createClient()
    await supabase.from('coding_profiles').delete().eq('lead_id', match.lead_id).eq('platform', platform)
    setDelUser('')
    reload()
  }

  const isLC = platform === 'leetcode'

  return (
    <div className="space-y-4">
      <select value={platform} onChange={e => setPlatform(e.target.value)}
        className="border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
        {platforms.map(p => <option key={p.slug} value={p.slug}>{p.display_name}</option>)}
      </select>

      {loading ? <Spinner /> : profiles.length === 0 ? (
        <div className="px-4 py-3 rounded-lg" style={{ background: 'rgba(59,195,226,0.1)', border: '1px solid rgba(59,195,226,0.3)', color: 'var(--color-primary)' }}>
          No {current?.display_name || platform} profiles in database yet.
        </div>
      ) : (
        <>
          <p className="font-medium flex items-center gap-2" style={{ color: 'var(--color-dark-ambient)' }}>
            <Users size={18} /> {profiles.length} profile(s) in database
          </p>

          <div className="overflow-x-auto border rounded-lg shadow-sm" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead style={{ background: 'rgba(13,30,86,0.03)' }}>
                <tr>
                  {[
                    { label: 'Name', field: 'student_name' },
                    { label: 'Username', field: 'username' },
                    { label: 'College', field: 'college' },
                    { label: 'Batch', field: 'batch' },
                    { label: isLC ? 'Total Solved' : 'Problems', field: isLC ? 'total_solved' : 'problems_solved', align: 'right' },
                    { label: 'Score', field: 'score', align: 'right' },
                    { label: 'Fetched', field: 'fetched_at' },
                  ].map(col => (
                    <th key={col.field}
                      className={`py-2.5 px-3 font-medium cursor-pointer select-none transition-colors ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                      style={{ color: sortKey === col.field ? 'var(--color-dark-ambient)' : 'var(--color-text-secondary)' }}
                      onClick={() => toggleSort(col.field)}>
                      {col.label}
                      {sortKey === col.field && <span className="ml-1 text-xs">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={`${p.lead_id}-${p.platform}`} className="border-t hover:bg-[rgba(59,195,226,0.03)]" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
                    <td className="py-2 px-3">{p.student_name}</td>
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-dark-ambient)' }}>{p.username}</td>
                    <td className="py-2 px-3">{p.college}</td>
                    <td className="py-2 px-3">{p.batch}</td>
                    <td className="py-2 px-3 text-right">{isLC ? p.total_solved : p.problems_solved}</td>
                    <td className="py-2 px-3 text-right font-bold" style={{ color: 'var(--color-primary)' }}>{p.score}</td>
                    <td className="py-2 px-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {p.fetched_at ? new Date(p.fetched_at).toLocaleDateString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Delete action */}
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-48">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Username to remove</label>
              <input type="text" value={delUser} onChange={e => setDelUser(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }} placeholder="Enter username..." />
            </div>
            <button onClick={handleDelete}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-medium flex items-center gap-1.5 transition-colors">
              <UserMinus size={16} /> Remove
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// --- Main Component ---
export default function StudentsClient({ platforms, totalStudents, initialStudents }: {
  platforms: Platform[]
  totalStudents: number
  initialStudents: any[]
}) {
  const [tab, setTab] = useState<'students' | 'link' | 'manage'>('students')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>Students & Data</h2>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>Import students, link coding profiles, and manage data.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <TabButton active={tab === 'students'} onClick={() => setTab('students')} icon={<Users size={16} />} label="Students" />
        <TabButton active={tab === 'link'} onClick={() => setTab('link')} icon={<Link2 size={16} />} label="Link Profiles" />
        <TabButton active={tab === 'manage'} onClick={() => setTab('manage')} icon={<RefreshCw size={16} />} label="Manage Data" />
      </div>

      {tab === 'students' && <StudentImport platforms={platforms} totalStudents={totalStudents} />}
      {tab === 'link' && <LinkAndFetch platforms={platforms} />}
      {tab === 'manage' && <ManageData platforms={platforms} />}
    </div>
  )
}
