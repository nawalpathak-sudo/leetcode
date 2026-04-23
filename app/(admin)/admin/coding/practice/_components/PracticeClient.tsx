'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, Edit3, Upload, Loader2, X, Check, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const TOPICS = [
  'Arrays', 'Strings', 'Linked List', 'Trees', 'Binary Search',
  'Dynamic Programming', 'Graph', 'Stack', 'Greedy', 'Backtracking',
  'Math', 'Bit Manipulation', 'Heap', 'Sliding Window', 'Two Pointers',
]

function extractSlug(input: string) {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/leetcode\.com\/problems\/([a-z0-9-]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-z0-9-]+$/.test(trimmed)) return trimmed
  return null
}

async function fetchLeetCodeProblem(titleSlug: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/quick-function`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ titleSlug }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const q = json.data?.question
    if (!q) return null
    const stats = q.stats ? JSON.parse(q.stats) : {}
    return {
      title: q.title,
      title_slug: q.titleSlug,
      question_id: q.questionFrontendId || q.questionId,
      difficulty: q.difficulty,
      tags: (q.topicTags || []).map((t: any) => t.name),
      ac_rate: q.acRate ? Math.round(q.acRate * 10) / 10 : 0,
    }
  } catch { return null }
}

export default function PracticeClient({ initialProblems, totalCount }: { initialProblems: any[]; totalCount: number }) {
  const [problems, setProblems] = useState(initialProblems)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Add-by-link state
  const [topic, setTopic] = useState('')
  const [customTopic, setCustomTopic] = useState('')
  const [linksText, setLinksText] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchResults, setFetchResults] = useState<any[] | null>(null)

  // Edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  // CSV state
  const [csvData, setCsvData] = useState<any[] | null>(null)
  const [csvSaving, setCsvSaving] = useState(false)
  const [tab, setTab] = useState('add')

  const reload = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('practice_problems')
      .select('*')
      .order('topic')
      .order('order_index')
      .order('created_at')
    setProblems(data || [])
    setLoading(false)
  }, [])

  // --- Fetch problems from LeetCode ---
  const handleFetch = async () => {
    const resolvedTopic = topic === '__custom__' ? customTopic.trim() : topic
    if (!resolvedTopic) { setMsg('Select a topic first.'); return }
    const lines = linksText.split('\n').map(l => l.trim()).filter(Boolean)
    const slugs = lines.map(extractSlug).filter(Boolean) as string[]
    if (slugs.length === 0) { setMsg('No valid LeetCode links or slugs found.'); return }
    const unique = [...new Set(slugs)]
    setFetching(true)
    setMsg('')
    setFetchResults(null)

    const results: any[] = unique.map(slug => ({ slug, status: 'loading', data: null }))
    setFetchResults([...results])

    for (let i = 0; i < unique.length; i++) {
      const data = await fetchLeetCodeProblem(unique[i])
      results[i] = data
        ? { slug: unique[i], status: 'ok', data: { ...data, topic: resolvedTopic } }
        : { slug: unique[i], status: 'error', data: null }
      setFetchResults([...results])
    }
    setFetching(false)
  }

  const handleSaveFetched = async () => {
    if (!fetchResults) return
    const toSave = fetchResults.filter(r => r.status === 'ok').map((r, i) => ({
      topic: r.data.topic, title: r.data.title, title_slug: r.data.title_slug,
      difficulty: r.data.difficulty, tags: r.data.tags || [], order_index: i,
    }))
    if (toSave.length === 0) return
    setFetching(true)
    const supabase = createClient()
    const { error } = await supabase.from('practice_problems').upsert(toSave, { onConflict: 'title_slug' })
    setFetching(false)
    if (!error) {
      setMsg(`Added ${toSave.length} problem${toSave.length > 1 ? 's' : ''}.`)
      setFetchResults(null)
      setLinksText('')
      reload()
    } else { setMsg('Error saving problems.') }
  }

  // --- Edit handlers ---
  const startEdit = (p: any) => {
    setEditId(p.id)
    setEditForm({
      topic: TOPICS.includes(p.topic) ? p.topic : '__custom__',
      customTopic: TOPICS.includes(p.topic) ? '' : p.topic,
      title: p.title, difficulty: p.difficulty,
      tags: (p.tags || []).join(', '), notes: p.notes || '', order_index: p.order_index || 0,
    })
  }

  const saveEdit = async () => {
    const resolvedTopic = editForm.topic === '__custom__' ? editForm.customTopic.trim() : editForm.topic
    if (!resolvedTopic || !editForm.title.trim()) return
    const existing = problems.find((p: any) => p.id === editId)
    const supabase = createClient()
    await supabase.from('practice_problems').upsert({
      id: editId, topic: resolvedTopic, title: editForm.title.trim(),
      title_slug: existing?.title_slug, difficulty: editForm.difficulty,
      tags: editForm.tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      notes: editForm.notes.trim(), order_index: Number(editForm.order_index) || 0,
    }, { onConflict: 'id' })
    setEditId(null)
    reload()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this problem?')) return
    const supabase = createClient()
    await supabase.from('practice_problems').delete().eq('id', id)
    reload()
  }

  // --- CSV handlers ---
  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    import('papaparse').then(Papa => {
      Papa.default.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const rows = results.data
            .filter((r: any) => r.topic && (r.title_slug || r.slug || r.link || r.url))
            .map((r: any) => {
              const slug = extractSlug(r.title_slug || r.slug || r.link || r.url || '')
              return slug ? { topic: r.topic.trim(), slug } : null
            })
            .filter(Boolean)
          setCsvData(rows)
        },
      })
    })
  }

  const handleCsvImport = async () => {
    if (!csvData?.length) return
    setCsvSaving(true)
    setMsg('')
    const fetched: any[] = []
    for (const row of csvData) {
      const data = await fetchLeetCodeProblem(row.slug)
      if (data) {
        fetched.push({
          topic: row.topic, title: data.title, title_slug: data.title_slug,
          difficulty: data.difficulty, tags: data.tags || [], order_index: fetched.length,
        })
      }
    }
    if (fetched.length > 0) {
      const supabase = createClient()
      const { error } = await supabase.from('practice_problems').upsert(fetched, { onConflict: 'title_slug' })
      if (!error) { setMsg(`Imported ${fetched.length} of ${csvData.length} problems.`); setCsvData(null); reload() }
      else setMsg('Error importing.')
    } else { setMsg('No problems could be fetched. Check slugs.') }
    setCsvSaving(false)
  }

  // --- Group problems by topic ---
  const grouped: Record<string, any[]> = {}
  for (const p of problems) {
    if (!grouped[p.topic]) grouped[p.topic] = []
    grouped[p.topic].push(p)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>LeetCode Corner</h2>
        <p className="mt-1" style={{ color: 'var(--color-text-secondary)' }}>Paste LeetCode links -- details are fetched automatically.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ key: 'add', label: 'Add Problems' }, { key: 'csv', label: 'Import CSV' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            style={{
              background: tab === t.key ? 'var(--color-primary)' : 'rgba(13,30,86,0.03)',
              color: tab === t.key ? 'var(--color-white)' : 'var(--color-text-secondary)',
              border: tab === t.key ? 'none' : '1px solid var(--color-border)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          msg.includes('Error') || msg.includes('No ') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
        }`}>{msg}</div>
      )}

      {/* TAB: Add by Links */}
      {tab === 'add' && (
        <div className="space-y-6">
          <div className="rounded-xl p-6 border shadow-sm space-y-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-primary)' }}>Add Problems</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Pick a topic, paste LeetCode links (one per line), and we will fetch title, difficulty & tags automatically.
            </p>

            {/* Topic selector */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Topic *</label>
              <select value={topic} onChange={e => setTopic(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}>
                <option value="">Select topic...</option>
                {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                <option value="__custom__">Custom...</option>
              </select>
              {topic === '__custom__' && (
                <input type="text" placeholder="Enter custom topic" value={customTopic}
                  onChange={e => setCustomTopic(e.target.value)}
                  className="mt-2 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }} />
              )}
            </div>

            {/* Links textarea */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>LeetCode Links or Slugs (one per line)</label>
              <textarea value={linksText} onChange={e => setLinksText(e.target.value)} rows={5}
                placeholder={"https://leetcode.com/problems/two-sum/\nhttps://leetcode.com/problems/best-time-to-buy-and-sell-stock/\ncontainer-with-most-water"}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none resize-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }} />
            </div>

            <button onClick={handleFetch} disabled={fetching}
              className="px-6 py-2.5 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}>
              {fetching ? <><Loader2 size={16} className="animate-spin" /> Fetching...</> : <><Plus size={16} /> Fetch & Preview</>}
            </button>

            {/* Fetch results preview */}
            {fetchResults && (
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <div className="px-4 py-2 text-sm font-medium flex items-center justify-between"
                  style={{ background: 'rgba(13,30,86,0.03)', color: 'var(--color-primary)' }}>
                  <span>Fetched {fetchResults.filter(r => r.status === 'ok').length} of {fetchResults.length}</span>
                  <button onClick={() => setFetchResults(null)} style={{ color: 'var(--color-text-secondary)' }}><X size={14} /></button>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
                  {fetchResults.map((r, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                      {r.status === 'loading' && <Loader2 size={14} className="animate-spin text-amber-500 shrink-0" />}
                      {r.status === 'ok' && <Check size={14} className="text-green-500 shrink-0" />}
                      {r.status === 'error' && <AlertCircle size={14} className="text-red-400 shrink-0" />}
                      {r.status === 'ok' ? (
                        <>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${r.data.difficulty === 'Easy' ? 'bg-green-400' : r.data.difficulty === 'Medium' ? 'bg-amber-400' : 'bg-red-400'}`} />
                          <span className="font-medium flex-1" style={{ color: 'var(--color-primary)' }}>{r.data.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${r.data.difficulty === 'Easy' ? 'bg-green-50 text-green-600' : r.data.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                            {r.data.difficulty}
                          </span>
                        </>
                      ) : (
                        <span className={`font-mono text-xs ${r.status === 'error' ? 'text-red-400' : ''}`} style={{ color: r.status !== 'error' ? 'var(--color-text-secondary)' : undefined }}>
                          {r.slug}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {fetchResults.some(r => r.status === 'ok') && !fetching && (
                  <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-border)', background: 'rgba(13,30,86,0.01)' }}>
                    <button onClick={handleSaveFetched}
                      className="px-6 py-2.5 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      style={{ background: 'var(--color-primary)' }}>
                      <Plus size={16} /> Save {fetchResults.filter(r => r.status === 'ok').length} Problem{fetchResults.filter(r => r.status === 'ok').length > 1 ? 's' : ''}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Problem List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-ambient)', borderRightColor: 'transparent' }} />
            </div>
          ) : problems.length === 0 ? (
            <div className="px-6 py-4 rounded-lg text-center" style={{ background: 'rgba(59,195,226,0.1)', border: '1px solid rgba(59,195,226,0.3)', color: 'var(--color-primary)' }}>
              No problems yet. Add some above or import a CSV.
            </div>
          ) : (
            Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([topicName, items]) => (
              <div key={topicName} className="rounded-xl border shadow-sm overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="px-5 py-3 border-b" style={{ background: 'rgba(13,30,86,0.03)', borderColor: 'var(--color-border)' }}>
                  <h4 className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {topicName} <span style={{ color: 'var(--color-text-secondary)' }} className="font-normal">({items.length})</span>
                  </h4>
                </div>
                <div className="divide-y" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
                  {items.map((p: any) => editId === p.id ? (
                    <div key={p.id} className="px-5 py-3 space-y-3 bg-amber-50/30">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <select value={editForm.topic} onChange={e => setEditForm((f: any) => ({ ...f, topic: e.target.value }))}
                          className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)' }}>
                          {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                          <option value="__custom__">Custom</option>
                        </select>
                        <input value={editForm.title} onChange={e => setEditForm((f: any) => ({ ...f, title: e.target.value }))}
                          className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)' }} placeholder="Title" />
                        <div className="flex gap-1">
                          {['Easy', 'Medium', 'Hard'].map(d => (
                            <button key={d} onClick={() => setEditForm((f: any) => ({ ...f, difficulty: d }))}
                              className={`flex-1 py-1 rounded text-[10px] font-medium ${
                                editForm.difficulty === d
                                  ? d === 'Easy' ? 'bg-green-100 text-green-700' : d === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-400'
                              }`}>{d}</button>
                          ))}
                        </div>
                        <input value={editForm.notes} onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                          className="border rounded px-2 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)' }} placeholder="Notes" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="px-4 py-1.5 text-white rounded text-xs font-medium" style={{ background: 'var(--color-primary)' }}>Save</button>
                        <button onClick={() => setEditId(null)} className="px-4 py-1.5 rounded text-xs" style={{ background: 'rgba(13,30,86,0.03)', color: 'var(--color-text-secondary)' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-[rgba(13,30,86,0.01)] transition-colors">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${p.difficulty === 'Easy' ? 'bg-green-400' : p.difficulty === 'Medium' ? 'bg-amber-400' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{p.title}</span>
                        {p.notes && <span className="text-xs ml-2" style={{ color: 'var(--color-text-secondary)' }}>&mdash; {p.notes}</span>}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${p.difficulty === 'Easy' ? 'bg-green-50 text-green-600' : p.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                        {p.difficulty}
                      </span>
                      {(p.tags || []).length > 0 && (
                        <div className="hidden sm:flex gap-1">
                          {p.tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(13,30,86,0.03)', color: 'var(--color-text-secondary)' }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <button onClick={() => startEdit(p)} className="p-1.5 rounded hover:bg-[rgba(13,30,86,0.05)] transition-colors" style={{ color: 'var(--color-text-secondary)' }}>
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-500 transition-colors">
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

      {/* TAB: CSV Import */}
      {tab === 'csv' && (
        <div className="space-y-6">
          <div className="rounded-xl p-6 border shadow-sm space-y-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold text-lg" style={{ color: 'var(--color-primary)' }}>Import from CSV</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              CSV needs columns: <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(13,30,86,0.03)' }}>topic, title_slug</code>
              -- title, difficulty & tags are auto-fetched from LeetCode.
            </p>

            <label className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-medium cursor-pointer transition-colors"
              style={{ background: 'var(--color-primary)' }}>
              <Upload size={16} /> Choose CSV File
              <input type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
            </label>

            {csvData && (
              <>
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="px-4 py-2 text-sm font-medium" style={{ background: 'rgba(13,30,86,0.03)', color: 'var(--color-primary)' }}>
                    Preview: {csvData.length} rows
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          <th className="py-2 px-3 text-left">Topic</th>
                          <th className="py-2 px-3 text-left">Slug</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.slice(0, 50).map((r, i) => (
                          <tr key={i} className="border-b" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
                            <td className="py-1.5 px-3">{r.topic}</td>
                            <td className="py-1.5 px-3 font-mono" style={{ color: 'var(--color-text-secondary)' }}>{r.slug}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleCsvImport} disabled={csvSaving}
                    className="px-6 py-2.5 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-40"
                    style={{ background: 'var(--color-primary)' }}>
                    {csvSaving ? <><Loader2 size={16} className="animate-spin" /> Fetching & Importing...</> : `Fetch & Import ${csvData.length} Problems`}
                  </button>
                  <button onClick={() => setCsvData(null)}
                    className="px-6 py-2.5 rounded-lg font-medium transition-colors"
                    style={{ background: 'rgba(13,30,86,0.03)', color: 'var(--color-text-secondary)' }}>
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
