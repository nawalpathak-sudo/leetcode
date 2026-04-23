'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts'
import {
  BarChart3, Users, Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus,
  AlertTriangle, Award, Target, Layers, Globe, BookOpen, ChevronDown, ChevronUp, UserCheck, UserX
} from 'lucide-react'

// --- Types ---

interface Campus { id: number; campus_name: string }
interface Batch { id: number; batch_name: string }
interface Assessment {
  id: string
  assessment_name: string
  test_date: string
  campus_id: number
  batch_id: number
  category_ids: number[]
}
interface StudentOption { lead_id: string; student_name: string; college: string; batch: string }

type Parameter = 'all' | 'aptitude' | 'dsa' | 'automata' | 'svar' | 'webdev' | 'writex'
type ViewMode = 'campus' | 'student'

// --- Constants ---

const PARAMETER_CONFIG: Record<Parameter, {
  label: string
  lines: { key: string; label: string; color: string; svarKey?: string }[]
  table: 'amcat_results' | 'svar_results'
}> = {
  all: {
    label: 'All Parameters',
    table: 'amcat_results',
    lines: [
      { key: 'quantitative_score', label: 'Quantitative', color: '#3BC3E2' },
      { key: 'english_score', label: 'English', color: '#0D1E56' },
      { key: 'logical_score', label: 'Logical', color: '#22ACD1' },
      { key: 'ds_score', label: 'DSA', color: '#6366F1' },
      { key: 'automata_score', label: 'Automata', color: '#F59E0B' },
      { key: 'webdev_score', label: 'Web Dev', color: '#EF4444' },
      { key: 'writex_total_score', label: 'WriteX', color: '#10B981' },
    ],
  },
  aptitude: {
    label: 'Aptitude',
    table: 'amcat_results',
    lines: [
      { key: 'quantitative_score', label: 'Quantitative', color: '#3BC3E2' },
      { key: 'english_score', label: 'English', color: '#0D1E56' },
      { key: 'logical_score', label: 'Logical', color: '#22ACD1' },
    ],
  },
  dsa: {
    label: 'DSA',
    table: 'amcat_results',
    lines: [
      { key: 'ds_score', label: 'Data Structures', color: '#3BC3E2' },
    ],
  },
  automata: {
    label: 'Automata',
    table: 'amcat_results',
    lines: [
      { key: 'automata_score', label: 'Automata', color: '#0D1E56' },
    ],
  },
  svar: {
    label: 'SVAR',
    table: 'svar_results',
    lines: [
      { key: 'svar_spoken_english_score', label: 'Spoken English', color: '#0D1E56' },
      { key: 'svar_understanding', label: 'Understanding', color: '#3BC3E2' },
      { key: 'svar_vocabulary', label: 'Vocabulary', color: '#22ACD1' },
      { key: 'svar_grammar', label: 'Grammar', color: '#6366F1' },
    ],
  },
  webdev: {
    label: 'Web Development',
    table: 'amcat_results',
    lines: [
      { key: 'webdev_score', label: 'Web Dev Overall', color: '#0D1E56' },
      { key: 'webdev_software_testing', label: 'Software Testing', color: '#3BC3E2' },
      { key: 'webdev_javascript', label: 'JavaScript', color: '#22ACD1' },
      { key: 'webdev_html', label: 'HTML', color: '#6366F1' },
    ],
  },
  writex: {
    label: 'WriteX',
    table: 'amcat_results',
    lines: [
      { key: 'writex_total_score', label: 'Total Score', color: '#0D1E56' },
      { key: 'writex_content_score', label: 'Content', color: '#3BC3E2' },
      { key: 'writex_grammar_score', label: 'Grammar', color: '#22ACD1' },
    ],
  },
}

const LINE_COLORS = ['#3BC3E2', '#0D1E56', '#22ACD1', '#6366F1', '#F59E0B', '#EF4444']

const INDUSTRY_BENCHMARKS: Record<string, number> = {
  quantitative_score: 55,
  english_score: 50,
  logical_score: 45,
  automata_score: 50,
  ds_score: 50,
  webdev_score: 50,
  svar_spoken_english_score: 55,
}

const SUBTOPIC_MAP: Record<string, { key: string; label: string }[]> = {
  quantitative_score: [
    { key: 'quant_number_theory', label: 'Number Theory' },
    { key: 'quant_basic_numbers', label: 'Basic Numbers' },
    { key: 'quant_applied_math', label: 'Applied Math' },
  ],
  english_score: [
    { key: 'english_vocabulary', label: 'Vocabulary' },
    { key: 'english_grammar', label: 'Grammar' },
    { key: 'english_comprehension', label: 'Comprehension' },
  ],
  logical_score: [
    { key: 'logical_inductive', label: 'Inductive' },
    { key: 'logical_deductive', label: 'Deductive' },
  ],
  automata_score: [
    { key: 'automata_programming_ability', label: 'Programming Ability' },
    { key: 'automata_programming_practices', label: 'Programming Practices' },
    { key: 'automata_functional_correctness', label: 'Functional Correctness' },
    { key: 'automata_runtime_complexity', label: 'Runtime Complexity' },
  ],
  ds_score: [
    { key: 'ds_basics_linked_lists', label: 'Basics & Linked Lists' },
    { key: 'ds_sorting_searching', label: 'Sorting & Searching' },
    { key: 'ds_stacks_queues', label: 'Stacks & Queues' },
    { key: 'ds_trees_graphs', label: 'Trees & Graphs' },
  ],
  webdev_score: [
    { key: 'webdev_software_testing', label: 'Software Testing' },
    { key: 'webdev_javascript', label: 'JavaScript' },
    { key: 'webdev_html', label: 'HTML' },
  ],
  writex_total_score: [
    { key: 'writex_content_score', label: 'Content' },
    { key: 'writex_grammar_score', label: 'Grammar' },
  ],
  svar_spoken_english_score: [
    { key: 'svar_understanding', label: 'Understanding' },
    { key: 'svar_vocabulary', label: 'Vocabulary' },
    { key: 'svar_articulation', label: 'Articulation' },
    { key: 'svar_grammar', label: 'Grammar' },
    { key: 'svar_pronunciation', label: 'Pronunciation' },
    { key: 'svar_fluency', label: 'Fluency' },
    { key: 'svar_active_listening', label: 'Active Listening' },
  ],
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const SCORE_BUCKETS = ['0-25', '25-50', '50-75', '75-100']

function fmtScore(v: number | null | undefined): string {
  if (v === null || v === undefined) return '\u2014'
  return Number(v).toFixed(1)
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getBucket(score: number): string {
  if (score < 25) return '0-25'
  if (score < 50) return '25-50'
  if (score < 75) return '50-75'
  return '75-100'
}

function subtopicColor(avg: number): string {
  if (avg < 35) return '#EF4444'
  if (avg <= 50) return '#F59E0B'
  return '#22C55E'
}

// --- Skeleton ---

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <Skeleton className="h-5 w-48 mb-4" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <Skeleton className="h-5 w-40 mb-4" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full mb-2" />
      ))}
    </div>
  )
}

// --- Progress Ring ---
function ProgressRing({ percent, size = 80, strokeWidth = 8 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} stroke="#E2E8F0" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth}
        stroke={percent >= 50 ? '#22C55E' : percent >= 25 ? '#F59E0B' : '#EF4444'}
        fill="none" strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" className="transition-all duration-500"
      />
    </svg>
  )
}

// --- Main Component ---

export default function ComparisonClient() {
  const supabase = useMemo(() => createClient(), [])

  // Shared state
  const [view, setView] = useState<ViewMode>('campus')
  const [parameter, setParameter] = useState<Parameter>('all')
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedCampus, setSelectedCampus] = useState<number | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  // Campus view state
  const [campusChartData, setCampusChartData] = useState<any[]>([])
  const [campusTableData, setCampusTableData] = useState<any[]>([])
  const [movementData, setMovementData] = useState<any[]>([])

  // Student view state
  const [studentSearch, setStudentSearch] = useState('')
  const [studentResults, setStudentResults] = useState<StudentOption[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null)
  const [studentChartData, setStudentChartData] = useState<any[]>([])
  const [studentTableData, setStudentTableData] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // New section states
  const [distributionData, setDistributionData] = useState<any>(null)
  const [participationData, setParticipationData] = useState<any>(null)
  const [placementReadiness, setPlacementReadiness] = useState<any>(null)
  const [subtopicData, setSubtopicData] = useState<any[]>([])
  const [campusCompareData, setCampusCompareData] = useState<any[]>([])
  const [cefrData, setCefrData] = useState<any>(null)
  const [improversData, setImproversData] = useState<any>(null)
  const [showCampusCompare, setShowCampusCompare] = useState(false)

  // Load campuses and batches on mount
  useEffect(() => {
    async function load() {
      const [campusRes, batchRes] = await Promise.all([
        supabase.from('amcat_campuses').select('id, campus_name').order('campus_name'),
        supabase.from('amcat_batches').select('id, batch_name').order('batch_name'),
      ])
      if (campusRes.data) setCampuses(campusRes.data)
      if (batchRes.data) setBatches(batchRes.data)
    }
    load()
  }, [supabase])

  // --- Campus View Data ---

  const fetchCampusData = useCallback(async () => {
    if (!selectedCampus || !selectedBatch) {
      setCampusChartData([])
      setCampusTableData([])
      setDistributionData(null)
      setParticipationData(null)
      setPlacementReadiness(null)
      setSubtopicData([])
      setCefrData(null)
      setImproversData(null)
      return
    }

    setLoading(true)
    try {
      const config = PARAMETER_CONFIG[parameter]

      // Get all assessments for this campus+batch
      const { data: allAssessments } = await supabase
        .from('amcat_assessments')
        .select('id, assessment_name, test_date, category_ids')
        .eq('campus_id', selectedCampus)
        .eq('batch_id', selectedBatch)
        .order('test_date', { ascending: true })
        .limit(50)

      const scoreKey = config.lines[0].key
      const allAssessmentIds = (allAssessments || []).map(a => a.id)

      let assessmentsWithData: number[] = []
      if (allAssessmentIds.length > 0) {
        if (parameter === 'all') {
          const { data: checkResults } = await supabase
            .from('amcat_results')
            .select('assessment_id')
            .in('assessment_id', allAssessmentIds)
            .limit(5000)
          assessmentsWithData = [...new Set((checkResults || []).map((r: any) => r.assessment_id))]
        } else {
          const { data: checkResults } = await supabase
            .from(config.table)
            .select('assessment_id, ' + scoreKey)
            .in('assessment_id', allAssessmentIds)
            .not(scoreKey, 'is', null)
            .limit(5000)
          assessmentsWithData = [...new Set((checkResults || []).map((r: any) => r.assessment_id))]
        }
      }

      const assessments = (allAssessments || []).filter(a => assessmentsWithData.includes(a.id))

      if (!assessments || assessments.length === 0) {
        setCampusChartData([])
        setCampusTableData([])
        setDistributionData(null)
        setParticipationData(null)
        setPlacementReadiness(null)
        setSubtopicData([])
        setCefrData(null)
        setImproversData(null)
        setLoading(false)
        return
      }

      // Build sub-topic select columns for the current parameter
      const allSubtopicKeys: string[] = []
      for (const line of config.lines) {
        const subs = SUBTOPIC_MAP[line.key]
        if (subs) {
          for (const s of subs) {
            if (!allSubtopicKeys.includes(s.key)) allSubtopicKeys.push(s.key)
          }
        }
      }

      // Also fetch CEFR columns if needed
      const cefrCols: string[] = []
      const hasCefrEnglish = config.lines.some(l => l.key === 'english_score')
      const hasCefrSvar = config.lines.some(l => l.key === 'svar_spoken_english_score')
      if (hasCefrEnglish) cefrCols.push('english_cefr_level')
      if (hasCefrSvar) cefrCols.push('svar_spoken_english_cefr_level')

      const selectCols = [
        'assessment_id', 'tag3', 'full_name',
        ...config.lines.map(l => l.key),
        ...allSubtopicKeys,
        ...cefrCols,
      ].filter((v, i, a) => a.indexOf(v) === i).join(', ')

      const assessmentIds = assessments.map(a => a.id)

      const { data: rawResults } = await supabase
        .from(config.table)
        .select(selectCols)
        .in('assessment_id', assessmentIds)
        .limit(5000)
      const results: any[] = (rawResults || []) as any[]

      // Also fetch svar_results if parameter is 'all' (for CEFR/SVAR data)
      let svarResults: any[] = []
      if (parameter === 'all' && assessmentIds.length > 0) {
        const { data: svarData } = await supabase
          .from('svar_results')
          .select('assessment_id, tag3, full_name, svar_spoken_english_score, svar_spoken_english_cefr_level, svar_understanding, svar_vocabulary, svar_articulation, svar_grammar, svar_pronunciation, svar_fluency, svar_active_listening')
          .in('assessment_id', assessmentIds)
          .limit(5000)
        svarResults = (svarData || []) as any[]
      }

      if (!results) {
        setCampusChartData([])
        setCampusTableData([])
        setLoading(false)
        return
      }

      // Group by assessment
      const grouped: Record<string, any[]> = {}
      for (const r of results) {
        const aid = r.assessment_id
        if (!grouped[aid]) grouped[aid] = []
        grouped[aid].push(r)
      }

      const svarGrouped: Record<string, any[]> = {}
      for (const r of svarResults) {
        const aid = r.assessment_id
        if (!svarGrouped[aid]) svarGrouped[aid] = []
        svarGrouped[aid].push(r)
      }

      const chartPoints: any[] = []
      const tableRows: any[] = []

      for (const assessment of assessments) {
        const rows = grouped[assessment.id] || []
        const point: any = {
          date: fmtDate(assessment.test_date),
          rawDate: assessment.test_date,
          name: assessment.assessment_name,
          studentCount: rows.length,
        }

        const tableRow: any = {
          date: fmtDate(assessment.test_date),
          name: assessment.assessment_name,
          studentCount: rows.length,
        }

        for (const line of config.lines) {
          const vals = rows.map(r => r[line.key]).filter((v: any) => v != null).map(Number)
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
          point[line.key] = avg !== null ? Number(avg.toFixed(1)) : null
          tableRow[line.key] = avg
        }

        chartPoints.push(point)
        tableRows.push(tableRow)
      }

      setCampusChartData(chartPoints)
      setCampusTableData(tableRows)

      // Student movement: for consecutive assessments
      if (assessments.length >= 2) {
        const movements: any[] = []
        for (let i = 1; i < assessments.length; i++) {
          const prevId = assessments[i - 1].id
          const currId = assessments[i].id
          const prevRows = grouped[prevId] || []
          const currRows = grouped[currId] || []

          const prevByStudent: Record<string, any> = {}
          prevRows.forEach(r => { if (r.tag3) prevByStudent[r.tag3] = r })

          const movement: any = {
            from: fmtDate(assessments[i - 1].test_date),
            to: fmtDate(assessments[i].test_date),
            fromName: assessments[i - 1].assessment_name,
            toName: assessments[i].assessment_name,
            modules: {},
          }

          for (const line of config.lines) {
            let improved = 0, declined = 0, same = 0, total = 0
            for (const curr of currRows) {
              if (!curr.tag3) continue
              const prev = prevByStudent[curr.tag3]
              if (!prev) continue
              const prevVal = prev[line.key]
              const currVal = curr[line.key]
              if (prevVal == null || currVal == null) continue
              total++
              if (Number(currVal) > Number(prevVal)) improved++
              else if (Number(currVal) < Number(prevVal)) declined++
              else same++
            }
            movement.modules[line.key] = { improved, declined, same, total, label: line.label }
          }
          movements.push(movement)
        }
        setMovementData(movements)
      } else {
        setMovementData([])
      }

      // =============================================
      // SECTION 1: Score Distribution Shift
      // =============================================
      {
        const distByModule: Record<string, { assessmentName: string; date: string; buckets: Record<string, number> }[]> = {}
        for (const line of config.lines) {
          distByModule[line.key] = []
          for (const assessment of assessments) {
            const rows = grouped[assessment.id] || []
            const buckets: Record<string, number> = { '0-25': 0, '25-50': 0, '50-75': 0, '75-100': 0 }
            for (const r of rows) {
              const val = r[line.key]
              if (val != null) {
                buckets[getBucket(Number(val))]++
              }
            }
            distByModule[line.key].push({
              assessmentName: assessment.assessment_name,
              date: fmtDate(assessment.test_date),
              buckets,
            })
          }
        }
        setDistributionData(distByModule)
      }

      // =============================================
      // SECTION 2: Participation Tracking
      // =============================================
      {
        const participationRows: any[] = []
        for (let i = 0; i < assessments.length; i++) {
          const assessment = assessments[i]
          const rows = grouped[assessment.id] || []
          const currentTag3s = new Set(rows.map(r => r.tag3).filter(Boolean))
          const prevRows = i > 0 ? (grouped[assessments[i - 1].id] || []) : []
          const prevTag3s = new Set(prevRows.map(r => r.tag3).filter(Boolean))

          const missing: string[] = []
          if (i > 0) {
            for (const t of prevTag3s) {
              if (!currentTag3s.has(t)) missing.push(t as string)
            }
          }

          participationRows.push({
            name: assessment.assessment_name,
            date: fmtDate(assessment.test_date),
            total: rows.length,
            prevTotal: i > 0 ? prevRows.length : null,
            dropped: missing.length > 0,
            missingCount: missing.length,
            missingTag3s: missing.slice(0, 20),
          })
        }

        // Resolve missing student names (limit to 20)
        const allMissing = participationRows.flatMap(p => p.missingTag3s).filter((v, i, a) => a.indexOf(v) === i).slice(0, 20)
        let nameMap: Record<string, string> = {}
        if (allMissing.length > 0) {
          const { data: students } = await supabase
            .from('students')
            .select('lead_id, student_name')
            .in('lead_id', allMissing)
            .limit(20)
          if (students) {
            for (const s of students) nameMap[s.lead_id] = s.student_name
          }
        }

        for (const row of participationRows) {
          row.missingNames = row.missingTag3s.map((t: string) => nameMap[t] || t)
        }

        setParticipationData(participationRows)
      }

      // =============================================
      // SECTION 3: Placement Readiness
      // =============================================
      {
        const readinessPerAssessment: any[] = []
        const relevantBenchmarks = config.lines
          .map(l => l.key)
          .filter(k => INDUSTRY_BENCHMARKS[k] != null)

        for (let i = 0; i < assessments.length; i++) {
          const assessment = assessments[i]
          const rows = grouped[assessment.id] || []
          let readyCount = 0
          const totalWithScores = rows.filter(r => relevantBenchmarks.some(k => r[k] != null)).length

          for (const r of rows) {
            const meetsAll = relevantBenchmarks.every(k => {
              const val = r[k]
              return val != null && Number(val) >= INDUSTRY_BENCHMARKS[k]
            })
            if (meetsAll) readyCount++
          }

          readinessPerAssessment.push({
            name: assessment.assessment_name,
            date: fmtDate(assessment.test_date),
            ready: readyCount,
            total: totalWithScores,
            percent: totalWithScores > 0 ? Math.round((readyCount / totalWithScores) * 100) : 0,
          })
        }

        // Compute deltas
        for (let i = 1; i < readinessPerAssessment.length; i++) {
          readinessPerAssessment[i].delta = readinessPerAssessment[i].ready - readinessPerAssessment[i - 1].ready
        }

        setPlacementReadiness(readinessPerAssessment)
      }

      // =============================================
      // SECTION 4: Sub-topic Weakness Analysis (across ALL assessments)
      // =============================================
      {
        const subtopicComparison: { key: string; label: string; module: string; scores: { date: string; name: string; avg: number }[] }[] = []

        // Collect all sub-topics
        const allSubs: { key: string; label: string; module: string; isSvar: boolean }[] = []
        for (const line of config.lines) {
          const subs = SUBTOPIC_MAP[line.key]
          if (!subs) continue
          for (const sub of subs) {
            allSubs.push({ key: sub.key, label: sub.label, module: line.label, isSvar: false })
          }
        }
        if (parameter === 'all') {
          const svarSubs = SUBTOPIC_MAP['svar_spoken_english_score'] || []
          for (const sub of svarSubs) {
            allSubs.push({ key: sub.key, label: sub.label, module: 'SVAR', isSvar: true })
          }
        }

        for (const sub of allSubs) {
          const scores: { date: string; name: string; avg: number }[] = []
          for (const assessment of assessments) {
            const rows = sub.isSvar ? (svarGrouped[assessment.id] || []) : (grouped[assessment.id] || [])
            const vals = rows.map(r => r[sub.key]).filter((v: any) => v != null).map(Number)
            const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
            if (vals.length > 0) {
              scores.push({ date: fmtDate(assessment.test_date), name: assessment.assessment_name, avg: Number(avg.toFixed(1)) })
            }
          }
          if (scores.length > 0) {
            subtopicComparison.push({ key: sub.key, label: sub.label, module: sub.module, scores })
          }
        }

        // Sort by latest score (weakest first)
        subtopicComparison.sort((a, b) => {
          const aLast = a.scores[a.scores.length - 1]?.avg || 0
          const bLast = b.scores[b.scores.length - 1]?.avg || 0
          return aLast - bLast
        })
        setSubtopicData(subtopicComparison)
      }

      // =============================================
      // SECTION 6: CEFR Level Movement
      // =============================================
      if (hasCefrEnglish || hasCefrSvar || parameter === 'all') {
        const cefrResults: any = { english: null, svar: null }

        if (hasCefrEnglish || parameter === 'all') {
          const cefrPerAssessment: any[] = []
          for (const assessment of assessments) {
            const rows = grouped[assessment.id] || []
            const counts: Record<string, number> = {}
            for (const level of CEFR_LEVELS) counts[level] = 0
            for (const r of rows) {
              const lvl = r.english_cefr_level
              if (lvl && CEFR_LEVELS.includes(lvl)) counts[lvl]++
            }
            cefrPerAssessment.push({
              name: assessment.assessment_name,
              date: fmtDate(assessment.test_date),
              counts,
              total: rows.filter(r => r.english_cefr_level).length,
            })
          }

          // Movement between last two
          let movement = null
          if (cefrPerAssessment.length >= 2) {
            const prevAid = assessments[assessments.length - 2].id
            const currAid = assessments[assessments.length - 1].id
            const prevRows = grouped[prevAid] || []
            const currRows = grouped[currAid] || []
            const prevByTag3: Record<string, string> = {}
            for (const r of prevRows) {
              if (r.tag3 && r.english_cefr_level) prevByTag3[r.tag3] = r.english_cefr_level
            }
            let movedUp = 0, movedDown = 0
            for (const r of currRows) {
              if (!r.tag3 || !r.english_cefr_level) continue
              const prev = prevByTag3[r.tag3]
              if (!prev) continue
              const prevIdx = CEFR_LEVELS.indexOf(prev)
              const currIdx = CEFR_LEVELS.indexOf(r.english_cefr_level)
              if (currIdx > prevIdx) movedUp++
              else if (currIdx < prevIdx) movedDown++
            }
            movement = { movedUp, movedDown }
          }

          cefrResults.english = { perAssessment: cefrPerAssessment, movement }
        }

        if (hasCefrSvar || parameter === 'all') {
          const sourceGrouped = parameter === 'svar' ? grouped : svarGrouped
          const cefrPerAssessment: any[] = []
          for (const assessment of assessments) {
            const rows = sourceGrouped[assessment.id] || []
            const counts: Record<string, number> = {}
            for (const level of CEFR_LEVELS) counts[level] = 0
            for (const r of rows) {
              const lvl = r.svar_spoken_english_cefr_level
              if (lvl && CEFR_LEVELS.includes(lvl)) counts[lvl]++
            }
            cefrPerAssessment.push({
              name: assessment.assessment_name,
              date: fmtDate(assessment.test_date),
              counts,
              total: rows.filter(r => r.svar_spoken_english_cefr_level).length,
            })
          }

          let movement = null
          if (cefrPerAssessment.length >= 2) {
            const prevAid = assessments[assessments.length - 2].id
            const currAid = assessments[assessments.length - 1].id
            const prevRows = sourceGrouped[prevAid] || []
            const currRows = sourceGrouped[currAid] || []
            const prevByTag3: Record<string, string> = {}
            for (const r of prevRows) {
              if (r.tag3 && r.svar_spoken_english_cefr_level) prevByTag3[r.tag3] = r.svar_spoken_english_cefr_level
            }
            let movedUp = 0, movedDown = 0
            for (const r of currRows) {
              if (!r.tag3 || !r.svar_spoken_english_cefr_level) continue
              const prev = prevByTag3[r.tag3]
              if (!prev) continue
              const prevIdx = CEFR_LEVELS.indexOf(prev)
              const currIdx = CEFR_LEVELS.indexOf(r.svar_spoken_english_cefr_level)
              if (currIdx > prevIdx) movedUp++
              else if (currIdx < prevIdx) movedDown++
            }
            movement = { movedUp, movedDown }
          }

          cefrResults.svar = { perAssessment: cefrPerAssessment, movement }
        }

        setCefrData(cefrResults)
      } else {
        setCefrData(null)
      }

      // =============================================
      // SECTION 7: Top Improvers & At Risk
      // =============================================
      if (assessments.length >= 2) {
        const firstAssessment = assessments[0]
        const lastAssessment = assessments[assessments.length - 1]
        const firstRows = grouped[firstAssessment.id] || []
        const lastRows = grouped[lastAssessment.id] || []

        const firstByTag3: Record<string, any> = {}
        for (const r of firstRows) { if (r.tag3) firstByTag3[r.tag3] = r }

        const studentChanges: any[] = []
        for (const r of lastRows) {
          if (!r.tag3) continue
          const first = firstByTag3[r.tag3]
          if (!first) continue

          let totalDelta = 0
          let moduleCount = 0
          const deltas: Record<string, number | null> = {}

          for (const line of config.lines) {
            const prevVal = first[line.key]
            const currVal = r[line.key]
            if (prevVal != null && currVal != null) {
              const d = Number(currVal) - Number(prevVal)
              deltas[line.key] = Number(d.toFixed(1))
              totalDelta += d
              moduleCount++
            } else {
              deltas[line.key] = null
            }
          }

          if (moduleCount > 0) {
            studentChanges.push({
              tag3: r.tag3,
              name: r.full_name || r.tag3,
              totalDelta: Number(totalDelta.toFixed(1)),
              deltas,
            })
          }
        }

        studentChanges.sort((a, b) => b.totalDelta - a.totalDelta)
        const topImprovers = studentChanges.slice(0, 10)
        const atRisk = [...studentChanges].sort((a, b) => a.totalDelta - b.totalDelta).slice(0, 10)

        setImproversData({ topImprovers, atRisk, config })
      } else {
        setImproversData(null)
      }

      // =============================================
      // SECTION 5: Campus vs Campus (fetch separately)
      // =============================================
      // This is handled in a separate effect below

    } catch (e) {
      console.error('Error fetching campus data:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedCampus, selectedBatch, parameter, supabase])

  useEffect(() => {
    if (view === 'campus') fetchCampusData()
  }, [view, fetchCampusData])

  // --- Campus vs Campus (separate fetch) ---
  const fetchCampusCompare = useCallback(async () => {
    if (!selectedBatch) {
      setCampusCompareData([])
      return
    }

    try {
      // Get all assessments for this batch across all campuses
      const { data: allCampusAssessments } = await supabase
        .from('amcat_assessments')
        .select('id, assessment_name, test_date, campus_id')
        .eq('batch_id', selectedBatch)
        .order('test_date', { ascending: false })
        .limit(100)

      if (!allCampusAssessments || allCampusAssessments.length === 0) {
        setCampusCompareData([])
        return
      }

      // Get the latest assessment per campus
      const latestByCampus: Record<number, any> = {}
      for (const a of allCampusAssessments) {
        if (!latestByCampus[a.campus_id]) latestByCampus[a.campus_id] = a
      }

      const latestAssessmentIds = Object.values(latestByCampus).map(a => a.id)

      const { data: results } = await supabase
        .from('amcat_results')
        .select('assessment_id, quantitative_score, english_score, logical_score, ds_score, automata_score')
        .in('assessment_id', latestAssessmentIds)
        .limit(5000)

      if (!results) {
        setCampusCompareData([])
        return
      }

      const resultsByAssessment: Record<string, any[]> = {}
      for (const r of results) {
        if (!resultsByAssessment[r.assessment_id]) resultsByAssessment[r.assessment_id] = []
        resultsByAssessment[r.assessment_id].push(r)
      }

      const campusRows: any[] = []
      for (const [campusId, assessment] of Object.entries(latestByCampus)) {
        const rows = resultsByAssessment[assessment.id] || []
        const campus = campuses.find(c => c.id === Number(campusId))
        if (!campus || rows.length === 0) continue

        const avg = (key: string) => {
          const vals = rows.map(r => r[key]).filter((v: any) => v != null).map(Number)
          return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null
        }

        campusRows.push({
          campusName: campus.campus_name,
          campusId: Number(campusId),
          assessmentDate: fmtDate(assessment.test_date),
          quantitative: avg('quantitative_score'),
          english: avg('english_score'),
          logical: avg('logical_score'),
          dsa: avg('ds_score'),
          automata: avg('automata_score'),
        })
      }

      setCampusCompareData(campusRows)
    } catch (e) {
      console.error('Error fetching campus compare data:', e)
    }
  }, [selectedBatch, campuses, supabase])

  useEffect(() => {
    if (view === 'campus' && showCampusCompare && selectedBatch) {
      fetchCampusCompare()
    }
  }, [view, showCampusCompare, selectedBatch, fetchCampusCompare])

  // --- Student Search ---

  const searchStudents = useCallback(async (query: string) => {
    if (query.length < 2) {
      setStudentResults([])
      return
    }
    setSearchLoading(true)
    try {
      const { data } = await supabase
        .from('students')
        .select('lead_id, student_name, college, batch')
        .or(`student_name.ilike.%${query}%,lead_id.ilike.%${query}%`)
        .limit(10)

      setStudentResults(data || [])
    } catch (e) {
      console.error('Student search error:', e)
    } finally {
      setSearchLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    const timer = setTimeout(() => searchStudents(studentSearch), 300)
    return () => clearTimeout(timer)
  }, [studentSearch, searchStudents])

  // --- Student View Data ---

  const fetchStudentData = useCallback(async () => {
    if (!selectedStudent) {
      setStudentChartData([])
      setStudentTableData([])
      return
    }

    setLoading(true)
    try {
      const config = PARAMETER_CONFIG[parameter]
      const selectCols = ['assessment_id', ...config.lines.map(l => l.key)].join(', ')

      const { data: rawStudentResults } = await supabase
        .from(config.table)
        .select(selectCols)
        .eq('tag3', selectedStudent.lead_id)
        .limit(100)
      const results: any[] = (rawStudentResults || []) as any[]

      if (!results || results.length === 0) {
        setStudentChartData([])
        setStudentTableData([])
        setLoading(false)
        return
      }

      const assessmentIds = [...new Set(results.map(r => r.assessment_id))]
      const { data: assessments } = await supabase
        .from('amcat_assessments')
        .select('id, assessment_name, test_date')
        .in('id', assessmentIds)
        .order('test_date', { ascending: true })
        .limit(50)

      if (!assessments) {
        setStudentChartData([])
        setStudentTableData([])
        setLoading(false)
        return
      }

      const resultByAssessment: Record<string, any> = {}
      for (const r of results) {
        resultByAssessment[r.assessment_id] = r
      }

      const chartPoints: any[] = []
      const tableRows: any[] = []

      for (let i = 0; i < assessments.length; i++) {
        const assessment = assessments[i]
        const row = resultByAssessment[assessment.id]
        if (!row) continue

        const point: any = {
          date: fmtDate(assessment.test_date),
          rawDate: assessment.test_date,
          name: assessment.assessment_name,
        }

        const tableRow: any = {
          date: fmtDate(assessment.test_date),
          name: assessment.assessment_name,
          deltas: {} as Record<string, number | null>,
        }

        for (const line of config.lines) {
          const val = row[line.key] != null ? Number(row[line.key]) : null
          point[line.key] = val
          tableRow[line.key] = val

          // Calculate delta from previous
          if (i > 0) {
            const prevAssessment = assessments[i - 1]
            const prevRow = resultByAssessment[prevAssessment.id]
            if (prevRow && prevRow[line.key] != null && val != null) {
              tableRow.deltas[line.key] = Number((val - Number(prevRow[line.key])).toFixed(1))
            } else {
              tableRow.deltas[line.key] = null
            }
          } else {
            tableRow.deltas[line.key] = null
          }
        }

        chartPoints.push(point)
        tableRows.push(tableRow)
      }

      setStudentChartData(chartPoints)
      setStudentTableData(tableRows)
    } catch (e) {
      console.error('Error fetching student data:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedStudent, parameter, supabase])

  useEffect(() => {
    if (view === 'student') fetchStudentData()
  }, [view, fetchStudentData])

  // --- Compute highlights for student view ---

  const studentHighlights = useMemo(() => {
    if (studentTableData.length < 2) return null
    const config = PARAMETER_CONFIG[parameter]
    let biggestImprovement = { key: '', label: '', delta: -Infinity }
    let biggestDecline = { key: '', label: '', delta: Infinity }

    for (const row of studentTableData) {
      for (const line of config.lines) {
        const d = row.deltas?.[line.key]
        if (d == null) continue
        if (d > biggestImprovement.delta) {
          biggestImprovement = { key: line.key, label: line.label, delta: d }
        }
        if (d < biggestDecline.delta) {
          biggestDecline = { key: line.key, label: line.label, delta: d }
        }
      }
    }

    return {
      improvement: biggestImprovement.delta > -Infinity ? biggestImprovement : null,
      decline: biggestDecline.delta < Infinity ? biggestDecline : null,
    }
  }, [studentTableData, parameter])

  // --- Render ---

  const config = PARAMETER_CONFIG[parameter]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-primary)' }}>
            AMCAT Comparison
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Track score progression across multiple AMCAT attempts
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('campus')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'campus'
                ? 'bg-white shadow-sm'
                : 'hover:bg-gray-200'
            }`}
            style={view === 'campus' ? { color: 'var(--color-primary)' } : { color: 'var(--color-text-secondary)' }}
          >
            <BarChart3 size={16} />
            Campus & Batch
          </button>
          <button
            onClick={() => setView('student')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'student'
                ? 'bg-white shadow-sm'
                : 'hover:bg-gray-200'
            }`}
            style={view === 'student' ? { color: 'var(--color-primary)' } : { color: 'var(--color-text-secondary)' }}
          >
            <Users size={16} />
            Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {view === 'campus' && (
            <>
              {/* Campus */}
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Campus
                </label>
                <select
                  value={selectedCampus ?? ''}
                  onChange={e => setSelectedCampus(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ambient)] focus:border-transparent"
                >
                  <option value="">Select Campus</option>
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.campus_name}</option>
                  ))}
                </select>
              </div>

              {/* Batch */}
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Batch
                </label>
                <select
                  value={selectedBatch ?? ''}
                  onChange={e => setSelectedBatch(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ambient)] focus:border-transparent"
                >
                  <option value="">Select Batch</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.batch_name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {view === 'student' && (
            <div className="min-w-[300px] relative">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                Search Student
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Name or Lead ID..."
                  value={studentSearch}
                  onChange={e => {
                    setStudentSearch(e.target.value)
                    setSelectedStudent(null)
                  }}
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ambient)] focus:border-transparent"
                />
              </div>

              {/* Search Dropdown */}
              {studentResults.length > 0 && !selectedStudent && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {studentResults.map(s => (
                    <button
                      key={s.lead_id}
                      onClick={() => {
                        setSelectedStudent(s)
                        setStudentSearch(s.student_name)
                        setStudentResults([])
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium" style={{ color: 'var(--color-primary)' }}>{s.student_name}</span>
                      <span className="ml-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {s.college} &middot; {s.batch} &middot; {s.lead_id}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {searchLoading && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-400">
                  Searching...
                </div>
              )}
            </div>
          )}

          {/* Parameter */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Parameter
            </label>
            <select
              value={parameter}
              onChange={e => setParameter(e.target.value as Parameter)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ambient)] focus:border-transparent"
            >
              <option value="all">All Parameters</option>
              <option value="aptitude">Aptitude</option>
              <option value="dsa">DSA</option>
              <option value="automata">Automata</option>
              <option value="svar">SVAR</option>
              <option value="webdev">Web Development</option>
              <option value="writex">WriteX</option>
            </select>
          </div>
        </div>
      </div>

      {/* Student Highlights */}
      {view === 'student' && selectedStudent && studentHighlights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {studentHighlights.improvement && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4"
              style={{ borderTop: '3px solid #22C55E' }}>
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <TrendingUp size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Biggest Improvement</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
                  {studentHighlights.improvement.label}
                </p>
                <p className="text-sm text-green-600 font-medium">
                  +{studentHighlights.improvement.delta.toFixed(1)} points
                </p>
              </div>
            </div>
          )}
          {studentHighlights.decline && studentHighlights.decline.delta < 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4"
              style={{ borderTop: '3px solid #EF4444' }}>
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingDown size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Biggest Decline</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--color-primary)' }}>
                  {studentHighlights.decline.label}
                </p>
                <p className="text-sm text-red-500 font-medium">
                  {studentHighlights.decline.delta.toFixed(1)} points
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-6">
          <ChartSkeleton />
          <TableSkeleton />
        </div>
      )}

      {/* Empty states */}
      {!loading && view === 'campus' && (!selectedCampus || !selectedBatch) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <BarChart3 size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Select a campus and batch to view score progression
          </p>
        </div>
      )}

      {!loading && view === 'student' && !selectedStudent && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Search size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Search for a student to view their score progression
          </p>
        </div>
      )}

      {!loading && view === 'campus' && selectedCampus && selectedBatch && campusChartData.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <BarChart3 size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No assessment data found for this campus and batch
          </p>
        </div>
      )}

      {!loading && view === 'student' && selectedStudent && studentChartData.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <Search size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No {config.label} data found for {selectedStudent.student_name}
          </p>
        </div>
      )}

      {/* Campus Table -- above chart */}
      {!loading && view === 'campus' && campusTableData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              Assessment Details
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Assessment</th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Students</th>
                  {config.lines.map(line => (
                    <th key={line.key} className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      Avg {line.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campusTableData.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-primary)' }}>{row.date}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.name}</td>
                    <td className="text-center px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.studentCount}</td>
                    {config.lines.map(line => {
                      const val = row[line.key]
                      const prevVal = idx > 0 ? campusTableData[idx - 1][line.key] : null
                      const improved = val != null && prevVal != null ? val > prevVal : null
                      const declined = val != null && prevVal != null ? val < prevVal : null

                      return (
                        <td key={line.key} className="text-center px-4 py-3">
                          <span className={`font-medium ${
                            improved ? 'text-green-600' : declined ? 'text-red-500' : ''
                          }`}
                          style={!improved && !declined ? { color: 'var(--color-primary)' } : undefined}
                          >
                            {fmtScore(val)}
                          </span>
                          {improved && <ArrowUpRight size={14} className="inline ml-1 text-green-600" />}
                          {declined && <ArrowDownRight size={14} className="inline ml-1 text-red-500" />}
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

      {/* Student Movement */}
      {!loading && view === 'campus' && movementData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>
            Student Movement
          </h3>
          <div className="space-y-6">
            {movementData.map((m, mIdx) => (
              <div key={mIdx}>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {m.from} → {m.to}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {Object.entries(m.modules).map(([key, mod]: [string, any]) => {
                    if (mod.total === 0) return null
                    const improvedPct = Math.round((mod.improved / mod.total) * 100)
                    const declinedPct = Math.round((mod.declined / mod.total) * 100)
                    const samePct = 100 - improvedPct - declinedPct
                    return (
                      <div key={key} className="border rounded-lg p-3" style={{ borderColor: 'var(--color-border)' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>{mod.label}</p>
                        <div className="flex items-center gap-1 mb-2 h-2 rounded-full overflow-hidden bg-gray-100">
                          {improvedPct > 0 && <div className="h-full bg-green-500 rounded-l-full" style={{ width: `${improvedPct}%` }} />}
                          {samePct > 0 && <div className="h-full bg-gray-300" style={{ width: `${samePct}%` }} />}
                          {declinedPct > 0 && <div className="h-full bg-red-400 rounded-r-full" style={{ width: `${declinedPct}%` }} />}
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-green-600 font-medium">&uarr; {mod.improved} ({improvedPct}%)</span>
                          <span className="text-gray-400">{mod.same} same</span>
                          <span className="text-red-500 font-medium">&darr; {mod.declined} ({declinedPct}%)</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{mod.total} students compared</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart -- below table */}
      {!loading && ((view === 'campus' && campusChartData.length > 0) || (view === 'student' && studentChartData.length > 0)) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>
            {config.label} Score Progression
            {view === 'student' && selectedStudent ? ` \u2014 ${selectedStudent.student_name}` : ''}
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={view === 'campus' ? campusChartData : studentChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  fontSize: '13px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              {config.lines.map((line, idx) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={line.color || LINE_COLORS[idx]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: line.color || LINE_COLORS[idx] }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Student Table */}
      {!loading && view === 'student' && studentTableData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              Attempt Details &mdash; {selectedStudent?.student_name}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Assessment</th>
                  {config.lines.map(line => (
                    <th key={line.key} className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {line.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentTableData.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-primary)' }}>{row.date}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.name}</td>
                    {config.lines.map(line => {
                      const val = row[line.key]
                      const delta = row.deltas?.[line.key]

                      return (
                        <td key={line.key} className="text-center px-4 py-3">
                          <span className="font-medium" style={{ color: 'var(--color-primary)' }}>
                            {fmtScore(val)}
                          </span>
                          {delta != null && (
                            <span className={`ml-1.5 text-xs font-medium ${
                              delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'
                            }`}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                            </span>
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

      {/* ========================================= */}
      {/* NEW SECTIONS - Campus View Only           */}
      {/* ========================================= */}

      {/* SECTION 1: Score Distribution Shift */}
      {!loading && view === 'campus' && distributionData && campusChartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={18} style={{ color: 'var(--color-ambient)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              Score Distribution Shift
            </h3>
          </div>

          {config.lines.map(line => {
            const moduleData = distributionData[line.key]
            if (!moduleData || moduleData.length === 0) return null

            // Build chart data for grouped bars
            const chartData = SCORE_BUCKETS.map(bucket => {
              const point: any = { bucket }
              moduleData.forEach((a: any, idx: number) => {
                point[`assessment_${idx}`] = a.buckets[bucket] || 0
              })
              return point
            })

            const barColors = ['#3BC3E2', '#0D1E56', '#22ACD1', '#6366F1', '#F59E0B', '#EF4444']

            return (
              <div key={line.key} className="mb-6 last:mb-0">
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>{line.label}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {moduleData.map((_: any, idx: number) => (
                      <Bar
                        key={idx}
                        dataKey={`assessment_${idx}`}
                        name={moduleData[idx].date}
                        fill={barColors[idx % barColors.length]}
                        radius={[2, 2, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>

                {/* Distribution table */}
                {moduleData.length >= 2 && (
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bucket</th>
                          {moduleData.map((a: any, idx: number) => (
                            <th key={idx} className="text-center px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                              {a.date}
                            </th>
                          ))}
                          {moduleData.length === 2 && (
                            <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Change</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {SCORE_BUCKETS.map((bucket, bIdx) => {
                          const first = moduleData[0].buckets[bucket] || 0
                          const last = moduleData[moduleData.length - 1].buckets[bucket] || 0
                          const change = last - first
                          const isHighBucket = bucket === '50-75' || bucket === '75-100'
                          const changeColor = isHighBucket
                            ? (change > 0 ? 'text-green-600' : change < 0 ? 'text-red-500' : 'text-gray-400')
                            : (change < 0 ? 'text-green-600' : change > 0 ? 'text-red-500' : 'text-gray-400')

                          return (
                            <tr key={bucket} className={bIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                              <td className="px-3 py-2 font-medium" style={{ color: 'var(--color-primary)' }}>{bucket}</td>
                              {moduleData.map((a: any, idx: number) => (
                                <td key={idx} className="text-center px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                                  {a.buckets[bucket] || 0}
                                </td>
                              ))}
                              {moduleData.length === 2 && (
                                <td className={`text-center px-3 py-2 font-medium ${changeColor}`}>
                                  {change > 0 ? '+' : ''}{change}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* SECTION 2: Participation Tracking */}
      {!loading && view === 'campus' && participationData && participationData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} style={{ color: 'var(--color-ambient)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              Participation Tracking
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Assessment</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date</th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total Students</th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>vs Previous</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {participationData.map((row: any, idx: number) => {
                  const diff = row.prevTotal != null ? row.total - row.prevTotal : null
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-primary)' }}>{row.name}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{row.date}</td>
                      <td className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-primary)' }}>{row.total}</td>
                      <td className="text-center px-4 py-3">
                        {diff != null ? (
                          <span className={`font-medium ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {diff > 0 ? '+' : ''}{diff}
                          </span>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.dropped ? (
                          <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                            <AlertTriangle size={12} />
                            {row.missingCount} missing
                          </span>
                        ) : idx > 0 ? (
                          <span className="text-green-600 text-xs font-medium">All retained</span>
                        ) : (
                          <span className="text-gray-300 text-xs">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Missing students detail */}
          {participationData.some((r: any) => r.missingNames && r.missingNames.length > 0) && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-primary)' }}>
                Missing Students (from previous assessment)
              </p>
              {participationData.filter((r: any) => r.missingNames && r.missingNames.length > 0).map((row: any, idx: number) => (
                <div key={idx} className="mb-3 last:mb-0">
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    Not in {row.name}:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {row.missingNames.map((name: string, nIdx: number) => (
                      <span
                        key={nIdx}
                        className="inline-block px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 font-medium"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Placement Readiness */}
      {!loading && view === 'campus' && placementReadiness && placementReadiness.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} style={{ color: 'var(--color-ambient)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              Placement Readiness
            </h3>
          </div>

          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Industry benchmarks: {config.lines.filter(l => INDUSTRY_BENCHMARKS[l.key]).map(l =>
              `${l.label} >= ${INDUSTRY_BENCHMARKS[l.key]}`
            ).join(', ')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {placementReadiness.map((row: any, idx: number) => (
              <div
                key={idx}
                className="border rounded-lg p-4 flex items-center gap-4"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="relative flex-shrink-0">
                  <ProgressRing percent={row.percent} size={72} strokeWidth={6} />
                  <span
                    className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {row.percent}%
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-secondary)' }}>
                    {row.date}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                    {row.ready} of {row.total} ready
                  </p>
                  {row.delta != null && (
                    <p className={`text-xs font-medium mt-0.5 ${
                      row.delta > 0 ? 'text-green-600' : row.delta < 0 ? 'text-red-500' : 'text-gray-400'
                    }`}>
                      {row.delta > 0 ? '+' : ''}{row.delta} students {row.delta >= 0 ? 'became' : 'lost'} placement-ready
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: Sub-topic Weakness Comparison */}
      {!loading && view === 'campus' && subtopicData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={18} style={{ color: 'var(--color-ambient)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              Sub-topic Weakness Comparison
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Across all assessments. Sorted by latest score (weakest first).
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--color-text-secondary)' }}>Sub-topic</th>
                  <th className="text-left px-3 py-2 font-medium text-xs" style={{ color: 'var(--color-text-secondary)' }}>Module</th>
                  {subtopicData[0]?.scores.map((s: any, i: number) => (
                    <th key={i} className="text-center px-3 py-2 font-medium text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {s.date}
                    </th>
                  ))}
                  {subtopicData[0]?.scores.length >= 2 && (
                    <th className="text-center px-3 py-2 font-medium text-xs" style={{ color: 'var(--color-text-secondary)' }}>Change</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {subtopicData.map((st: any, idx: number) => {
                  const first = st.scores[0]?.avg
                  const last = st.scores[st.scores.length - 1]?.avg
                  const change = st.scores.length >= 2 ? Number((last - first).toFixed(1)) : null
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-3 py-2 text-xs font-medium" style={{ color: 'var(--color-primary)' }}>{st.label}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{st.module}</td>
                      {st.scores.map((s: any, i: number) => (
                        <td key={i} className="text-center px-3 py-2">
                          <span className="text-xs font-medium" style={{ color: subtopicColor(s.avg) }}>
                            {s.avg}
                          </span>
                        </td>
                      ))}
                      {change !== null && (
                        <td className="text-center px-3 py-2">
                          <span className={`text-xs font-bold ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {change > 0 ? '+' : ''}{change}
                            {change > 0 && <ArrowUpRight size={12} className="inline ml-0.5" />}
                            {change < 0 && <ArrowDownRight size={12} className="inline ml-0.5" />}
                          </span>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4 mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> &lt; 35 (Weak)
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> 35-50 (Average)
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> &gt; 50 (Strong)
            </span>
          </div>
        </div>
      )}

      {/* SECTION 5: Campus vs Campus */}
      {!loading && view === 'campus' && selectedBatch && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe size={18} style={{ color: 'var(--color-ambient)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                Campus vs Campus
              </h3>
            </div>
            <button
              onClick={() => setShowCampusCompare(!showCampusCompare)}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ color: 'var(--color-primary)', borderColor: 'var(--color-border)' }}
            >
              {showCampusCompare ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showCampusCompare ? 'Hide' : 'Compare'}
            </button>
          </div>

          {showCampusCompare && campusCompareData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Campus</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Latest Date</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Avg Quant</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Avg English</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Avg Logical</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Avg DSA</th>
                    <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Avg Automata</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Find best/worst per module
                    const modules = ['quantitative', 'english', 'logical', 'dsa', 'automata'] as const
                    const best: Record<string, number | null> = {}
                    const worst: Record<string, number | null> = {}
                    for (const mod of modules) {
                      const vals = campusCompareData.map(r => r[mod]).filter((v: any) => v != null) as number[]
                      best[mod] = vals.length ? Math.max(...vals) : null
                      worst[mod] = vals.length ? Math.min(...vals) : null
                    }

                    return campusCompareData.map((row, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-primary)' }}>{row.campusName}</td>
                        <td className="text-center px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{row.assessmentDate}</td>
                        {modules.map(mod => {
                          const val = row[mod]
                          const isBest = val != null && val === best[mod] && campusCompareData.length > 1
                          const isWorst = val != null && val === worst[mod] && val !== best[mod] && campusCompareData.length > 1

                          return (
                            <td key={mod} className="text-center px-4 py-3">
                              <span className={`font-medium ${isBest ? 'text-green-600' : isWorst ? 'text-red-500' : ''}`}
                                style={!isBest && !isWorst ? { color: 'var(--color-primary)' } : undefined}
                              >
                                {fmtScore(val)}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
          )}

          {showCampusCompare && campusCompareData.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
              No cross-campus data available for this batch.
            </p>
          )}
        </div>
      )}

      {/* SECTION 6: CEFR Level Movement */}
      {!loading && view === 'campus' && cefrData && (cefrData.english || cefrData.svar) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} style={{ color: 'var(--color-ambient)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              CEFR Level Movement
            </h3>
          </div>

          {/* English CEFR */}
          {cefrData.english && cefrData.english.perAssessment.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>English CEFR Levels</p>

              {cefrData.english.movement && (
                <div className="flex gap-4 mb-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    <TrendingUp size={12} />
                    {cefrData.english.movement.movedUp} moved up
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2.5 py-1 rounded-full">
                    <TrendingDown size={12} />
                    {cefrData.english.movement.movedDown} moved down
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Assessment</th>
                      {CEFR_LEVELS.map(level => (
                        <th key={level} className="text-center px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                          {level}
                        </th>
                      ))}
                      <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cefrData.english.perAssessment.map((row: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                          {row.date}
                        </td>
                        {CEFR_LEVELS.map(level => (
                          <td key={level} className="text-center px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {row.counts[level] || 0}
                          </td>
                        ))}
                        <td className="text-center px-3 py-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                          {row.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Stacked bar visualization */}
              {cefrData.english.perAssessment.length > 0 && (
                <div className="mt-3">
                  {cefrData.english.perAssessment.map((row: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 mb-1.5">
                      <span className="w-24 text-[10px] text-right flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                        {row.date}
                      </span>
                      <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-gray-100">
                        {CEFR_LEVELS.map((level, lIdx) => {
                          const count = row.counts[level] || 0
                          const pct = row.total > 0 ? (count / row.total) * 100 : 0
                          if (pct === 0) return null
                          const colors = ['#EF4444', '#F59E0B', '#FBBF24', '#34D399', '#22ACD1', '#0D1E56']
                          return (
                            <div
                              key={level}
                              className="h-full"
                              style={{ width: `${pct}%`, backgroundColor: colors[lIdx] }}
                              title={`${level}: ${count}`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-2">
                    {CEFR_LEVELS.map((level, lIdx) => {
                      const colors = ['#EF4444', '#F59E0B', '#FBBF24', '#34D399', '#22ACD1', '#0D1E56']
                      return (
                        <span key={level} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: colors[lIdx] }} />
                          {level}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SVAR CEFR */}
          {cefrData.svar && cefrData.svar.perAssessment.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>SVAR Spoken English CEFR Levels</p>

              {cefrData.svar.movement && (
                <div className="flex gap-4 mb-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    <TrendingUp size={12} />
                    {cefrData.svar.movement.movedUp} moved up
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2.5 py-1 rounded-full">
                    <TrendingDown size={12} />
                    {cefrData.svar.movement.movedDown} moved down
                  </span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Assessment</th>
                      {CEFR_LEVELS.map(level => (
                        <th key={level} className="text-center px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                          {level}
                        </th>
                      ))}
                      <th className="text-center px-3 py-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cefrData.svar.perAssessment.map((row: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-3 py-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                          {row.date}
                        </td>
                        {CEFR_LEVELS.map(level => (
                          <td key={level} className="text-center px-3 py-2" style={{ color: 'var(--color-text-secondary)' }}>
                            {row.counts[level] || 0}
                          </td>
                        ))}
                        <td className="text-center px-3 py-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                          {row.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Stacked bar visualization */}
              {cefrData.svar.perAssessment.length > 0 && (
                <div className="mt-3">
                  {cefrData.svar.perAssessment.map((row: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 mb-1.5">
                      <span className="w-24 text-[10px] text-right flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                        {row.date}
                      </span>
                      <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-gray-100">
                        {CEFR_LEVELS.map((level, lIdx) => {
                          const count = row.counts[level] || 0
                          const pct = row.total > 0 ? (count / row.total) * 100 : 0
                          if (pct === 0) return null
                          const colors = ['#EF4444', '#F59E0B', '#FBBF24', '#34D399', '#22ACD1', '#0D1E56']
                          return (
                            <div
                              key={level}
                              className="h-full"
                              style={{ width: `${pct}%`, backgroundColor: colors[lIdx] }}
                              title={`${level}: ${count}`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-2">
                    {CEFR_LEVELS.map((level, lIdx) => {
                      const colors = ['#EF4444', '#F59E0B', '#FBBF24', '#34D399', '#22ACD1', '#0D1E56']
                      return (
                        <span key={level} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: colors[lIdx] }} />
                          {level}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 7: Top Improvers & At Risk */}
      {!loading && view === 'campus' && improversData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} style={{ color: 'var(--color-ambient)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              Top Improvers & At Risk
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Comparing first and last assessment scores.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Improvers */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserCheck size={16} className="text-green-600" />
                <p className="text-xs font-semibold text-green-700">Top 10 Improvers</p>
              </div>
              <div className="space-y-2">
                {improversData.topImprovers.map((student: any, idx: number) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-3"
                    style={{ borderColor: '#BBF7D0', backgroundColor: idx === 0 ? '#F0FDF4' : 'white' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {idx + 1}. {student.name}
                      </span>
                      <span className="text-xs font-bold text-green-600">
                        +{student.totalDelta}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {config.lines.map(line => {
                        const d = student.deltas[line.key]
                        if (d == null) return null
                        return (
                          <span
                            key={line.key}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              d > 0 ? 'bg-green-50 text-green-700' : d < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            {line.label}: {d > 0 ? '+' : ''}{d}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {improversData.topImprovers.length === 0 && (
                  <p className="text-xs text-center py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    No data available
                  </p>
                )}
              </div>
            </div>

            {/* At Risk */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <UserX size={16} className="text-red-500" />
                <p className="text-xs font-semibold text-red-600">Bottom 10 (At Risk)</p>
              </div>
              <div className="space-y-2">
                {improversData.atRisk.map((student: any, idx: number) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-3"
                    style={{ borderColor: '#FECACA', backgroundColor: idx === 0 ? '#FEF2F2' : 'white' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                        {idx + 1}. {student.name}
                      </span>
                      <span className="text-xs font-bold text-red-500">
                        {student.totalDelta}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {config.lines.map(line => {
                        const d = student.deltas[line.key]
                        if (d == null) return null
                        return (
                          <span
                            key={line.key}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              d > 0 ? 'bg-green-50 text-green-700' : d < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            {line.label}: {d > 0 ? '+' : ''}{d}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {improversData.atRisk.length === 0 && (
                  <p className="text-xs text-center py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    No data available
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
