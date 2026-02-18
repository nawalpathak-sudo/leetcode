import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, UserMinus, RefreshCw, Users, Link2, Mail } from 'lucide-react'
import { fetchLeetCodeData, fetchCodeforcesData, fetchGitHubData, sanitizeUsername } from '../lib/api'
import {
  loadAllProfiles, saveProfile, deleteProfile, clearAllProfiles,
  upsertStudents, loadAllStudents, linkProfile, loadAllCodingProfilesMap,
  bulkUpdateEmails,
} from '../lib/db'
import Papa from 'papaparse'

function getFetcher(platform) {
  if (platform === 'leetcode') return fetchLeetCodeData
  if (platform === 'codeforces') return fetchCodeforcesData
  if (platform === 'github') return fetchGitHubData
  return null
}

export default function AdminPanel({ platforms, adminUser }) {
  const isMaster = adminUser?.id === 'master'
  const [platform, setPlatform] = useState(platforms[0]?.slug || '')
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('students')

  const current = platforms.find(p => p.slug === platform)
  const platformName = current?.display_name || platform

  const reload = async () => {
    setLoading(true)
    setProfiles(await loadAllProfiles(platform))
    setLoading(false)
  }

  useEffect(() => { reload() }, [platform])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Students & Data</h2>
        <p className="text-primary/60 mt-1">Import students, link coding profiles, and manage data.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <TabButton active={tab === 'students'} onClick={() => setTab('students')} icon={<Users size={16} />} label="Students" />
          <TabButton active={tab === 'link'} onClick={() => setTab('link')} icon={<Link2 size={16} />} label="Link Profiles" />
          <TabButton active={tab === 'manage'} onClick={() => setTab('manage')} icon={<RefreshCw size={16} />} label="Manage Data" />
          {isMaster && <TabButton active={tab === 'emails'} onClick={() => setTab('emails')} icon={<Mail size={16} />} label="Update Emails" />}
        </div>
        {tab !== 'students' && tab !== 'emails' && (
          <select
            value={platform}
            onChange={e => setPlatform(e.target.value)}
            className="ml-auto bg-white border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary font-medium focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
          >
            {platforms.map(p => <option key={p.slug} value={p.slug}>{p.display_name}</option>)}
          </select>
        )}
      </div>

      {tab === 'students' && <StudentImport platforms={platforms} adminUser={adminUser} />}
      {tab === 'link' && <LinkAndFetch platforms={platforms} onComplete={reload} adminUser={adminUser} />}
      {tab === 'manage' && (
        loading ? <Spinner /> : profiles.length === 0 ? (
          <div className="bg-ambient/10 border border-ambient/30 text-primary px-4 py-3 rounded-lg">
            No {platformName} profiles in database yet. Link profiles first.
          </div>
        ) : (
          <ProfileManager profiles={profiles} platform={platform} platformName={platformName} onUpdate={reload} adminUser={adminUser} />
        )
      )}
      {tab === 'emails' && isMaster && <EmailUploader />}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
        active
          ? 'bg-primary text-white'
          : 'bg-primary/5 text-primary/60 hover:bg-primary/10 border border-primary/10'
      }`}
    >
      {icon} {label}
    </button>
  )
}

function Spinner() {
  return (
    <div className="text-center py-8">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
    </div>
  )
}

// ---- Student Import ----

function StudentImport({ platforms = [], adminUser }) {
  const isFaculty = adminUser?.role === 'faculty'
  const facultyCampus = adminUser?.campus
  const fileRef = useRef()
  const [csvData, setCsvData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [profileMap, setProfileMap] = useState({})
  const [collegeFilter, setCollegeFilter] = useState(isFaculty && facultyCampus ? facultyCampus : 'all')
  const [batchFilter, setBatchFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [savingCell, setSavingCell] = useState(false)

  const loadData = async () => {
    setLoadingStudents(true)
    const [studentsData, mapData] = await Promise.all([
      loadAllStudents(),
      loadAllCodingProfilesMap(),
    ])
    setStudents(studentsData)
    setProfileMap(mapData)
    setLoadingStudents(false)
  }

  useEffect(() => { loadData() }, [])

  const campusStudents = isFaculty && facultyCampus
    ? students.filter(s => s.college === facultyCampus)
    : students

  const colleges = [...new Set(campusStudents.map(s => s.college).filter(Boolean))].sort()
  const batches = [...new Set(campusStudents.map(s => s.batch).filter(Boolean))].sort()

  const filtered = campusStudents.filter(s => {
    if (collegeFilter !== 'all' && s.college !== collegeFilter) return false
    if (batchFilter !== 'all' && s.batch !== batchFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const nameMatch = (s.student_name || '').toLowerCase().includes(q)
      const idMatch = (s.lead_id || '').toLowerCase().includes(q)
      if (!nameMatch && !idMatch) return false
    }
    return true
  })

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cols = res.meta.fields.map(f => f.trim().toLowerCase())
        if (!cols.includes('lead_id')) {
          alert('CSV must have a lead_id column')
          return
        }
        const rows = res.data.map(r => {
          const n = {}
          for (const [k, v] of Object.entries(r)) n[k.trim().toLowerCase()] = (v || '').trim()
          return {
            lead_id: n.lead_id,
            student_name: n.student_name || n.name || '',
            email: n.email || '',
            college: n.college || '',
            batch: n.batch || '',
          }
        }).filter(r => r.lead_id)
        setCsvData(rows)
      }
    })
  }

  const handleSave = async () => {
    if (!csvData?.length) return
    setSaving(true)
    setResult(null)
    const ok = await upsertStudents(csvData)
    setResult(ok ? `Saved ${csvData.length} students successfully.` : 'Error saving students.')
    if (ok) {
      await loadData()
      setCsvData(null)
      if (fileRef.current) fileRef.current.value = ''
    }
    setSaving(false)
  }

  const handleStartEdit = (lead_id, platform) => {
    const existing = profileMap[lead_id]?.[platform] || ''
    setEditingCell({ lead_id, platform })
    setEditValue(existing)
  }

  const handleSaveId = async () => {
    if (!editingCell) return
    const { lead_id, platform } = editingCell
    const username = sanitizeUsername(editValue.trim())
    if (!username) {
      setEditingCell(null)
      setEditValue('')
      return
    }
    setSavingCell(true)
    const ok = await linkProfile(lead_id, platform, username)
    if (ok) {
      setProfileMap(prev => ({
        ...prev,
        [lead_id]: { ...(prev[lead_id] || {}), [platform]: username }
      }))
    }
    setSavingCell(false)
    setEditingCell(null)
    setEditValue('')
  }

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveId()
    if (e.key === 'Escape') { setEditingCell(null); setEditValue('') }
  }

  return (
    <div className="space-y-6">
      {/* CSV Upload */}
      <div className="bg-white rounded-xl p-6 space-y-4 border border-primary/10 shadow-sm">
        <h3 className="font-semibold text-lg text-primary">Upload Students CSV</h3>
        <p className="text-sm text-primary/60">
          CSV columns: <strong>lead_id</strong> (required), <span className="text-primary/40">student_name, email, college, batch (all optional)</span>
        </p>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile}
          className="block text-sm text-primary/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary/90" />

        {csvData && (
          <>
            <p className="text-dark-ambient font-medium">{csvData.length} students found</p>
            <div className="overflow-x-auto max-h-64 overflow-y-auto border border-primary/10 rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-primary/5">
                  <tr className="text-primary/60">
                    <th className="py-2 px-3 text-left font-medium">Lead ID</th>
                    <th className="py-2 px-3 text-left font-medium">Name</th>
                    <th className="py-2 px-3 text-left font-medium">Email</th>
                    <th className="py-2 px-3 text-left font-medium">College</th>
                    <th className="py-2 px-3 text-left font-medium">Batch</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-primary/5">
                      <td className="py-1.5 px-3 text-dark-ambient">{r.lead_id}</td>
                      <td className="py-1.5 px-3">{r.student_name}</td>
                      <td className="py-1.5 px-3">{r.email}</td>
                      <td className="py-1.5 px-3">{r.college}</td>
                      <td className="py-1.5 px-3">{r.batch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvData.length > 20 && <p className="text-xs text-primary/40">Showing first 20 of {csvData.length}</p>}

            {result && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                result.includes('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-800'
              }`}>{result}</div>
            )}

            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-lg font-medium transition-colors">
              {saving ? 'Saving...' : 'Save Students'}
            </button>
          </>
        )}
      </div>

      {/* All Students with Filters */}
      {loadingStudents ? <Spinner /> : campusStudents.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-primary/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-semibold text-lg text-primary">{campusStudents.length} Students{isFaculty && facultyCampus ? ` — ${facultyCampus}` : ' in Database'}</h3>
            <span className="text-sm text-primary/40">Showing {filtered.length} of {campusStudents.length}</span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search name or ID..."
              className="bg-white border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary placeholder-primary/30 focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient w-52"
            />
            <select value={collegeFilter} onChange={e => setCollegeFilter(e.target.value)}
              disabled={isFaculty && facultyCampus}
              className={`bg-white border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient ${isFaculty && facultyCampus ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <option value="all">All Campuses</option>
              {colleges.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)}
              className="bg-white border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient">
              <option value="all">All Years</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            {(collegeFilter !== 'all' || batchFilter !== 'all' || searchQuery) && (
              <button onClick={() => { setCollegeFilter('all'); setBatchFilter('all'); setSearchQuery('') }}
                className="text-xs text-dark-ambient hover:underline">Clear filters</button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-primary/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#f3f4f8] z-10">
                <tr className="text-primary/60">
                  <th className="py-2.5 px-3 text-left font-medium">Name</th>
                  <th className="py-2.5 px-3 text-left font-medium">College</th>
                  <th className="py-2.5 px-3 text-left font-medium">Batch</th>
                  {platforms.map(p => (
                    <th key={p.slug} className="py-2.5 px-3 text-left font-medium">{p.display_name} ID</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.lead_id} className="border-t border-primary/5 hover:bg-ambient/5">
                    <td className="py-2 px-3">
                      <div className="font-medium text-primary">{s.student_name || '—'}</div>
                      <div className="text-xs text-primary/30">{s.lead_id}</div>
                    </td>
                    <td className="py-2 px-3 text-primary/70">{s.college}</td>
                    <td className="py-2 px-3 text-primary/70">{s.batch}</td>
                    {platforms.map(p => {
                      const isEditing = editingCell?.lead_id === s.lead_id && editingCell?.platform === p.slug
                      const linked = profileMap[s.lead_id]?.[p.slug]
                      return (
                        <td key={p.slug} className="py-2 px-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                onBlur={handleSaveId}
                                disabled={savingCell}
                                className="bg-white border border-ambient rounded px-2 py-1 text-sm text-primary w-32 focus:outline-none focus:ring-1 focus:ring-ambient"
                                placeholder={`${p.display_name} username`}
                              />
                            </div>
                          ) : linked ? (
                            <button
                              onClick={() => handleStartEdit(s.lead_id, p.slug)}
                              className="text-dark-ambient font-medium hover:underline cursor-pointer text-left"
                              title="Click to edit"
                            >
                              {linked}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(s.lead_id, p.slug)}
                              className="text-primary/20 hover:text-ambient cursor-pointer text-sm"
                              title="Click to add username"
                            >
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
        </div>
      )}
    </div>
  )
}

// ---- Email Uploader (master only) ----

function EmailUploader() {
  const fileRef = useRef()
  const [csvData, setCsvData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setResult(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cols = res.meta.fields.map(f => f.trim().toLowerCase())
        if (!cols.includes('lead_id') || !cols.includes('email')) {
          alert('CSV must have lead_id and email columns')
          return
        }
        const rows = res.data.map(r => {
          const n = {}
          for (const [k, v] of Object.entries(r)) n[k.trim().toLowerCase()] = (v || '').trim()
          return { lead_id: n.lead_id, email: n.email }
        }).filter(r => r.lead_id && r.email)
        setCsvData(rows)
      }
    })
  }

  const handleSave = async () => {
    if (!csvData?.length) return
    setSaving(true)
    setResult(null)
    const res = await bulkUpdateEmails(csvData)
    setResult(res)
    setSaving(false)
  }

  const handleClear = () => {
    setCsvData(null)
    setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="bg-white rounded-xl p-6 space-y-4 border border-primary/10 shadow-sm">
      <h3 className="font-semibold text-lg text-primary flex items-center gap-2">
        <Mail size={18} /> Bulk Update Student Emails
      </h3>
      <p className="text-sm text-primary/60">
        Upload a CSV with <strong>lead_id</strong> and <strong>email</strong> columns. Existing students will have their email updated. New lead_ids will be inserted.
      </p>

      <input ref={fileRef} type="file" accept=".csv" onChange={handleFile}
        className="block text-sm text-primary/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary/90" />

      {csvData && (
        <>
          <p className="text-dark-ambient font-medium">{csvData.length} rows found</p>
          <div className="overflow-x-auto max-h-64 overflow-y-auto border border-primary/10 rounded-lg">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#f3f4f8] z-10">
                <tr className="text-primary/60">
                  <th className="py-2 px-3 text-left font-medium">#</th>
                  <th className="py-2 px-3 text-left font-medium">Lead ID</th>
                  <th className="py-2 px-3 text-left font-medium">Email</th>
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 30).map((r, i) => (
                  <tr key={i} className="border-t border-primary/5">
                    <td className="py-1.5 px-3 text-primary/30">{i + 1}</td>
                    <td className="py-1.5 px-3 text-dark-ambient">{r.lead_id}</td>
                    <td className="py-1.5 px-3">{r.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {csvData.length > 30 && <p className="text-xs text-primary/40">Showing first 30 of {csvData.length}</p>}

          {result && (
            <div className={`px-4 py-3 rounded-lg text-sm ${
              result.failed.length
                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}>
              Updated {result.updated}, inserted {result.inserted} of {csvData.length} rows.
              {result.failed.length > 0 && <> Failed: {result.failed.join(', ')}</>}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-lg font-medium transition-colors">
              {saving ? 'Saving...' : 'Update Emails'}
            </button>
            <button onClick={handleClear}
              className="px-4 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary/60 rounded-lg font-medium transition-colors">
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Link & Fetch (platform-agnostic) ----

function LinkAndFetch({ platforms, onComplete, adminUser }) {
  const fileRef = useRef()
  const [mode, setMode] = useState('csv')
  const [manualPlatform, setManualPlatform] = useState(platforms[0]?.slug || '')
  const [text, setText] = useState('')
  const [csvData, setCsvData] = useState(null)
  const [detectedPlatforms, setDetectedPlatforms] = useState([])
  const [fetching, setFetching] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' })
  const [results, setResults] = useState(null)

  const platformSlugs = platforms.map(p => p.slug)
  const platformNames = Object.fromEntries(platforms.map(p => [p.slug, p.display_name]))

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const cols = res.meta.fields.map(f => f.trim().toLowerCase())
        if (!cols.includes('lead_id')) {
          alert('CSV must have a lead_id column')
          return
        }
        const detected = platformSlugs.filter(s => cols.includes(s))
        if (detected.length === 0) {
          alert(`CSV must have at least one platform column: ${platformSlugs.join(', ')}`)
          return
        }
        setDetectedPlatforms(detected)
        const rows = res.data.map(r => {
          const n = {}
          for (const [k, v] of Object.entries(r)) n[k.trim().toLowerCase()] = (v || '').trim()
          return n
        }).filter(r => r.lead_id)
        setCsvData(rows)
      }
    })
  }

  const buildEntries = () => {
    let entries = []
    const invalid = []
    if (mode === 'manual') {
      for (const line of text.split('\n')) {
        const parts = line.split(',').map(s => s.trim())
        if (!parts[0] || !parts[1]) continue
        const clean = sanitizeUsername(parts[1])
        if (clean) {
          entries.push({ lead_id: parts[0], platform: manualPlatform, username: clean })
        } else {
          invalid.push(parts[1])
        }
      }
    } else {
      for (const row of (csvData || [])) {
        for (const plat of detectedPlatforms) {
          if (!row[plat]) continue
          const clean = sanitizeUsername(row[plat])
          if (clean) {
            entries.push({ lead_id: row.lead_id, platform: plat, username: clean })
          } else {
            invalid.push(row[plat])
          }
        }
      }
    }

    let skipped = 0
    if (mode === 'csv' && csvData) {
      for (const row of csvData) {
        const hasAny = detectedPlatforms.some(p => row[p])
        if (!hasAny) skipped++
      }
    }
    return { entries, skipped, invalid }
  }

  const handleLinkOnly = async () => {
    const { entries, skipped, invalid } = buildEntries()
    if (!entries.length) return

    setFetching(true)
    setResults(null)
    let success = 0
    const failed = []

    for (let i = 0; i < entries.length; i++) {
      const { lead_id, platform, username } = entries[i]
      setProgress({ current: i + 1, total: entries.length, name: `${username} (${platformNames[platform] || platform})` })

      const linked = await linkProfile(lead_id, platform, username)
      if (linked) {
        success++
      } else {
        failed.push(`${username} (link failed)`)
      }
    }

    setResults({ success, total: entries.length, failed, skipped, invalid: invalid.length, linkOnly: true })
    setFetching(false)
    onComplete()
  }

  const runLinkAndFetch = async (limit) => {
    const { entries: allEntries, skipped, invalid } = buildEntries()
    if (!allEntries.length) return
    const entries = limit ? allEntries.slice(0, limit) : allEntries

    setFetching(true)
    setResults(null)
    let success = 0
    const failed = []

    for (let i = 0; i < entries.length; i++) {
      const { lead_id, platform, username } = entries[i]
      setProgress({ current: i + 1, total: entries.length, name: `${username} (${platformNames[platform] || platform})` })

      const linked = await linkProfile(lead_id, platform, username)
      if (!linked) {
        failed.push(`${username} (link failed)`)
        if (i < entries.length - 1) await sleep(500)
        continue
      }

      const fetcher = getFetcher(platform)
      if (fetcher) {
        const data = await fetcher(username)
        if (data) {
          await saveProfile(lead_id, platform, username, data)
          success++
        } else {
          failed.push(`${username} (API fetch failed)`)
        }
      } else {
        success++
      }

      if (i < entries.length - 1) await sleep(2000)
    }

    const remaining = limit ? Math.max(0, allEntries.length - limit) : 0
    setResults({ success, total: entries.length, failed, skipped, invalid: invalid.length, remaining })
    setFetching(false)
    onComplete()
  }

  const manualPlatName = platformNames[manualPlatform] || manualPlatform

  return (
    <div className="bg-white rounded-xl p-6 space-y-4 border border-primary/10 shadow-sm">
      <h3 className="font-semibold text-lg text-primary">Link Coding Profiles</h3>
      <p className="text-sm text-primary/60">
        Link student lead IDs to their platform usernames, then fetch API data.
      </p>

      <div className="flex gap-2">
        <button onClick={() => setMode('csv')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === 'csv' ? 'bg-primary text-white' : 'bg-primary/5 text-primary/60 border border-primary/10'
          }`}>
          Upload CSV
        </button>
        <button onClick={() => setMode('manual')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            mode === 'manual' ? 'bg-primary text-white' : 'bg-primary/5 text-primary/60 border border-primary/10'
          }`}>
          Manual Entry
        </button>
      </div>

      {mode === 'csv' ? (
        <div className="space-y-3">
          <p className="text-sm text-primary/60">
            CSV must have a <strong>lead_id</strong> column, plus a column for each platform username:
          </p>
          <div className="bg-primary/5 rounded-lg px-4 py-3 font-mono text-xs text-primary/70 overflow-x-auto">
            <div>lead_id, {platformSlugs.join(', ')}</div>
            <div className="text-primary/40 mt-1">
              {platformSlugs.map((s, i) => (
                <span key={s}>{i > 0 && '  |  '}<strong className="text-dark-ambient">{s}</strong> = {platformNames[s]} username</span>
              ))}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile}
            className="block text-sm text-primary/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary/90" />
          {csvData && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-dark-ambient font-medium">{csvData.length} students</p>
                <div className="flex gap-1.5">
                  {detectedPlatforms.map(p => (
                    <span key={p} className="px-2 py-0.5 bg-ambient/15 text-dark-ambient rounded text-xs font-medium">
                      {platformNames[p] || p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto border border-primary/10 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-primary/5">
                    <tr className="text-primary/60">
                      <th className="py-2 px-3 text-left font-medium">Lead ID</th>
                      {detectedPlatforms.map(p => (
                        <th key={p} className="py-2 px-3 text-left font-medium">{platformNames[p] || p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-primary/5">
                        <td className="py-1.5 px-3">{r.lead_id}</td>
                        {detectedPlatforms.map(p => (
                          <td key={p} className="py-1.5 px-3 text-dark-ambient">{r[p] || ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.length > 20 && <p className="text-xs text-primary/40">Showing first 20 of {csvData.length}</p>}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-primary/60 font-medium mb-1">Platform</label>
            <select value={manualPlatform} onChange={e => setManualPlatform(e.target.value)}
              className="bg-white border border-primary/20 rounded-lg px-3 py-2 text-primary focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient">
              {platforms.map(p => <option key={p.slug} value={p.slug}>{p.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-primary/60 font-medium mb-1">
              One per line: lead_id,{manualPlatName.toLowerCase()}_username
            </label>
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder={"LEAD001,john_doe\nLEAD002,jane_smith\nLEAD003,coder123"}
              rows={6}
              className="w-full bg-white border border-primary/20 rounded-lg px-3 py-2 text-primary placeholder-primary/30 resize-y focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient font-mono text-sm" />
          </div>
        </div>
      )}

      <ProgressBar fetching={fetching} progress={progress} />
      <ResultBanner results={results} />

      <div className="flex gap-3 flex-wrap">
        <button onClick={handleLinkOnly} disabled={fetching}
          className="px-6 py-2.5 bg-ambient hover:bg-dark-ambient disabled:bg-ambient/40 text-primary rounded-lg font-medium transition-colors">
          {fetching ? 'Linking...' : 'Link Only'}
        </button>
        <button onClick={() => runLinkAndFetch(10)} disabled={fetching}
          className="px-6 py-2.5 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg font-medium transition-colors">
          {fetching ? 'Testing...' : 'Test (10 only)'}
        </button>
        <button onClick={() => runLinkAndFetch(null)} disabled={fetching}
          className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-lg font-medium transition-colors">
          {fetching ? 'Fetching...' : 'Link & Fetch All'}
        </button>
      </div>
      <p className="text-xs text-primary/40">
        Link Only saves usernames to DB. Test fetches first 10 to verify API works. Use Manage tab → Refresh All later.
      </p>
    </div>
  )
}

// ---- Profile Manager ----

function ProfileManager({ profiles: allProfiles, platform, platformName, onUpdate, adminUser }) {
  const isFaculty = adminUser?.role === 'faculty'
  const facultyCampus = adminUser?.campus
  const profiles = isFaculty && facultyCampus ? allProfiles.filter(p => p.college === facultyCampus) : allProfiles
  const [delUser, setDelUser] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, name: '' })
  const [refreshResults, setRefreshResults] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)
  const [sortKey, setSortKey] = useState('score')
  const [sortDir, setSortDir] = useState('desc')

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortedProfiles = [...profiles].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
    return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
  })

  const handleDelete = async () => {
    if (!delUser.trim()) return
    const match = profiles.find(p => p.username.toLowerCase() === delUser.trim().toLowerCase())
    if (!match) { alert('Username not found in current profiles'); return }
    await deleteProfile(match.lead_id, platform)
    setDelUser('')
    onUpdate()
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear ALL profiles? This cannot be undone.')) return
    await clearAllProfiles(platform)
    onUpdate()
  }

  const handleRefresh = async (limit) => {
    if (!profiles.length) return
    // Unfetched profiles first, then already-fetched ones
    const unfetched = profiles.filter(p => !p.fetched_at)
    const fetched = profiles.filter(p => p.fetched_at)
    const sorted = [...unfetched, ...fetched]
    const batch = limit ? sorted.slice(0, limit) : sorted
    const label = limit ? `first ${batch.length}` : `all ${batch.length}`
    const unfetchedCount = Math.min(unfetched.length, batch.length)
    if (!confirm(`Fetch ${label} ${platformName} profiles? (${unfetchedCount} unfetched first)`)) return

    setRefreshing(true)
    setRefreshResults(null)
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

    const fetcher = getFetcher(platform)
    let success = 0
    const failed = []

    for (let i = 0; i < batch.length; i++) {
      const p = batch[i]
      setRefreshProgress({ current: i + 1, total: batch.length, name: p.username })

      if (fetcher) {
        const data = await fetcher(p.username)
        if (data) {
          await saveProfile(p.lead_id, platform, p.username, data)
          success++
        } else {
          failed.push(p.username)
        }
      }

      if (i < batch.length - 1) await sleep(2000)
    }

    clearInterval(timerRef.current)
    timerRef.current = null
    const remaining = limit ? Math.max(0, profiles.length - limit) : 0
    setRefreshResults({ success, total: batch.length, failed, remaining })
    setRefreshing(false)
    onUpdate()
  }

  const fmtTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  const estRemaining = refreshProgress.current > 0
    ? Math.max(0, Math.round((elapsed / refreshProgress.current) * refreshProgress.total) - elapsed)
    : 0

  const isLC = platform === 'leetcode'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-dark-ambient font-medium flex items-center gap-2">
          <Users size={18} /> {profiles.length} profile(s) in database
        </p>
        <button onClick={onUpdate} className="text-primary/40 hover:text-primary transition-colors" title="Reload from DB">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Refresh All */}
      <div className="bg-ambient/5 border border-ambient/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-primary">Refresh Profiles</p>
            <p className="text-xs text-primary/50">Re-fetch latest data from {platformName} API</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleRefresh(10)}
              disabled={refreshing}
              className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 disabled:bg-amber-50 text-amber-800 border border-amber-300 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Testing...' : 'Test 10'}
            </button>
            <button
              onClick={() => handleRefresh(null)}
              disabled={refreshing}
              className="px-5 py-2.5 bg-dark-ambient hover:bg-ambient disabled:bg-primary/30 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh All'}
            </button>
          </div>
        </div>

        {refreshing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-primary/70">Fetching <strong>{refreshProgress.name}</strong></span>
              <span className="text-primary/50">{refreshProgress.current}/{refreshProgress.total}</span>
            </div>
            <div className="w-full bg-primary/10 rounded-full h-2.5">
              <div className="bg-dark-ambient h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs text-primary/40">
              <span>Elapsed: {fmtTime(elapsed)}</span>
              <span>Est. remaining: {fmtTime(estRemaining)}</span>
              <span>{Math.round((refreshProgress.current / refreshProgress.total) * 100)}%</span>
            </div>
          </div>
        )}

        {refreshResults && (
          <div className={`px-4 py-3 rounded-lg text-sm ${
            refreshResults.failed.length
              ? 'bg-amber-50 border border-amber-200 text-amber-800'
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            Refreshed {refreshResults.success}/{refreshResults.total} profiles in {fmtTime(elapsed)}.
            {refreshResults.remaining > 0 && <> ({refreshResults.remaining} remaining)</>}
            {refreshResults.failed.length > 0 && <> Failed: {refreshResults.failed.join(', ')}</>}
          </div>
        )}
      </div>

      {/* Profiles table */}
      <div className="overflow-x-auto border border-primary/10 rounded-lg shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-primary/5">
            <tr>
              <SortTh label="Name" field="student_name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Username" field="username" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="College" field="college" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Batch" field="batch" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label={isLC ? 'Total Solved' : 'Problems'} field={isLC ? 'total_solved' : 'problems_solved'} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <SortTh label="Score" field="score" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <SortTh label="Fetched" field="fetched_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedProfiles.map(p => (
              <tr key={`${p.lead_id}-${p.platform}`} className="border-t border-primary/5 hover:bg-ambient/5">
                <td className="py-2 px-3">{p.student_name}</td>
                <td className="py-2 px-3 text-dark-ambient font-medium">{p.username}</td>
                <td className="py-2 px-3">{p.college}</td>
                <td className="py-2 px-3">{p.batch}</td>
                <td className="py-2 px-3 text-right">{isLC ? p.total_solved : p.problems_solved}</td>
                <td className="py-2 px-3 text-right font-bold text-primary">{p.score}</td>
                <td className="py-2 px-3 text-primary/40 text-xs">
                  {p.fetched_at ? new Date(p.fetched_at).toLocaleDateString() : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-48">
          <label className="block text-sm text-primary/60 font-medium mb-1">Username to remove</label>
          <input
            type="text"
            value={delUser}
            onChange={(e) => setDelUser(e.target.value)}
            className="w-full bg-white border border-primary/20 rounded-lg px-3 py-2 text-primary focus:outline-none focus:border-ambient focus:ring-1 focus:ring-ambient"
            placeholder="Enter username..."
          />
        </div>
        <button
          onClick={handleDelete}
          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
        >
          <UserMinus size={16} /> Remove
        </button>
        <button
          onClick={handleClearAll}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-1.5 transition-colors"
        >
          <Trash2 size={16} /> Clear All
        </button>
      </div>
    </div>
  )
}

// ---- Shared Components ----

function ProgressBar({ fetching, progress }) {
  if (!fetching) return null
  return (
    <div>
      <div className="flex justify-between text-sm text-primary/60 mb-1">
        <span>Fetching {progress.name}...</span>
        <span>{progress.current}/{progress.total}</span>
      </div>
      <div className="w-full bg-primary/10 rounded-full h-2">
        <div className="bg-ambient h-2 rounded-full transition-all"
          style={{ width: `${(progress.current / progress.total) * 100}%` }} />
      </div>
    </div>
  )
}

function ResultBanner({ results }) {
  if (!results) return null
  const hasFailures = results.failed.length > 0
  return (
    <div className={`px-4 py-3 rounded-lg ${
      hasFailures
        ? 'bg-amber-50 border border-amber-200 text-amber-800'
        : 'bg-green-50 border border-green-200 text-green-800'
    }`}>
      {results.linkOnly ? 'Linked' : 'Fetched'} {results.success}/{results.total} profiles.
      {results.remaining > 0 && <> ({results.remaining} remaining)</>}
      {results.skipped > 0 && <> Skipped {results.skipped} rows (no username).</>}
      {results.invalid > 0 && <> Rejected {results.invalid} invalid usernames (URLs/bad format).</>}
      {hasFailures && <> Failed: {results.failed.join(', ')}</>}
    </div>
  )
}

function SortTh({ label, field, sortKey, sortDir, onSort, align = 'left' }) {
  const active = sortKey === field
  return (
    <th
      className={`py-2.5 px-3 font-medium cursor-pointer select-none transition-colors hover:text-primary ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${active ? 'text-dark-ambient' : 'text-primary/50'}`}
      onClick={() => onSort(field)}
    >
      {label}
      {active && <span className="ml-1 text-xs">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>}
    </th>
  )
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
