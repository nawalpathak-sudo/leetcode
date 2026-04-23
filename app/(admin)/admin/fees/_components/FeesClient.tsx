'use client'

import { useState, useEffect, useCallback } from 'react'
import { IndianRupee, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// --- Types ---

interface Metrics {
  totalFee: number
  totalPaid: number
  totalPending: number
  pendingTillDate: number
  futureScheduled: number
  pendingCount: number
  totalFeeTillDate: number
  total: number
}

interface CampusCollectionItem {
  label: string
  paid: number
  total: number
  count: number
}

interface FilterOptions {
  campuses: string[]
  batches: Record<string, string[]>
}

interface Props {
  metrics: Metrics
  campusCollection: CampusCollectionItem[]
  filterOptions: FilterOptions
}

// --- Helpers ---

function formatINR(num: number | null | undefined): string {
  if (num === null || num === undefined) return '\u2014'
  const n = Number(num)
  if (Math.abs(n) >= 1_00_00_000) return `\u20B9${(n / 1_00_00_000).toFixed(2)} Cr`
  if (Math.abs(n) >= 1_00_000) return `\u20B9${(n / 1_00_000).toFixed(2)} L`
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

// --- Sub-components ---

function MetricCard({ label, value, icon: Icon, sub, accent }: {
  label: string
  value: string
  icon: React.ElementType
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
          <p className="text-xl font-bold mt-1" style={{ color: accent ? 'var(--color-dark-ambient)' : 'var(--color-primary)' }}>{value}</p>
          {sub && <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-active-bg)' }}>
          <Icon size={20} style={{ color: 'var(--color-dark-ambient)' }} />
        </div>
      </div>
    </div>
  )
}

function CollectionBar({ label, paid, total, count }: CampusCollectionItem) {
  const pct = total > 0 ? (paid / total) * 100 : 0
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>{label}</h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>{count} students</p>
        </div>
        <span className="text-lg font-bold" style={{ color: pct >= 80 ? 'var(--color-dark-ambient)' : pct >= 50 ? '#d97706' : 'var(--color-primary)' }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: pct >= 80
              ? 'linear-gradient(to right, var(--color-dark-ambient), var(--color-ambient))'
              : pct >= 50 ? '#fbbf24' : 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
          }}
        />
      </div>
      <div className="flex justify-between text-[11px] mt-3">
        <span style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>
          Collected: <strong style={{ color: 'var(--color-dark-ambient)' }}>{formatINR(paid)}</strong>
        </span>
        <span style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>
          Pending: <strong style={{ color: 'var(--color-primary)' }}>{formatINR(total - paid)}</strong>
        </span>
      </div>
    </div>
  )
}

function SemBreakdown({ row }: { row: any }) {
  const sems = [1, 2, 3, 4, 5, 6]
  const hasData = sems.some(s => Number(row[`sem${s}_fee`] || 0) > 0)
  if (!hasData) return <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>No semester-wise data</p>

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {sems.map(s => {
        const fee = Number(row[`sem${s}_fee`] || 0)
        if (!fee) return null
        const paid = Number(row[`sem${s}_fee_paid`] || 0)
        const pending = Number(row[`sem${s}_fee_pending`] || 0)
        const bucket = row[`sem${s}_pending_bucket`] || ''
        const pct = fee > 0 ? Math.round((paid / fee) * 100) : 0

        return (
          <div key={s} className="bg-white rounded-lg border p-3" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: 'color-mix(in srgb, var(--color-primary) 50%, transparent)' }}>Sem {s}</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>Fee</span>
                <span className="font-medium" style={{ color: 'var(--color-primary)' }}>{formatINR(fee)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>Paid</span>
                <span className="font-medium" style={{ color: 'var(--color-dark-ambient)' }}>{formatINR(paid)}</span>
              </div>
              {pending > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>Pending</span>
                  <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{formatINR(pending)}</span>
                </div>
              )}
              {bucket && (
                <div className="mt-1 px-1.5 py-0.5 rounded text-[10px] text-center"
                  style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)', color: 'color-mix(in srgb, var(--color-primary) 60%, transparent)' }}>
                  {bucket}
                </div>
              )}
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-ambient)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- Main Client Component ---

export default function FeesClient({ metrics: m, campusCollection, filterOptions }: Props) {
  const supabase = createClient()

  const collectionPct = m.totalFeeTillDate > 0 ? ((m.totalPaid / m.totalFeeTillDate) * 100).toFixed(0) : '0'

  // Table state
  const [showTable, setShowTable] = useState(false)
  const [filters, setFilters] = useState({ campus: '', batch: '', search: '', pendingOnly: false })
  const [tableData, setTableData] = useState<{ data: any[]; total: number }>({ data: [], total: 0 })
  const [tablePage, setTablePage] = useState(0)
  const [sortBy, setSortBy] = useState('total_fee_pending')
  const [sortAsc, setSortAsc] = useState(false)
  const [tableLoading, setTableLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const PAGE_SIZE = 25

  const fetchTable = useCallback(async () => {
    if (!showTable) return
    setTableLoading(true)

    let query = supabase
      .from('student_fees')
      .select('*, students!inner(lead_id, student_name, college, batch, campus_name, program_name, active_status)', { count: 'exact' })
      .eq('students.active_status', 'Active')

    if (filters.campus) query = query.eq('students.campus_name', filters.campus)
    if (filters.batch) query = query.eq('students.batch', filters.batch)
    if (filters.search) query = query.ilike('students.student_name', `%${filters.search}%`)
    if (filters.pendingOnly) query = query.gt('total_fee_pending_till_date', 0)

    query = query
      .order(sortBy, { ascending: sortAsc })
      .range(tablePage * PAGE_SIZE, (tablePage + 1) * PAGE_SIZE - 1)

    const { data, count } = await query
    setTableData({ data: data || [], total: count || 0 })
    setTableLoading(false)
  }, [showTable, filters.campus, filters.batch, filters.search, filters.pendingOnly, tablePage, sortBy, sortAsc, supabase])

  useEffect(() => { fetchTable() }, [fetchTable])

  const updateFilter = (key: string, val: string | boolean) => {
    setFilters(f => ({ ...f, [key]: val }))
    setTablePage(0)
    setExpandedRow(null)
  }

  const handleSort = (key: string) => {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(false) }
    setTablePage(0)
  }

  const totalPages = Math.ceil(tableData.total / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard label="Total Fee" value={formatINR(m.totalFee)} icon={IndianRupee} sub={`${m.total} students`} />
        <MetricCard label="Collected" value={formatINR(m.totalPaid)} icon={TrendingUp} accent sub={`${collectionPct}% collection rate`} />
        <MetricCard label="Overdue" value={formatINR(m.pendingTillDate)} icon={AlertTriangle} sub={`${m.pendingCount} students owe now`} />
        <MetricCard label="Upcoming Fees" value={formatINR(m.futureScheduled)} icon={IndianRupee} sub="Not yet due" />
        <MetricCard label="Total Pending" value={formatINR(m.totalPending)} icon={AlertTriangle} sub="Overdue + Upcoming" />
      </div>

      {/* Overall collection bar */}
      {m.totalFeeTillDate > 0 && (
        <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>Collection vs Due Till Date</h3>
            <span className="text-2xl font-bold" style={{ color: 'var(--color-dark-ambient)' }}>{collectionPct}%</span>
          </div>
          <div className="h-4 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(Number(collectionPct), 100)}%`,
                background: 'linear-gradient(to right, var(--color-dark-ambient), var(--color-ambient))',
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs" style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>
            <span>Collected: {formatINR(m.totalPaid)}</span>
            <span>Due till date: {formatINR(m.totalFeeTillDate)}</span>
            <span>Overdue: {formatINR(m.pendingTillDate)}</span>
          </div>
        </div>
      )}

      {/* Campus-wise collection */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
          style={{ color: 'color-mix(in srgb, var(--color-primary) 60%, transparent)' }}>
          <Building2 size={14} /> Campus-wise Collection
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campusCollection.map(c => (
            <CollectionBar key={c.label} {...c} />
          ))}
        </div>
      </div>

      {/* Highest overdue + Collection rate panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>
            Highest Overdue <span className="font-normal" style={{ color: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>by Campus x Batch</span>
          </h3>
          {campusCollection.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>No data</p>
          ) : (
            <div className="space-y-2">
              {campusCollection
                .map(c => ({ ...c, overdue: c.total - c.paid }))
                .filter(c => c.overdue > 0)
                .sort((a, b) => b.overdue - a.overdue)
                .slice(0, 8)
                .map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{c.label}</span>
                      <span className="text-xs ml-2" style={{ color: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>{c.count} students</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>{formatINR(c.overdue)}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6 shadow-sm" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>
            Collection Rate <span className="font-normal" style={{ color: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' }}>Campus x Batch ranking</span>
          </h3>
          {campusCollection.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>No data</p>
          ) : (
            <div className="space-y-3">
              {campusCollection
                .map(c => ({ ...c, pct: c.total > 0 ? (c.paid / c.total) * 100 : 0 }))
                .sort((a, b) => a.pct - b.pct)
                .slice(0, 8)
                .map((c, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>{c.label}</span>
                      <span className="text-xs font-bold" style={{ color: c.pct >= 80 ? 'var(--color-dark-ambient)' : c.pct >= 50 ? '#d97706' : 'var(--color-primary)' }}>
                        {c.pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${c.pct}%`,
                          background: c.pct >= 80 ? 'var(--color-dark-ambient)' : c.pct >= 50 ? '#fbbf24' : 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
                        }}
                      />
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Expandable student-wise table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full px-6 py-4 flex items-center justify-between text-sm font-medium transition-colors"
          style={{ color: 'color-mix(in srgb, var(--color-primary) 60%, transparent)' }}
        >
          <span>View Student-wise Data</span>
          {showTable ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {showTable && (
          <div className="px-6 pb-6 space-y-4 pt-4" style={{ borderTop: '1px solid color-mix(in srgb, var(--color-primary) 5%, transparent)' }}>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={filters.campus}
                onChange={e => { updateFilter('campus', e.target.value); updateFilter('batch', '') }}
                className="px-3 py-2 rounded-lg text-sm border bg-white"
                style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
              >
                <option value="">All Campuses</option>
                {filterOptions.campuses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                value={filters.batch}
                onChange={e => updateFilter('batch', e.target.value)}
                className="px-3 py-2 rounded-lg text-sm border bg-white"
                style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
              >
                <option value="">All Batches</option>
                {(filters.campus ? filterOptions.batches[filters.campus] || [] : []).map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              <input
                type="text"
                placeholder="Search student..."
                value={filters.search}
                onChange={e => updateFilter('search', e.target.value)}
                className="px-3 py-2 rounded-lg text-sm border bg-white min-w-[200px]"
                style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
              />

              <button
                onClick={() => updateFilter('pendingOnly', !filters.pendingOnly)}
                className="px-3 py-2 rounded-lg text-sm border transition-colors"
                style={{
                  background: filters.pendingOnly ? 'var(--color-primary)' : 'var(--color-white)',
                  color: filters.pendingOnly ? 'var(--color-white)' : 'color-mix(in srgb, var(--color-primary) 60%, transparent)',
                  borderColor: filters.pendingOnly ? 'var(--color-primary)' : 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
                }}
              >
                Pending Only
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid color-mix(in srgb, var(--color-primary) 10%, transparent)' }}>
                    <th className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'color-mix(in srgb, var(--color-primary) 50%, transparent)' }}>Student</th>
                    {['total_fee', 'total_fee_paid', 'total_fee_pending', 'total_fee_pending_till_date'].map(col => {
                      const labels: Record<string, string> = { total_fee: 'Total', total_fee_paid: 'Paid', total_fee_pending: 'Pending', total_fee_pending_till_date: 'Due Now' }
                      return (
                        <th
                          key={col}
                          className="text-right py-3 px-3 font-semibold text-xs uppercase tracking-wider cursor-pointer select-none"
                          style={{ color: 'color-mix(in srgb, var(--color-primary) 50%, transparent)', width: '110px' }}
                          onClick={() => handleSort(col)}
                        >
                          {labels[col]} {sortBy === col ? (sortAsc ? '\u2191' : '\u2193') : ''}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="py-3 px-3">
                            <div className="h-4 rounded animate-pulse" style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : tableData.data.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm" style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>
                        No fee records found
                      </td>
                    </tr>
                  ) : (
                    tableData.data.map((row: any) => {
                      const id = row.lead_id
                      const isExpanded = expandedRow === id
                      return (
                        <tbody key={id}>
                          <tr
                            className="cursor-pointer transition-colors"
                            style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-primary) 5%, transparent)' }}
                            onClick={() => setExpandedRow(isExpanded ? null : id)}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = '')}
                          >
                            <td className="py-3 px-3">
                              <div className="font-medium" style={{ color: 'var(--color-primary)' }}>{row.students?.student_name || '\u2014'}</div>
                              <div className="text-xs" style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>
                                {row.students?.campus_name} &middot; {row.students?.batch}
                              </div>
                            </td>
                            <td className="text-right py-3 px-3 text-xs" style={{ color: 'var(--color-primary)' }}>{formatINR(row.total_fee)}</td>
                            <td className="text-right py-3 px-3 text-xs font-medium" style={{ color: 'var(--color-dark-ambient)' }}>{formatINR(row.total_fee_paid)}</td>
                            <td className="text-right py-3 px-3 text-xs" style={{ color: Number(row.total_fee_pending || 0) > 0 ? 'var(--color-primary)' : 'color-mix(in srgb, var(--color-primary) 30%, transparent)', fontWeight: Number(row.total_fee_pending || 0) > 0 ? 600 : 400 }}>
                              {formatINR(row.total_fee_pending)}
                            </td>
                            <td className="text-right py-3 px-3 text-xs" style={{ color: Number(row.total_fee_pending_till_date || 0) > 0 ? 'var(--color-primary)' : 'color-mix(in srgb, var(--color-primary) 30%, transparent)', fontWeight: Number(row.total_fee_pending_till_date || 0) > 0 ? 700 : 400 }}>
                              {formatINR(row.total_fee_pending_till_date)}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="p-4" style={{ background: 'var(--color-bg)' }}>
                                <SemBreakdown row={row} />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs" style={{ color: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>
                  Showing {tablePage * PAGE_SIZE + 1}–{Math.min((tablePage + 1) * PAGE_SIZE, tableData.total)} of {tableData.total}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={tablePage === 0}
                    onClick={() => setTablePage(p => p - 1)}
                    className="px-3 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-30"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
                  >
                    Prev
                  </button>
                  <button
                    disabled={tablePage >= totalPages - 1}
                    onClick={() => setTablePage(p => p + 1)}
                    className="px-3 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-30"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-primary) 15%, transparent)', color: 'var(--color-primary)' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
