import { useState, useEffect, useCallback } from 'react'
import { IndianRupee, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Building2 } from 'lucide-react'
import { MetricCard, MetricCardSkeleton } from '../../components/MetricCard'
import { FilterBar } from '../../components/FilterBar'
import { DataTable } from '../../components/DataTable'
import { loadFees, loadFilterOptions, formatINR } from '../../../lib/adminDb'
import { supabase } from '../../../lib/supabase'

function CollectionBar({ label, paid, total, count }) {
  const pct = total > 0 ? (paid / total) * 100 : 0
  return (
    <div className="bg-white rounded-xl border border-primary/10 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-primary">{label}</h3>
          <p className="text-[11px] text-primary/40 mt-0.5">{count} students</p>
        </div>
        <span className={`text-lg font-bold ${pct >= 80 ? 'text-dark-ambient' : pct >= 50 ? 'text-amber-600' : 'text-primary'}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2.5 bg-primary/5 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-gradient-to-r from-dark-ambient to-ambient' : pct >= 50 ? 'bg-amber-400' : 'bg-primary/40'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-primary/40">Collected: <strong className="text-dark-ambient">{formatINR(paid)}</strong></span>
        <span className="text-primary/40">Pending: <strong className="text-primary">{formatINR(total - paid)}</strong></span>
      </div>
    </div>
  )
}


function SemBreakdown({ row }) {
  const sems = [1, 2, 3, 4, 5, 6]
  const hasData = sems.some(s => Number(row[`sem${s}_fee`] || 0) > 0)
  if (!hasData) return <p className="text-sm text-primary/40">No semester-wise data</p>

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
          <div key={s} className="bg-white rounded-lg border border-primary/10 p-3">
            <div className="text-xs font-semibold text-primary/50 mb-2">Sem {s}</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-primary/40">Fee</span><span className="font-medium text-primary">{formatINR(fee)}</span></div>
              <div className="flex justify-between"><span className="text-primary/40">Paid</span><span className="text-dark-ambient font-medium">{formatINR(paid)}</span></div>
              {pending > 0 && <div className="flex justify-between"><span className="text-primary/40">Pending</span><span className="font-semibold text-primary">{formatINR(pending)}</span></div>}
              {bucket && <div className="mt-1 px-1.5 py-0.5 bg-primary/5 rounded text-[10px] text-primary/60 text-center">{bucket}</div>}
            </div>
            <div className="mt-2 h-1.5 bg-primary/5 rounded-full overflow-hidden">
              <div className="h-full bg-ambient rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
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
  { key: 'total_fee', label: 'Total', render: row => <span className="text-xs">{formatINR(row.total_fee)}</span>, align: 'right', width: '110px' },
  { key: 'total_fee_paid', label: 'Paid', render: row => <span className="text-xs text-dark-ambient font-medium">{formatINR(row.total_fee_paid)}</span>, align: 'right', width: '110px' },
  { key: 'total_fee_pending', label: 'Pending', render: row => {
    const p = Number(row.total_fee_pending || 0)
    return <span className={`text-xs ${p > 0 ? 'text-primary font-semibold' : 'text-primary/30'}`}>{formatINR(row.total_fee_pending)}</span>
  }, align: 'right', width: '110px' },
  { key: 'total_fee_pending_till_date', label: 'Due Now', render: row => {
    const p = Number(row.total_fee_pending_till_date || 0)
    return <span className={`text-xs ${p > 0 ? 'text-primary font-bold' : 'text-primary/30'}`}>{formatINR(row.total_fee_pending_till_date)}</span>
  }, align: 'right', width: '110px' },
]

export default function FeesPage() {
  const [loading, setLoading] = useState(true)
  const [filterOpts, setFilterOpts] = useState({ campuses: [], batches: {} })
  const [campusCollection, setCampusCollection] = useState([])
  const [topMetrics, setTopMetrics] = useState({})
  const [showTable, setShowTable] = useState(false)
  const [filters, setFilters] = useState({ campus: '', batch: '', search: '', pendingOnly: false })
  const [tableData, setTableData] = useState({ data: [], total: 0 })
  const [tablePage, setTablePage] = useState(0)
  const [sortBy, setSortBy] = useState('total_fee_pending')
  const [sortAsc, setSortAsc] = useState(false)
  const [tableLoading, setTableLoading] = useState(false)
  const [expandedRow, setExpandedRow] = useState(null)

  useEffect(() => {
    Promise.all([
      loadFilterOptions(),
      loadFeeBreakdown(),
    ]).then(([opts]) => {
      setFilterOpts(opts)
      setLoading(false)
    })
  }, [])

  async function loadFeeBreakdown() {
    const { data } = await supabase
      .from('student_fees')
      .select('*, students!inner(student_name, campus_name, batch, active_status)')
      .eq('students.active_status', 'Active')
      .limit(1000)

    if (!data?.length) return

    let totalFee = 0, totalPaid = 0, totalPending = 0, pendingTillDate = 0, pendingCount = 0, totalFeeTillDate = 0

    const bycamp = {}

    data.forEach(row => {
      const campus = row.students?.campus_name || 'Unknown'
      const batch = row.students?.batch || 'Unknown'
      const key = `${campus} · ${batch}`
      const fee = Number(row.total_fee || 0)
      const paid = Number(row.total_fee_paid || 0)
      const pending = Number(row.total_fee_pending || 0)
      const ptd = Number(row.total_fee_pending_till_date || 0)
      const ftd = Number(row.total_fee_till_date || 0)

      totalFee += fee
      totalPaid += paid
      totalPending += pending
      pendingTillDate += ptd
      totalFeeTillDate += ftd
      if (ptd > 0) pendingCount++

      // Campus bars use fee_till_date as target (what's due so far, not full 4-year)
      if (!bycamp[key]) bycamp[key] = { label: `${campus} · Batch ${batch}`, paid: 0, total: 0, count: 0 }
      bycamp[key].paid += paid
      bycamp[key].total += ftd
      bycamp[key].count++

    })

    const futureScheduled = totalPending - pendingTillDate
    setTopMetrics({ totalFee, totalPaid, totalPending, pendingTillDate, futureScheduled, pendingCount, totalFeeTillDate, total: data.length })
    setCampusCollection(Object.values(bycamp).sort((a, b) => (b.paid / b.total) - (a.paid / a.total)))
  }

  // Table data
  const fetchTable = useCallback(async () => {
    if (!showTable) return
    setTableLoading(true)
    const result = await loadFees({
      campus: filters.campus, batch: filters.batch, search: filters.search,
      pendingOnly: filters.pendingOnly, page: tablePage, sortBy, sortAsc
    })
    setTableData(result)
    setTableLoading(false)
  }, [showTable, filters.campus, filters.batch, filters.search, filters.pendingOnly, tablePage, sortBy, sortAsc])

  useEffect(() => { fetchTable() }, [fetchTable])

  const updateFilter = (key, val) => {
    setFilters(f => ({ ...f, [key]: val }))
    setTablePage(0)
    setExpandedRow(null)
  }

  const handleSort = (key) => {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(false) }
    setTablePage(0)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  const m = topMetrics
  const collectionPct = m.totalFeeTillDate > 0 ? ((m.totalPaid / m.totalFeeTillDate) * 100).toFixed(0) : 0

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

      {/* Overall collection bar — against fee due till date, not full 4-year fee */}
      {m.totalFeeTillDate > 0 && (
        <div className="bg-white rounded-xl border border-primary/10 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-primary">Collection vs Due Till Date</h3>
            <span className="text-2xl font-bold text-dark-ambient">{collectionPct}%</span>
          </div>
          <div className="h-4 bg-primary/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-dark-ambient to-ambient rounded-full transition-all duration-700"
              style={{ width: `${Math.min(collectionPct, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-primary/40">
            <span>Collected: {formatINR(m.totalPaid)}</span>
            <span>Due till date: {formatINR(m.totalFeeTillDate)}</span>
            <span>Overdue: {formatINR(m.pendingTillDate)}</span>
          </div>
        </div>
      )}

      {/* Campus-wise collection */}
      <div>
        <h2 className="text-sm font-semibold text-primary/60 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Building2 size={14} /> Campus-wise Collection
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campusCollection.map(c => (
            <CollectionBar key={c.label} {...c} />
          ))}
        </div>
      </div>

      {/* Top defaulting campus×batch + overdue aging */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Highest overdue by campus×batch */}
        <div className="bg-white rounded-xl border border-primary/10 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-primary mb-4">
            Highest Overdue <span className="text-primary/30 font-normal">· by Campus × Batch</span>
          </h3>
          {campusCollection.length === 0 ? (
            <p className="text-sm text-primary/40 py-4">No data</p>
          ) : (
            <div className="space-y-2">
              {campusCollection
                .map(c => ({ ...c, overdue: c.total - c.paid }))
                .filter(c => c.overdue > 0)
                .sort((a, b) => b.overdue - a.overdue)
                .slice(0, 8)
                .map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-primary/5 last:border-0">
                    <div>
                      <span className="text-sm font-medium text-primary">{c.label}</span>
                      <span className="text-xs text-primary/30 ml-2">{c.count} students</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{formatINR(c.overdue)}</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Overdue concentration */}
        <div className="bg-white rounded-xl border border-primary/10 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-primary mb-4">
            Collection Rate <span className="text-primary/30 font-normal">· Campus × Batch ranking</span>
          </h3>
          {campusCollection.length === 0 ? (
            <p className="text-sm text-primary/40 py-4">No data</p>
          ) : (
            <div className="space-y-3">
              {campusCollection
                .map(c => ({ ...c, pct: c.total > 0 ? (c.paid / c.total) * 100 : 0 }))
                .sort((a, b) => a.pct - b.pct)
                .slice(0, 8)
                .map((c, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-primary">{c.label}</span>
                      <span className={`text-xs font-bold ${c.pct >= 80 ? 'text-dark-ambient' : c.pct >= 50 ? 'text-amber-600' : 'text-primary'}`}>{c.pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-primary/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${c.pct >= 80 ? 'bg-dark-ambient' : c.pct >= 50 ? 'bg-amber-400' : 'bg-primary/40'}`}
                        style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))
              }
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
            >
              <button
                onClick={() => updateFilter('pendingOnly', !filters.pendingOnly)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                  filters.pendingOnly
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-primary/60 border-primary/15 hover:border-primary/30'
                }`}
              >
                Pending Only
              </button>
            </FilterBar>
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
              onRowClick={row => setExpandedRow(expandedRow === row.lead_id ? null : row.lead_id)}
              expandedRow={expandedRow}
              renderExpanded={row => <SemBreakdown row={row} />}
            />
          </div>
        )}
      </div>
    </div>
  )
}
