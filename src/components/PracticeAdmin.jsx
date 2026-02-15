import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Upload, Loader2, X, Check, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import { loadPracticeProblems, upsertPracticeProblem, deletePracticeProblem, bulkInsertPracticeProblems } from '../lib/db'
import { fetchLeetCodeProblem } from '../lib/api'

const TOPICS = [
  'Arrays', 'Strings', 'Linked List', 'Trees', 'Binary Search',
  'Dynamic Programming', 'Graph', 'Stack', 'Greedy', 'Backtracking',
  'Math', 'Bit Manipulation', 'Heap', 'Sliding Window', 'Two Pointers',
]

function extractSlug(input) {
  const trimmed = input.trim()
  // Full URL: https://leetcode.com/problems/two-sum/ or /description/
  const urlMatch = trimmed.match(/leetcode\.com\/problems\/([a-z0-9-]+)/)
  if (urlMatch) return urlMatch[1]
  // Already a slug
  if (/^[a-z0-9-]+$/.test(trimmed)) return trimmed
  return null
}

export default function PracticeAdmin() {
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  // Add-by-link state
  const [topic, setTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [linksText, setLinksText] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchResults, setFetchResults] = useState(null) // [{ slug, status, data }]

  // Edit state (single problem inline edit)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})

  // CSV state
  const [csvData, setCsvData] = useState(null)
  const [csvSaving, setCsvSaving] = useState(false)
  const [tab, setTab] = useState('add')

  const reload = async () => {
    setLoading(true)
    setProblems(await loadPracticeProblems())
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  // ---- Fetch problems from LeetCode ----

  const handleFetch = async () => {
    const resolvedTopic = topic === '__custom__' ? customTopic.trim() : topic
    if (!resolvedTopic) { setMsg('Select a topic first.'); return }

    const lines = linksText.split('\n').map(l => l.trim()).filter(Boolean)
    const slugs = lines.map(extractSlug).filter(Boolean)
    if (slugs.length === 0) { setMsg('No valid LeetCode links or slugs found.'); return }

    // Dedupe
    const unique = [...new Set(slugs)]

    setFetching(true)
    setMsg('')
    setFetchResults(null)

    const results = []
    for (const slug of unique) {
      results.push({ slug, status: 'loading', data: null })
    }
    setFetchResults([...results])

    for (let i = 0; i < unique.length; i++) {
      const slug = unique[i]
      const data = await fetchLeetCodeProblem(slug)
      results[i] = data
        ? { slug, status: 'ok', data: { ...data, topic: resolvedTopic } }
        : { slug, status: 'error', data: null }
      setFetchResults([...results])
    }

    setFetching(false)
  }

  const handleSaveFetched = async () => {
    if (!fetchResults) return
    const toSave = fetchResults.filter(r => r.status === 'ok').map((r, i) => ({
      topic: r.data.topic,
      title: r.data.title,
      title_slug: r.data.title_slug,
      difficulty: r.data.difficulty,
      tags: r.data.tags || [],
      order_index: i,
    }))
    if (toSave.length === 0) return

    setFetching(true)
    const ok = await bulkInsertPracticeProblems(toSave)
    setFetching(false)

    if (ok) {
      setMsg(`Added ${toSave.length} problem${toSave.length > 1 ? 's' : ''}.`)
      setFetchResults(null)
      setLinksText('')
      reload()
    } else {
      setMsg('Error saving problems.')
    }
  }

  // ---- Edit handlers ----

  const startEdit = (p) => {
    setEditId(p.id)
    setEditForm({
      topic: TOPICS.includes(p.topic) ? p.topic : '__custom__',
      customTopic: TOPICS.includes(p.topic) ? '' : p.topic,
      title: p.title,
      difficulty: p.difficulty,
      tags: (p.tags || []).join(', '),
      notes: p.notes || '',
      order_index: p.order_index || 0,
    })
  }

  const saveEdit = async () => {
    const resolvedTopic = editForm.topic === '__custom__' ? editForm.customTopic.trim() : editForm.topic
    if (!resolvedTopic || !editForm.title.trim()) return
    const existing = problems.find(p => p.id === editId)
    await upsertPracticeProblem({
      id: editId,
      topic: resolvedTopic,
      title: editForm.title.trim(),
      title_slug: existing.title_slug,
      difficulty: editForm.difficulty,
      tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      notes: editForm.notes.trim(),
      order_index: Number(editForm.order_index) || 0,
    })
    setEditId(null)
    reload()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this problem?')) return
    await deletePracticeProblem(id)
    reload()
  }

  // ---- CSV handlers ----

  const handleCsvFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Support minimal CSV: just topic + title_slug columns, rest auto-fetched
        const rows = results.data
          .filter(r => r.topic && (r.title_slug || r.slug || r.link || r.url))
          .map(r => {
            const slug = extractSlug(r.title_slug || r.slug || r.link || r.url || '')
            return slug ? { topic: r.topic.trim(), slug } : null
          })
          .filter(Boolean)
        setCsvData(rows)
      },
    })
  }

  const handleCsvImport = async () => {
    if (!csvData?.length) return
    setCsvSaving(true)
    setMsg('')

    // Fetch details for each slug
    const fetched = []
    for (const row of csvData) {
      const data = await fetchLeetCodeProblem(row.slug)
      if (data) {
        fetched.push({
          topic: row.topic,
          title: data.title,
          title_slug: data.title_slug,
          difficulty: data.difficulty,
          tags: data.tags || [],
          order_index: fetched.length,
        })
      }
    }

    if (fetched.length > 0) {
      const ok = await bulkInsertPracticeProblems(fetched)
      if (ok) {
        setMsg(`Imported ${fetched.length} of ${csvData.length} problems.`)
        setCsvData(null)
        reload()
      } else {
        setMsg('Error importing.')
      }
    } else {
      setMsg('No problems could be fetched. Check slugs.')
    }
    setCsvSaving(false)
  }

  // ---- Group problems by topic ----
  const grouped = {}
  for (const p of problems) {
    if (!grouped[p.topic]) grouped[p.topic] = []
    grouped[p.topic].push(p)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">LeetCode Corner</h2>
        <p className="text-primary/60 mt-1">Paste LeetCode links — details are fetched automatically.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'add', label: 'Add Problems' },
          { key: 'csv', label: 'Import CSV' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              tab === t.key
                ? 'bg-primary text-white'
                : 'bg-primary/5 text-primary/60 hover:bg-primary/10 border border-primary/10'
            }`}>{t.label}</button>
        ))}
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          msg.includes('Error') || msg.includes('No ') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>{msg}</div>
      )}

      {/* ===== TAB: Add by Links ===== */}
      {tab === 'add' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-primary/10 shadow-sm space-y-4">
            <h3 className="font-semibold text-primary text-lg">Add Problems</h3>
            <p className="text-sm text-primary/40">Pick a topic, paste LeetCode links (one per line), and we'll fetch title, difficulty & tags automatically.</p>

            {/* Topic selector */}
            <div>
              <label className="block text-xs text-primary/50 font-medium mb-1">Topic *</label>
              <select value={topic} onChange={e => setTopic(e.target.value)}
                className="w-full border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-ambient">
                <option value="">Select topic...</option>
                {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__custom__">Custom...</option>
              </select>
              {topic === '__custom__' && (
                <input type="text" placeholder="Enter custom topic" value={customTopic}
                  onChange={e => setCustomTopic(e.target.value)}
                  className="mt-2 w-full border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary focus:outline-none focus:border-ambient" />
              )}
            </div>

            {/* Links textarea */}
            <div>
              <label className="block text-xs text-primary/50 font-medium mb-1">LeetCode Links or Slugs (one per line)</label>
              <textarea value={linksText} onChange={e => setLinksText(e.target.value)}
                rows={5}
                placeholder={`https://leetcode.com/problems/two-sum/\nhttps://leetcode.com/problems/best-time-to-buy-and-sell-stock/\ncontainer-with-most-water`}
                className="w-full border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary font-mono focus:outline-none focus:border-ambient resize-none" />
            </div>

            <button onClick={handleFetch} disabled={fetching}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
              {fetching ? <><Loader2 size={16} className="animate-spin" /> Fetching...</> : <><Plus size={16} /> Fetch & Preview</>}
            </button>

            {/* Fetch results preview */}
            {fetchResults && (
              <div className="border border-primary/10 rounded-lg overflow-hidden">
                <div className="bg-primary/5 px-4 py-2 text-sm font-medium text-primary flex items-center justify-between">
                  <span>Fetched {fetchResults.filter(r => r.status === 'ok').length} of {fetchResults.length}</span>
                  <button onClick={() => setFetchResults(null)} className="text-primary/30 hover:text-primary"><X size={14} /></button>
                </div>
                <div className="divide-y divide-primary/5">
                  {fetchResults.map((r, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                      {r.status === 'loading' && <Loader2 size={14} className="animate-spin text-amber-500 shrink-0" />}
                      {r.status === 'ok' && <Check size={14} className="text-green-500 shrink-0" />}
                      {r.status === 'error' && <AlertCircle size={14} className="text-red-400 shrink-0" />}

                      {r.status === 'ok' ? (
                        <>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            r.data.difficulty === 'Easy' ? 'bg-green-400' : r.data.difficulty === 'Medium' ? 'bg-amber-400' : 'bg-red-400'
                          }`} />
                          <span className="font-medium text-primary flex-1">{r.data.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            r.data.difficulty === 'Easy' ? 'bg-green-50 text-green-600' : r.data.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                          }`}>{r.data.difficulty}</span>
                          <span className="text-xs text-primary/30 hidden sm:inline">{(r.data.tags || []).slice(0, 3).join(', ')}</span>
                        </>
                      ) : (
                        <span className={`font-mono text-xs ${r.status === 'error' ? 'text-red-400' : 'text-primary/40'}`}>{r.slug}</span>
                      )}
                    </div>
                  ))}
                </div>

                {fetchResults.some(r => r.status === 'ok') && !fetching && (
                  <div className="px-4 py-3 bg-primary/[0.02] border-t border-primary/10">
                    <button onClick={handleSaveFetched}
                      className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                      <Plus size={16} /> Save {fetchResults.filter(r => r.status === 'ok').length} Problem{fetchResults.filter(r => r.status === 'ok').length > 1 ? 's' : ''}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===== Problem List ===== */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" />
            </div>
          ) : problems.length === 0 ? (
            <div className="bg-ambient/10 border border-ambient/30 text-primary px-6 py-4 rounded-lg text-center">
              No problems yet. Add some above or import a CSV.
            </div>
          ) : (
            Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([topicName, items]) => (
              <div key={topicName} className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-primary/5 border-b border-primary/10">
                  <h4 className="font-semibold text-primary">{topicName} <span className="text-primary/30 font-normal">({items.length})</span></h4>
                </div>
                <div className="divide-y divide-primary/5">
                  {items.map(p => editId === p.id ? (
                    /* Inline edit row */
                    <div key={p.id} className="px-5 py-3 space-y-3 bg-amber-50/30">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <select value={editForm.topic} onChange={e => setEditForm(f => ({ ...f, topic: e.target.value }))}
                          className="border border-primary/20 rounded px-2 py-1.5 text-xs">
                          {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                          <option value="__custom__">Custom</option>
                        </select>
                        <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                          className="border border-primary/20 rounded px-2 py-1.5 text-xs" placeholder="Title" />
                        <div className="flex gap-1">
                          {['Easy', 'Medium', 'Hard'].map(d => (
                            <button key={d} onClick={() => setEditForm(f => ({ ...f, difficulty: d }))}
                              className={`flex-1 py-1 rounded text-[10px] font-medium ${
                                editForm.difficulty === d
                                  ? d === 'Easy' ? 'bg-green-100 text-green-700' : d === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                  : 'bg-primary/5 text-primary/30'
                              }`}>{d}</button>
                          ))}
                        </div>
                        <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                          className="border border-primary/20 rounded px-2 py-1.5 text-xs" placeholder="Notes" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="px-4 py-1.5 bg-primary text-white rounded text-xs font-medium">Save</button>
                        <button onClick={() => setEditId(null)} className="px-4 py-1.5 bg-primary/5 text-primary/50 rounded text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-primary/[0.02] transition-colors">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        p.difficulty === 'Easy' ? 'bg-green-400' : p.difficulty === 'Medium' ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-primary">{p.title}</span>
                        {p.notes && <span className="text-xs text-primary/30 ml-2">&mdash; {p.notes}</span>}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        p.difficulty === 'Easy' ? 'bg-green-50 text-green-600' : p.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                      }`}>{p.difficulty}</span>
                      {(p.tags || []).length > 0 && (
                        <div className="hidden sm:flex gap-1">
                          {p.tags.slice(0, 3).map(t => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary/40 rounded">{t}</span>
                          ))}
                        </div>
                      )}
                      <button onClick={() => startEdit(p)} className="p-1.5 rounded hover:bg-primary/10 text-primary/30 hover:text-primary transition-colors">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-primary/30 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== TAB: CSV Import ===== */}
      {tab === 'csv' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 border border-primary/10 shadow-sm space-y-4">
            <h3 className="font-semibold text-primary text-lg">Import from CSV</h3>
            <p className="text-sm text-primary/50">
              CSV needs columns: <code className="bg-primary/5 px-1.5 py-0.5 rounded text-xs">topic, title_slug</code>
              &mdash; title, difficulty & tags are auto-fetched from LeetCode.
            </p>

            <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium cursor-pointer transition-colors">
              <Upload size={16} /> Choose CSV File
              <input type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
            </label>

            {csvData && (
              <>
                <div className="border border-primary/10 rounded-lg overflow-hidden">
                  <div className="bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
                    Preview: {csvData.length} rows
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-primary/10 text-primary/50">
                          <th className="py-2 px-3 text-left">Topic</th>
                          <th className="py-2 px-3 text-left">Slug</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-b border-primary/5">
                            <td className="py-1.5 px-3">{r.topic}</td>
                            <td className="py-1.5 px-3 font-mono text-primary/50">{r.slug}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleCsvImport} disabled={csvSaving}
                    className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-primary/40 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                    {csvSaving ? <><Loader2 size={16} className="animate-spin" /> Fetching & Importing...</> : `Fetch & Import ${csvData.length} Problems`}
                  </button>
                  <button onClick={() => setCsvData(null)}
                    className="px-6 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary/60 rounded-lg font-medium transition-colors">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
