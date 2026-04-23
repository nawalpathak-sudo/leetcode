'use client'

import { useState, useEffect } from 'react'
import { Search, ExternalLink } from 'lucide-react'
import { createAmcatClient } from '@/lib/supabase/client'

const AMCAT_MODULES: Record<string, any[]> = {
  aptitude: [
    { name: 'Quantitative Ability', main: 'quantitative_score', subs: [
      { label: 'Number Theory', key: 'quant_number_theory' },
      { label: 'Basic Numbers', key: 'quant_basic_numbers' },
      { label: 'Applied Math', key: 'quant_applied_math' },
    ]},
    { name: 'English Comprehension', main: 'english_score', subs: [
      { label: 'Vocabulary', key: 'english_vocabulary' },
      { label: 'Grammar', key: 'english_grammar' },
      { label: 'Comprehension', key: 'english_comprehension' },
    ]},
    { name: 'Logical Ability', main: 'logical_score', subs: [
      { label: 'Inductive', key: 'logical_inductive' },
      { label: 'Deductive', key: 'logical_deductive' },
    ]},
  ],
  automata: [
    { name: 'Automata', main: 'automata_score', subs: [
      { label: 'Prog. Ability', key: 'automata_programming_ability' },
      { label: 'Prog. Practices', key: 'automata_programming_practices' },
      { label: 'Correctness', key: 'automata_functional_correctness' },
      { label: 'Runtime Complexity', key: 'automata_runtime_complexity' },
    ]},
  ],
  ds: [
    { name: 'Data Structures', main: 'ds_score', subs: [
      { label: 'Basics & Linked Lists', key: 'ds_basics_linked_lists' },
      { label: 'Sorting & Searching', key: 'ds_sorting_searching' },
      { label: 'Stacks & Queues', key: 'ds_stacks_queues' },
      { label: 'Trees & Graphs', key: 'ds_trees_graphs' },
    ]},
  ],
  svar: [
    { name: 'SVAR Spoken English', main: 'svar_spoken_english_score', subs: [
      { label: 'Understanding', key: 'svar_understanding' },
      { label: 'Vocabulary', key: 'svar_vocabulary' },
      { label: 'Articulation', key: 'svar_articulation' },
      { label: 'Grammar', key: 'svar_grammar' },
      { label: 'Pronunciation', key: 'svar_pronunciation' },
      { label: 'Fluency', key: 'svar_fluency' },
      { label: 'Active Listening', key: 'svar_active_listening' },
    ]},
  ],
  webdev: [
    { name: 'Web Development', main: 'webdev_score', subs: [
      { label: 'Software Testing', key: 'webdev_software_testing' },
      { label: 'JavaScript', key: 'webdev_javascript' },
      { label: 'HTML', key: 'webdev_html' },
    ]},
  ],
  writex: [
    { name: 'WriteX', main: 'writex_total_score', subs: [
      { label: 'Content', key: 'writex_content_score' },
      { label: 'Grammar', key: 'writex_grammar_score' },
    ]},
  ],
}

function getActiveModules(group: string) {
  if (group === 'all') return [...AMCAT_MODULES.aptitude, ...AMCAT_MODULES.automata, ...AMCAT_MODULES.ds, ...AMCAT_MODULES.svar, ...AMCAT_MODULES.webdev, ...AMCAT_MODULES.writex]
  return AMCAT_MODULES[group] || []
}

function fmtScore(v: any) {
  if (v === null || v === undefined) return '\u2014'
  return Number(v).toFixed(1)
}

function avgScore(data: any[], field: string) {
  const vals = data.map(d => d[field]).filter((v: any) => v != null)
  if (!vals.length) return null
  return vals.reduce((a: number, b: number) => a + Number(b), 0) / vals.length
}

function minScore(data: any[], field: string) {
  const vals = data.map(d => d[field]).filter((v: any) => v != null).map(Number)
  return vals.length ? Math.min(...vals) : null
}

function maxScore(data: any[], field: string) {
  const vals = data.map(d => d[field]).filter((v: any) => v != null).map(Number)
  return vals.length ? Math.max(...vals) : null
}

function Spinner() {
  return (
    <div className="text-center py-8">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: 'var(--color-ambient)', borderRightColor: 'transparent' }} />
    </div>
  )
}

export default function AmcatClient() {
  const [allAmcat, setAllAmcat] = useState<any[]>([])
  const [allSvar, setAllSvar] = useState<any[]>([])
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Filters
  const [campusFilter, setCampusFilter] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [assessmentFilter, setAssessmentFilter] = useState('')
  const [moduleGroup, setModuleGroup] = useState('all')

  // Report state
  const [reportData, setReportData] = useState<any[] | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [rankModule, setRankModule] = useState('')
  const [rankType, setRankType] = useState('top')
  const [distModule, setDistModule] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const amcatSupabase = createAmcatClient()
        const [amcatRes, svarRes, assessRes] = await Promise.all([
          amcatSupabase.from('amcat_results').select('*, amcat_assessments(assessment_name, test_date, amcat_campuses(campus_name), amcat_batches(batch_name))'),
          amcatSupabase.from('svar_results').select('*, amcat_assessments(assessment_name, test_date, amcat_campuses(campus_name), amcat_batches(batch_name))'),
          amcatSupabase.from('amcat_assessments').select('*, amcat_campuses(campus_name), amcat_batches(batch_name), amcat_exam_categories(category_name)').order('test_date', { ascending: false }),
        ])
        setAllAmcat(amcatRes.data || [])
        setAllSvar(svarRes.data || [])
        setAssessments(assessRes.data || [])
      } catch (err) {
        console.error('AMCAT load error:', err)
      }
      setLoading(false)
    })()
  }, [])

  const campuses = [...new Set(assessments.map((a: any) => a.amcat_campuses?.campus_name).filter(Boolean))].sort()
  const filteredAssessments = assessments.filter((a: any) => {
    if (campusFilter && a.amcat_campuses?.campus_name !== campusFilter) return false
    if (batchFilter && a.amcat_batches?.batch_name !== batchFilter) return false
    return true
  })
  const batches = [...new Set(
    assessments.filter((a: any) => !campusFilter || a.amcat_campuses?.campus_name === campusFilter)
      .map((a: any) => a.amcat_batches?.batch_name).filter(Boolean)
  )].sort()

  const totalStudents = new Set(allAmcat.map((r: any) => r.tag3 || r.email).filter(Boolean)).size

  const generateReport = () => {
    setGenerating(true)
    let data = [...allAmcat]
    if (campusFilter) data = data.filter(d => d.amcat_assessments?.amcat_campuses?.campus_name === campusFilter)
    if (batchFilter) data = data.filter(d => d.amcat_assessments?.amcat_batches?.batch_name === batchFilter)
    if (assessmentFilter) data = data.filter(d => String(d.assessment_id) === assessmentFilter)

    let svar = [...allSvar]
    if (campusFilter) svar = svar.filter(d => d.amcat_assessments?.amcat_campuses?.campus_name === campusFilter)
    if (batchFilter) svar = svar.filter(d => d.amcat_assessments?.amcat_batches?.batch_name === batchFilter)

    const svarLookup: Record<string, any> = {}
    svar.forEach(r => {
      const key = r.tag3 || r.email || r.email_invited
      if (key) svarLookup[key] = r
    })

    const amcatKeys = new Set<string>()
    data.forEach(r => {
      const key = r.tag3 || r.email || r.email_invited
      if (key) {
        amcatKeys.add(key)
        const sv = svarLookup[key]
        if (sv) {
          r.svar_spoken_english_score = sv.svar_spoken_english_score
          r.svar_spoken_english_cefr_level = sv.svar_spoken_english_cefr_level
          r.svar_understanding = sv.svar_understanding
          r.svar_vocabulary = sv.svar_vocabulary
          r.svar_articulation = sv.svar_articulation
          r.svar_grammar = sv.svar_grammar
          r.svar_pronunciation = sv.svar_pronunciation
          r.svar_fluency = sv.svar_fluency
          r.svar_active_listening = sv.svar_active_listening
          if (sv.report_url) r.svar_report_url = sv.report_url
        }
      }
    })

    svar.forEach(r => {
      const key = r.tag3 || r.email || r.email_invited
      if (key && !amcatKeys.has(key)) {
        data.push({
          tag3: r.tag3, email: r.email, email_invited: r.email_invited,
          full_name: r.full_name, name_invited: r.name_invited,
          participant_status: r.participant_status, amcat_assessments: r.amcat_assessments,
          svar_spoken_english_score: r.svar_spoken_english_score,
          svar_spoken_english_cefr_level: r.svar_spoken_english_cefr_level,
          svar_understanding: r.svar_understanding, svar_vocabulary: r.svar_vocabulary,
          svar_articulation: r.svar_articulation, svar_grammar: r.svar_grammar,
          svar_pronunciation: r.svar_pronunciation, svar_fluency: r.svar_fluency,
          svar_active_listening: r.svar_active_listening, report_url: r.report_url,
        })
      }
    })

    const modules = getActiveModules(moduleGroup)
    if (modules.length > 0) {
      setRankModule(modules[0].main)
      setDistModule(modules[0].main)
    }
    setReportData(data)
    setGenerating(false)
  }

  const exportCSV = () => {
    if (!reportData?.length) return
    const modules = getActiveModules(moduleGroup)
    const headers = ['Lead ID', 'Name', 'Email', 'Status']
    const fields = ['tag3', 'full_name', 'email', 'participant_status']
    modules.forEach((m: any) => {
      headers.push(m.name); fields.push(m.main)
      m.subs.forEach((s: any) => { headers.push(s.label); fields.push(s.key) })
    })
    headers.push('Report URL'); fields.push('report_url')

    let csv = headers.map(h => `"${h}"`).join(',') + '\n'
    reportData.forEach(d => {
      csv += fields.map(f => {
        const v = d[f]
        if (v == null) return ''
        return `"${String(v).replace(/"/g, '""')}"`
      }).join(',') + '\n'
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `amcat_report_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <Spinner />

  const modules = getActiveModules(moduleGroup)

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'TOTAL STUDENTS', value: totalStudents },
          { label: 'AMCAT RESULTS', value: allAmcat.length },
          { label: 'SVAR RESULTS', value: allSvar.length },
          { label: 'ASSESSMENTS', value: assessments.length },
        ].map(s => (
          <div key={s.label} className="rounded-xl border shadow-sm p-6 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>{s.value}</div>
            <div className="text-xs mt-1 tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Card */}
      <div className="rounded-xl p-6 border shadow-sm space-y-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div>
          <h3 className="font-semibold text-lg" style={{ color: 'var(--color-primary)' }}>View AMCAT Assessment</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Filter AMCAT results by campus, batch, or assessment to view performance and individual reports.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-primary)' }}>Campus</label>
            <select value={campusFilter} onChange={e => { setCampusFilter(e.target.value); setBatchFilter(''); setAssessmentFilter('') }}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
              <option value="">All Campuses</option>
              {campuses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-primary)' }}>Batch</label>
            <select value={batchFilter} onChange={e => { setBatchFilter(e.target.value); setAssessmentFilter('') }}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
              <option value="">All Batches</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-primary)' }}>Assessment</label>
            <select value={assessmentFilter} onChange={e => setAssessmentFilter(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
              <option value="">All Assessments</option>
              {filteredAssessments.map((a: any) => <option key={a.id} value={a.id}>{a.assessment_name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-primary)' }}>Module Group</label>
          <select value={moduleGroup} onChange={e => setModuleGroup(e.target.value)}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)', background: 'var(--color-surface)' }}>
            <option value="all">All Modules</option>
            <option value="aptitude">Aptitude (Quantitative + English + Logical)</option>
            <option value="automata">Automata (Coding)</option>
            <option value="ds">Data Structures</option>
            <option value="svar">SVAR (Spoken English)</option>
            <option value="webdev">Web Development</option>
            <option value="writex">WriteX (Writing)</option>
          </select>
        </div>

        <button onClick={generateReport} disabled={generating}
          className="px-6 py-2.5 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          style={{ background: 'var(--color-primary)' }}>
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {/* Report Results */}
      {reportData && (
        <>
          {/* Summary Stats */}
          <div className="rounded-xl p-6 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap gap-3 justify-center">
              <div className="rounded-xl px-5 py-3 text-center min-w-[120px]" style={{ background: 'rgba(13,30,86,0.03)' }}>
                <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{reportData.length}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Total</div>
              </div>
              {modules.map((m: any) => {
                const a = avgScore(reportData, m.main)
                return (
                  <div key={m.main} className="rounded-xl px-5 py-3 text-center min-w-[120px]" style={{ background: 'rgba(13,30,86,0.03)' }}>
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{fmtScore(a)}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Avg {m.name}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Module Breakdown */}
          <div className="rounded-xl p-6 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold text-lg mb-4" style={{ color: 'var(--color-primary)' }}>Module Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: 'rgba(13,30,86,0.03)' }}>
                  <tr>
                    <th className="py-2.5 px-3 text-left font-medium" style={{ color: 'var(--color-text-secondary)' }}>Module / Subsection</th>
                    <th className="py-2.5 px-3 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>Avg</th>
                    <th className="py-2.5 px-3 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>Min</th>
                    <th className="py-2.5 px-3 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>Max</th>
                    <th className="py-2.5 px-3 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
                  {modules.map((m: any) => (
                    <tbody key={m.main}>
                      <tr style={{ background: 'rgba(59,195,226,0.05)' }} className="font-semibold">
                        <td className="py-2.5 px-3" style={{ color: 'var(--color-primary)' }}>{m.name}</td>
                        <td className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-primary)' }}>{fmtScore(avgScore(reportData, m.main))}</td>
                        <td className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtScore(minScore(reportData, m.main))}</td>
                        <td className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtScore(maxScore(reportData, m.main))}</td>
                        <td className="py-2.5 px-3 text-right" style={{ color: 'var(--color-text-secondary)' }}>{reportData.filter(d => d[m.main] != null).length}</td>
                      </tr>
                      {m.subs.map((s: any) => (
                        <tr key={s.key}>
                          <td className="py-2 px-3 pl-8" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</td>
                          <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtScore(avgScore(reportData, s.key))}</td>
                          <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtScore(minScore(reportData, s.key))}</td>
                          <td className="py-2 px-3 text-right font-mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtScore(maxScore(reportData, s.key))}</td>
                          <td className="py-2 px-3 text-right" style={{ color: 'var(--color-text-secondary)' }}>{reportData.filter(d => d[s.key] != null).length}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Score Distribution */}
          {modules.length > 0 && (
            <div className="rounded-xl p-6 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold text-lg mb-4" style={{ color: 'var(--color-primary)' }}>Score Distribution</h3>
              <select value={distModule} onChange={e => setDistModule(e.target.value)}
                className="mb-4 border rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}>
                {modules.map((m: any) => <option key={m.main} value={m.main}>{m.name}</option>)}
              </select>
              <ScoreDistribution data={reportData} field={distModule} />
            </div>
          )}

          {/* Rankings */}
          {modules.length > 0 && (
            <div className="rounded-xl p-6 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold text-lg mb-4" style={{ color: 'var(--color-primary)' }}>Rankings</h3>
              <div className="flex gap-3 mb-4">
                <select value={rankModule} onChange={e => setRankModule(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}>
                  {modules.map((m: any) => <option key={m.main} value={m.main}>{m.name}</option>)}
                </select>
                <select value={rankType} onChange={e => setRankType(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}>
                  <option value="top">Top 10</option>
                  <option value="bottom">Bottom 10</option>
                </select>
              </div>
              <RankingsTable data={reportData} field={rankModule} type={rankType} />
            </div>
          )}

          {/* Individual Results */}
          <div className="rounded-xl p-6 border shadow-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h3 className="font-semibold text-lg" style={{ color: 'var(--color-primary)' }}>Individual Results</h3>
              <div className="flex gap-2">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
                  <input type="text" placeholder="Search by name or lead ID..."
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none w-56"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }} />
                </div>
                <button onClick={exportCSV}
                  className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'var(--color-primary)' }}>
                  Export CSV
                </button>
              </div>
            </div>
            <IndividualResultsTable data={reportData} modules={modules} moduleGroup={moduleGroup} searchQuery={searchQuery} />
          </div>
        </>
      )}
    </div>
  )
}

function ScoreDistribution({ data, field }: { data: any[]; field: string }) {
  const vals = data.map(d => d[field]).filter((v: any) => v != null).map(Number)
  if (!vals.length) return <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>No data available for this module.</p>

  const maxVal = Math.max(...vals)
  const bucketSize = maxVal <= 100 ? 20 : maxVal <= 500 ? 100 : 200
  const bucketLabels: string[] = []
  const buckets: Record<string, number> = {}
  for (let i = 0; i <= maxVal; i += bucketSize) {
    const label = `${i}-${i + bucketSize}`
    bucketLabels.push(label)
    buckets[label] = 0
  }
  vals.forEach(v => {
    const idx = Math.min(Math.floor(v / bucketSize), bucketLabels.length - 1)
    buckets[bucketLabels[idx]]++
  })
  const maxCount = Math.max(...Object.values(buckets))
  const total = vals.length
  const lowCount = vals.filter(v => v < 35).length
  const midCount = vals.filter(v => v >= 35 && v <= 60).length
  const highCount = vals.filter(v => v > 60).length

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-[2] space-y-2">
        {bucketLabels.map(label => {
          const count = buckets[label]
          const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0
          const sharePct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
          return (
            <div key={label} className="flex items-center gap-3">
              <span className="w-16 text-right text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
              <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: 'rgba(13,30,86,0.03)' }}>
                <div className="h-full rounded transition-all" style={{ background: 'var(--color-ambient)', width: `${widthPct}%` }} />
              </div>
              <span className="w-20 text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{count} ({sharePct}%)</span>
            </div>
          )
        })}
      </div>
      <div className="flex-1 border-l pl-4 text-sm space-y-3" style={{ borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}>
        <div className="font-semibold mb-2">Placement Benchmark</div>
        <div>
          <div className="font-semibold text-red-600">&lt;35% Score</div>
          <div style={{ color: 'var(--color-text-secondary)' }}>Low Likelihood -- {total > 0 ? ((lowCount / total) * 100).toFixed(1) : 0}%</div>
        </div>
        <div>
          <div className="font-semibold text-amber-600">35-60% Score</div>
          <div style={{ color: 'var(--color-text-secondary)' }}>Average Likelihood -- {total > 0 ? ((midCount / total) * 100).toFixed(1) : 0}%</div>
        </div>
        <div>
          <div className="font-semibold text-green-600">&gt;60% Score</div>
          <div style={{ color: 'var(--color-text-secondary)' }}>High Likelihood -- {total > 0 ? ((highCount / total) * 100).toFixed(1) : 0}%</div>
        </div>
      </div>
    </div>
  )
}

function RankingsTable({ data, field, type }: { data: any[]; field: string; type: string }) {
  const scored = data
    .filter(d => d[field] != null)
    .map(d => ({ name: d.full_name || d.name_invited || '\u2014', lead_id: d.tag3 || '\u2014', score: Number(d[field]), status: d.participant_status || '\u2014' }))
  scored.sort((a, b) => type === 'top' ? b.score - a.score : a.score - b.score)
  const top = scored.slice(0, 10)

  if (!top.length) return <p className="text-sm py-4" style={{ color: 'var(--color-text-secondary)' }}>No data available.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead style={{ background: 'rgba(13,30,86,0.03)' }}>
          <tr>
            <th className="py-2.5 px-3 text-left font-medium" style={{ color: 'var(--color-text-secondary)' }}>Rank</th>
            <th className="py-2.5 px-3 text-left font-medium" style={{ color: 'var(--color-text-secondary)' }}>Name</th>
            <th className="py-2.5 px-3 text-left font-medium" style={{ color: 'var(--color-text-secondary)' }}>Lead ID</th>
            <th className="py-2.5 px-3 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>Score</th>
            <th className="py-2.5 px-3 text-left font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
          {top.map((s, i) => (
            <tr key={i}>
              <td className="py-2.5 px-3 font-semibold" style={{ color: 'var(--color-primary)' }}>{i + 1}</td>
              <td className="py-2.5 px-3" style={{ color: 'var(--color-primary)' }}>{s.name}</td>
              <td className="py-2.5 px-3 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.lead_id}</td>
              <td className="py-2.5 px-3 text-right font-mono font-semibold" style={{ color: 'var(--color-primary)' }}>{fmtScore(s.score)}</td>
              <td className="py-2.5 px-3" style={{ color: 'var(--color-text-secondary)' }}>{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IndividualResultsTable({ data, modules, moduleGroup, searchQuery }: { data: any[]; modules: any[]; moduleGroup: string; searchQuery: string }) {
  let filtered = data
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = data.filter(d => {
      const name = (d.full_name || d.name_invited || '').toLowerCase()
      const leadId = (d.tag3 || '').toLowerCase()
      const email = (d.email || '').toLowerCase()
      return name.includes(q) || leadId.includes(q) || email.includes(q)
    })
  }

  if (!filtered.length) return <p className="text-sm py-4" style={{ color: 'var(--color-text-secondary)' }}>No results found.</p>

  return (
    <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead style={{ background: 'rgba(13,30,86,0.03)', color: 'var(--color-text-secondary)' }}>
          <tr>
            <th className="py-2.5 px-3 text-left font-medium">Lead ID</th>
            <th className="py-2.5 px-3 text-left font-medium">Name</th>
            <th className="py-2.5 px-3 text-left font-medium">Email</th>
            <th className="py-2.5 px-3 text-left font-medium">Status</th>
            {modules.map((m: any) => (
              <th key={m.main} className="py-2.5 px-3 text-right font-medium">{m.name}</th>
            ))}
            {moduleGroup !== 'all' && modules.map((m: any) => m.subs.map((s: any) => (
              <th key={s.key} className="py-2.5 px-3 text-right font-medium" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</th>
            )))}
            <th className="py-2.5 px-3 text-center font-medium">Report</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'rgba(13,30,86,0.05)' }}>
          {filtered.map((d: any, i: number) => (
            <tr key={i} className="hover:bg-[rgba(13,30,86,0.01)]">
              <td className="py-2.5 px-3 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{d.tag3 || '\u2014'}</td>
              <td className="py-2.5 px-3 font-medium" style={{ color: 'var(--color-primary)' }}>{d.full_name || d.name_invited || '\u2014'}</td>
              <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{d.email || d.email_invited || '\u2014'}</td>
              <td className="py-2.5 px-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{d.participant_status || '\u2014'}</td>
              {modules.map((m: any) => (
                <td key={m.main} className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-primary)' }}>{fmtScore(d[m.main])}</td>
              ))}
              {moduleGroup !== 'all' && modules.map((m: any) => m.subs.map((s: any) => (
                <td key={s.key} className="py-2.5 px-3 text-right font-mono" style={{ color: 'var(--color-text-secondary)' }}>{fmtScore(d[s.key])}</td>
              )))}
              <td className="py-2.5 px-3 text-center">
                {(d.report_url || d.svar_report_url) && (
                  <a href={d.report_url || d.svar_report_url} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--color-ambient)' }}>
                    <ExternalLink size={14} />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
