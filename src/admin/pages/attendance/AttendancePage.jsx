import { useState, useEffect, useCallback } from 'react'
import { CalendarCheck, AlertTriangle, UserX, ChevronDown, ChevronRight, TrendingUp, Building2 } from 'lucide-react'
import { MetricCard, MetricCardSkeleton } from '../../components/MetricCard'
import { FilterBar } from '../../components/FilterBar'
import { DataTable } from '../../components/DataTable'
import { loadAttendance, loadAttendanceSummary, loadFilterOptions, formatPct } from '../../../lib/adminDb'
import { supabase } from '../../../lib/supabase'

function AttBadge({ value }) {
  if (value === null || value === undefined) return <span className="text-primary/20">—</span>
  const n = Number(value)
  const color = n < 50 ? 'bg-primary/10 text-primary' : n < 75 ? 'bg-amber-50 text-amber-700' : 'bg-ambient/10 text-dark-ambient'
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${color}`}>{n.toFixed(1)}%</span>
}

function DistributionBar({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-primary/50 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-primary/[0.03] rounded-md overflow-hidden">
        <div className={`h-full rounded-md transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-primary w-12 text-right">{count}</span>
      <span className="text-[10px] text-primary/30 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  )
}

function CampusCard({ name, batch, label, avg, below75, below50, total }) {
  const avgN = Number(avg || 0)
  const ringColor = avgN >= 75 ? 'text-dark-ambient' : avgN >= 50 ? 'text-amber-500' : 'text-primary'
  const ringPct = Math.min(avgN, 100)

  return (
    <div className="bg-white rounded-xl border border-primary/10 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-primary">{name}</h3>
          <p className="text-[11px] text-primary/40 mt-0.5">Batch {batch} · {total} students</p>
        </div>
        {/* Circular progress */}
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-primary/5" />
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className={ringColor}
              strokeDasharray={`${ringPct * 1.508} 150.8`} strokeLinecap="round" />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${ringColor}`}>{avgN.toFixed(0)}%</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-primary/40">Below 75%</span>
          <span className="font-semibold text-primary">{below75}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-primary/40">Below 50%</span>
          <span className="font-bold text-primary">{below50}</span>
        </div>
      </div>
    </div>
  )
}

const TABLE_COLUMNS = [
  { key: 'student_name', label: 'Student', render: row => (
    <div>
      <div className="font-medium">{row.students?.student_name || '—'}</div>
      <div className="text-xs text-primary/40">{row.students?.campus_name} · {row.students?.batch}</div>
    </div>
  ), sortable: false },
  { key: 'overall_pct', label: 'Overall', render: row => <AttBadge value={row.overall_pct} />, align: 'right', width: '90px' },
  { key: 'sem1_pct', label: 'S1', render: row => <AttBadge value={row.sem1_pct} />, align: 'right', width: '70px' },
  { key: 'sem2_pct', label: 'S2', render: row => <AttBadge value={row.sem2_pct} />, align: 'right', width: '70px' },
  { key: 'sem3_pct', label: 'S3', render: row => <AttBadge value={row.sem3_pct} />, align: 'right', width: '70px' },
  { key: 'sem4_pct', label: 'S4', render: row => <AttBadge value={row.sem4_pct} />, align: 'right', width: '70px' },
  { key: 'sem5_pct', label: 'S5', render: row => <AttBadge value={row.sem5_pct} />, align: 'right', width: '70px' },
  { key: 'sem6_pct', label: 'S6', render: row => <AttBadge value={row.sem6_pct} />, align: 'right', width: '70px' },
]

export default function AttendancePage() {
  const [filters, setFilters] = useState({ campus: '', batch: '', search: '' })
  const [filterOpts, setFilterOpts] = useState({ campuses: [], batches: {} })
  const [loading, setLoading] = useState(true)
  const [campusStats, setCampusStats] = useState([])
  const [distribution, setDistribution] = useState(null)
  const [atRisk, setAtRisk] = useState([])
  const [showTable, setShowTable] = useState(false)
  const [tableData, setTableData] = useState({ data: [], total: 0 })
  const [tablePage, setTablePage] = useState(0)
  const [sortBy, setSortBy] = useState('overall_pct')
  const [sortAsc, setSortAsc] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)

  // Load filter options + campus stats on mount
  useEffect(() => {
    Promise.all([
      loadFilterOptions(),
      loadCampusBreakdown(),
    ]).then(([opts]) => {
      setFilterOpts(opts)
      setLoading(false)
    })
  }, [])

  async function loadCampusBreakdown() {
    const { data } = await supabase
      .from('student_attendance')
      .select('overall_pct, students!inner(student_name, campus_name, batch, active_status)')
      .eq('students.active_status', 'Active')

    if (!data?.length) return

    // Campus-wise stats
    const bycamp = {}
    const brackets = { '90-100': 0, '75-89': 0, '50-74': 0, '25-49': 0, '0-24': 0 }
    const riskMap = {}

    data.forEach(row => {
      const campus = row.students?.campus_name || 'Unknown'
      const batch = row.students?.batch || 'Unknown'
      const pct = Number(row.overall_pct || 0)
      const key = `${campus} · ${batch}`

      if (!bycamp[key]) bycamp[key] = { name: campus, batch, label: key, sum: 0, count: 0, below75: 0, below50: 0 }
      bycamp[key].sum += pct
      bycamp[key].count++
      if (pct < 75) bycamp[key].below75++
      if (pct < 50) bycamp[key].below50++

      // Distribution
      if (pct >= 90) brackets['90-100']++
      else if (pct >= 75) brackets['75-89']++
      else if (pct >= 50) brackets['50-74']++
      else if (pct >= 25) brackets['25-49']++
      else brackets['0-24']++

      // At risk tracking (below 50%) — aggregate by campus × batch
      if (pct < 50) {
        const riskKey = `${campus} · ${batch}`
        if (!riskMap[riskKey]) riskMap[riskKey] = { campus, batch, label: riskKey, below50: 0, total: 0 }
        riskMap[riskKey].below50++
      }
    })

    const campusArr = Object.values(bycamp).map(c => ({
      ...c,
      avg: c.count > 0 ? c.sum / c.count : 0,
      total: c.count,
    })).sort((a, b) => b.avg - a.avg)

    // Merge total counts into riskMap from bycamp
    Object.values(bycamp).forEach(c => {
      if (riskMap[c.label]) riskMap[c.label].total = c.count
    })

    const riskArr = Object.values(riskMap)
      .map(r => ({ ...r, pct: r.total > 0 ? ((r.below50 / r.total) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct)

    setCampusStats(campusArr)
    setDistribution({ ...brackets, total: data.length })
    setAtRisk(riskArr)
  }

  // Load table data when opened or filters change
  const fetchTable = useCallback(async () => {
    if (!showTable) return
    setTableLoading(true)
    const result = await loadAttendance({
      campus: filters.campus, batch: filters.batch, search: filters.search,
      page: tablePage, sortBy, sortAsc
    })
    setTableData(result)
    setTableLoading(false)
  }, [showTable, filters.campus, filters.batch, filters.search, tablePage, sortBy, sortAsc])

  useEffect(() => { fetchTable() }, [fetchTable])

  const updateFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }))
    setTablePage(0)
  }

  const handleSort = (key) => {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(true) }
    setTablePage(0)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <MetricCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  const overallAvg = campusStats.length > 0
    ? campusStats.reduce((s, c) => s + c.sum, 0) / campusStats.reduce((s, c) => s + c.count, 0)
    : 0
  const totalBelow75 = campusStats.reduce((s, c) => s + c.below75, 0)
  const totalBelow50 = campusStats.reduce((s, c) => s + c.below50, 0)
  const totalStudents = campusStats.reduce((s, c) => s + c.count, 0)

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard label="Overall Avg Attendance" value={`${overallAvg.toFixed(1)}%`} icon={CalendarCheck} accent />
        <MetricCard label="Total Students Tracked" value={totalStudents} icon={TrendingUp} />
        <MetricCard label="Below 75%" value={totalBelow75} icon={AlertTriangle} sub={`${totalStudents > 0 ? ((totalBelow75 / totalStudents) * 100).toFixed(0) : 0}% of total`} />
        <MetricCard label="Critical (Below 50%)" value={totalBelow50} icon={UserX} sub="Need intervention" />
      </div>

      {/* Campus comparison */}
      <div>
        <h2 className="text-sm font-semibold text-primary/60 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building2 size={14} /> Campus Comparison
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {campusStats.map(c => (
            <CampusCard key={c.name} {...c} />
          ))}
        </div>
      </div>

      {/* Distribution + At Risk side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution */}
        {distribution && (
          <div className="bg-white rounded-xl border border-primary/10 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-primary mb-4">Attendance Distribution</h3>
            <div className="space-y-3">
              <DistributionBar label="90–100%" count={distribution['90-100']} total={distribution.total} color="bg-dark-ambient" />
              <DistributionBar label="75–89%" count={distribution['75-89']} total={distribution.total} color="bg-ambient" />
              <DistributionBar label="50–74%" count={distribution['50-74']} total={distribution.total} color="bg-amber-400" />
              <DistributionBar label="25–49%" count={distribution['25-49']} total={distribution.total} color="bg-primary/40" />
              <DistributionBar label="0–24%" count={distribution['0-24']} total={distribution.total} color="bg-primary" />
            </div>
          </div>
        )}

        {/* At Risk Students */}
        <div className="bg-white rounded-xl border border-primary/10 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-primary mb-4">
            At Risk <span className="text-primary/30 font-normal">· Below 50% by Campus × Batch</span>
          </h3>
          {atRisk.length === 0 ? (
            <p className="text-sm text-primary/40 py-4">No students below 50% — great!</p>
          ) : (
            <div className="space-y-2">
              {atRisk.map((r, i) => (
                <div key={i} className="py-2.5 border-b border-primary/5 last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-primary">{r.campus} · Batch {r.batch}</span>
                    <span className="text-xs font-semibold text-primary">{r.below50} of {r.total} <span className="text-primary/30">({r.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-primary/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/40 rounded-full" style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expandable raw data */}
      <div className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full px-6 py-4 flex items-center justify-between text-sm font-medium text-primary/60 hover:text-primary hover:bg-primary/[0.02] transition-colors"
        >
          <span>View Student-wise Data</span>
          {showTable ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {showTable && (
          <div className="px-6 pb-6 space-y-4 border-t border-primary/5 pt-4">
            <FilterBar
              campuses={filterOpts.campuses}
              batchesByCampus={filterOpts.batches}
              campus={filters.campus}
              batch={filters.batch}
              search={filters.search}
              onCampusChange={v => updateFilter('campus', v)}
              onBatchChange={v => updateFilter('batch', v)}
              onSearchChange={v => updateFilter('search', v)}
            />
            <DataTable
              columns={TABLE_COLUMNS}
              data={tableData.data}
              sortBy={sortBy}
              sortAsc={sortAsc}
              onSort={handleSort}
              page={tablePage}
              pageSize={25}
              total={tableData.total}
              onPageChange={setTablePage}
              loading={tableLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}
