'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import {
  CalendarCheck, AlertTriangle, UserX, ChevronDown, ChevronRight,
  TrendingUp, Building2, Search, X, ChevronUp, ChevronLeft
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ── Tiny sub-components ────────────────────────────────

function MetricCard({ label, value, icon: Icon, accent = false, sub }: {
  label: string; value: string | number; icon: any; accent?: boolean; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${accent ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>{value}</p>
          {sub && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-[var(--color-active-bg)] flex items-center justify-center">
            <Icon size={20} className="text-[var(--color-ambient)]" />
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 shadow-sm animate-pulse">
      <div className="h-4 w-24 bg-[var(--color-primary)]/5 rounded mb-3" />
      <div className="h-8 w-32 bg-[var(--color-primary)]/10 rounded" />
    </div>
  )
}

function AttBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-[var(--color-text-primary)] opacity-20">—</span>
  const n = Number(value)
  const color = n < 50
    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
    : n < 75
      ? 'bg-amber-50 text-amber-700'
      : 'bg-[var(--color-ambient)]/10 text-[var(--color-success)]'
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${color}`}>{n.toFixed(1)}%</span>
}

function DistributionBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--color-text-secondary)] w-20 shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-[var(--color-primary)]/[0.03] rounded-md overflow-hidden">
        <div className={`h-full rounded-md transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-[var(--color-text-primary)] w-12 text-right">{count}</span>
      <span className="text-[10px] text-[var(--color-text-secondary)] w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  )
}

function CampusCard({ name, batch, avg, below75, below50, total }: {
  name: string; batch: string; avg: number; below75: number; below50: number; total: number
}) {
  const avgN = Number(avg || 0)
  const ringColor = avgN >= 75 ? 'text-[var(--color-success)]' : avgN >= 50 ? 'text-amber-500' : 'text-[var(--color-primary)]'
  const ringPct = Math.min(avgN, 100)

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{name}</h3>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Batch {batch} · {total} students</p>
        </div>
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-[var(--color-primary)]/5" />
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className={ringColor}
              strokeDasharray={`${ringPct * 1.508} 150.8`} strokeLinecap="round" />
          </svg>
          <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${ringColor}`}>{avgN.toFixed(0)}%</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-secondary)]">Below 75%</span>
          <span className="font-semibold text-[var(--color-text-primary)]">{below75}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-secondary)]">Below 50%</span>
          <span className="font-bold text-[var(--color-text-primary)]">{below50}</span>
        </div>
      </div>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────

interface CampusStat {
  name: string
  batch: string
  label: string
  sum: number
  count: number
  below75: number
  below50: number
  avg: number
  total: number
}

interface Distribution {
  '90-100': number
  '75-89': number
  '50-74': number
  '25-49': number
  '0-24': number
  total: number
}

interface AtRiskEntry {
  campus: string
  batch: string
  label: string
  below50: number
  total: number
  pct: number
}

interface FilterOptions {
  campuses: string[]
  batches: Record<string, string[]>
}

interface AttendanceClientProps {
  initialCampusStats: CampusStat[]
  initialDistribution: Distribution | null
  initialAtRisk: AtRiskEntry[]
  initialFilterOptions: FilterOptions
}

// ── Main client component ──────────────────────────────

export default function AttendanceClient({
  initialCampusStats,
  initialDistribution,
  initialAtRisk,
  initialFilterOptions,
}: AttendanceClientProps) {
  const [filters, setFilters] = useState({ campus: '', batch: '', search: '' })
  const [filterOpts] = useState<FilterOptions>(initialFilterOptions)
  const [campusStats] = useState<CampusStat[]>(initialCampusStats)
  const [distribution] = useState<Distribution | null>(initialDistribution)
  const [atRisk] = useState<AtRiskEntry[]>(initialAtRisk)
  const [showTable, setShowTable] = useState(false)
  const [tableData, setTableData] = useState<{ data: any[]; total: number }>({ data: [], total: 0 })
  const [tablePage, setTablePage] = useState(0)
  const [sortBy, setSortBy] = useState('overall_pct')
  const [sortAsc, setSortAsc] = useState(true)
  const [tableLoading, setTableLoading] = useState(false)

  const pageSize = 25

  // Fetch table data client-side when expanded
  const fetchTable = useCallback(async () => {
    if (!showTable) return
    setTableLoading(true)

    const supabase = createClient()
    let query = supabase
      .from('student_attendance')
      .select('*, students!inner(lead_id, student_name, college, batch, campus_name, program_name, active_status)', { count: 'exact' })
      .eq('students.active_status', 'Active')

    if (filters.campus) query = query.eq('students.campus_name', filters.campus)
    if (filters.batch) query = query.eq('students.batch', filters.batch)
    if (filters.search) query = query.ilike('students.student_name', `%${filters.search}%`)

    query = query.order(sortBy, { ascending: sortAsc })
      .range(tablePage * pageSize, (tablePage + 1) * pageSize - 1)

    const { data, count } = await query
    setTableData({ data: data || [], total: count || 0 })
    setTableLoading(false)
  }, [showTable, filters.campus, filters.batch, filters.search, tablePage, sortBy, sortAsc])

  useEffect(() => { fetchTable() }, [fetchTable])

  const updateFilter = (key: string, val: string) => {
    setFilters(f => ({ ...f, [key]: val }))
    setTablePage(0)
  }

  const handleSort = (key: string) => {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(true) }
    setTablePage(0)
  }

  const overallAvg = campusStats.length > 0
    ? campusStats.reduce((s, c) => s + c.sum, 0) / campusStats.reduce((s, c) => s + c.count, 0)
    : 0
  const totalBelow75 = campusStats.reduce((s, c) => s + c.below75, 0)
  const totalBelow50 = campusStats.reduce((s, c) => s + c.below50, 0)
  const totalStudents = campusStats.reduce((s, c) => s + c.count, 0)

  // Table columns
  const columns = [
    { key: 'student_name', label: 'Student', sortable: false, render: (row: any) => (
      <div>
        <div className="font-medium">{row.students?.student_name || '—'}</div>
        <div className="text-xs text-[var(--color-text-secondary)]">{row.students?.campus_name} · {row.students?.batch}</div>
      </div>
    )},
    { key: 'overall_pct', label: 'Overall', align: 'right' as const, width: '90px', render: (row: any) => <AttBadge value={row.overall_pct} /> },
    { key: 'sem1_pct', label: 'S1', align: 'right' as const, width: '70px', render: (row: any) => <AttBadge value={row.sem1_pct} /> },
    { key: 'sem2_pct', label: 'S2', align: 'right' as const, width: '70px', render: (row: any) => <AttBadge value={row.sem2_pct} /> },
    { key: 'sem3_pct', label: 'S3', align: 'right' as const, width: '70px', render: (row: any) => <AttBadge value={row.sem3_pct} /> },
    { key: 'sem4_pct', label: 'S4', align: 'right' as const, width: '70px', render: (row: any) => <AttBadge value={row.sem4_pct} /> },
    { key: 'sem5_pct', label: 'S5', align: 'right' as const, width: '70px', render: (row: any) => <AttBadge value={row.sem5_pct} /> },
    { key: 'sem6_pct', label: 'S6', align: 'right' as const, width: '70px', render: (row: any) => <AttBadge value={row.sem6_pct} /> },
  ]

  const totalPages = Math.ceil(tableData.total / pageSize)
  const from = tablePage * pageSize + 1
  const to = Math.min((tablePage + 1) * pageSize, tableData.total)
  const batches = filters.campus ? (filterOpts.batches[filters.campus] || []) : []

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
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building2 size={14} /> Campus Comparison
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {campusStats.map(c => (
            <CampusCard key={c.label} {...c} />
          ))}
        </div>
      </div>

      {/* Distribution + At Risk side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {distribution && (
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Attendance Distribution</h3>
            <div className="space-y-3">
              <DistributionBar label="90-100%" count={distribution['90-100']} total={distribution.total} color="bg-[var(--color-success)]" />
              <DistributionBar label="75-89%" count={distribution['75-89']} total={distribution.total} color="bg-[var(--color-ambient)]" />
              <DistributionBar label="50-74%" count={distribution['50-74']} total={distribution.total} color="bg-amber-400" />
              <DistributionBar label="25-49%" count={distribution['25-49']} total={distribution.total} color="bg-[var(--color-primary)]/40" />
              <DistributionBar label="0-24%" count={distribution['0-24']} total={distribution.total} color="bg-[var(--color-primary)]" />
            </div>
          </div>
        )}

        {/* At Risk */}
        <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
            At Risk <span className="text-[var(--color-text-secondary)] font-normal">· Below 50% by Campus x Batch</span>
          </h3>
          {atRisk.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] py-4">No students below 50% — great!</p>
          ) : (
            <div className="space-y-2">
              {atRisk.map((r, i) => (
                <div key={i} className="py-2.5 border-b border-[var(--color-border)] last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{r.campus} · Batch {r.batch}</span>
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {r.below50} of {r.total} <span className="text-[var(--color-text-secondary)]">({r.pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-primary)]/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--color-primary)]/40 rounded-full" style={{ width: `${r.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expandable raw data table */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full px-6 py-4 flex items-center justify-between text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors"
        >
          <span>View Student-wise Data</span>
          {showTable ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {showTable && (
          <div className="px-6 pb-6 space-y-4 border-t border-[var(--color-border)] pt-4">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filters.campus}
                onChange={e => { updateFilter('campus', e.target.value); updateFilter('batch', '') }}
                className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              >
                <option value="">All Campuses</option>
                {filterOpts.campuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                value={filters.batch}
                onChange={e => updateFilter('batch', e.target.value)}
                disabled={!filters.campus}
                className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] disabled:opacity-40 focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
              >
                <option value="">All Batches</option>
                {batches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={e => updateFilter('search', e.target.value)}
                  placeholder="Search student..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-[var(--color-border)] bg-white text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-ambient)] transition-colors"
                />
                {filters.search && (
                  <button onClick={() => updateFilter('search', '')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Data table */}
            {tableLoading ? (
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="h-8 bg-[var(--color-primary)]/5 rounded animate-pulse" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-12 bg-[var(--color-primary)]/[0.03] rounded animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--color-primary)]/[0.03]">
                        {columns.map(col => (
                          <th
                            key={col.key}
                            onClick={() => col.sortable !== false && handleSort(col.key)}
                            className={`px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider ${col.sortable !== false ? 'cursor-pointer hover:text-[var(--color-text-primary)] select-none' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
                            style={{ width: col.width }}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {col.sortable !== false && sortBy === col.key && (
                                sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                              )}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {tableData.data.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--color-text-secondary)] text-sm">
                            No data found
                          </td>
                        </tr>
                      ) : (
                        tableData.data.map((row: any, i: number) => (
                          <tr key={row.lead_id || i} className="transition-colors">
                            {columns.map(col => (
                              <td key={col.key} className={`px-4 py-3 text-sm text-[var(--color-text-primary)] ${col.align === 'right' ? 'text-right' : ''}`}>
                                {col.render ? col.render(row) : row[col.key]}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {tableData.total > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      Showing {from}-{to} of {tableData.total}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setTablePage(tablePage - 1)}
                        disabled={tablePage === 0}
                        className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                        {tablePage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setTablePage(tablePage + 1)}
                        disabled={tablePage >= totalPages - 1}
                        className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
