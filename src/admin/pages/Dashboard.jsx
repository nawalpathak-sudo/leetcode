import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, CalendarCheck, IndianRupee, Code2, AlertTriangle, Clock, TrendingUp, UserX } from 'lucide-react'
import { MetricCard, MetricCardSkeleton } from '../components/MetricCard'
import { loadDashboardStats, formatINR } from '../../lib/adminDb'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadDashboardStats().then(data => {
      setStats(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <MetricCardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Primary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => navigate('/admin/coding/students')} className="cursor-pointer">
          <MetricCard
            label="Total Students"
            value={stats.totalStudents}
            icon={Users}
            sub={`${stats.activeStudents} active`}
          />
        </div>
        <div onClick={() => navigate('/admin/attendance')} className="cursor-pointer">
          <MetricCard
            label="Avg Attendance"
            value={`${stats.avgAttendance}%`}
            icon={CalendarCheck}
            accent
          />
        </div>
        <div onClick={() => navigate('/admin/fees')} className="cursor-pointer">
          <MetricCard
            label="Total Fees Collected"
            value={formatINR(stats.totalPaid)}
            icon={IndianRupee}
            sub={`of ${formatINR(stats.totalFee)}`}
          />
        </div>
        <MetricCard
          label="Coding Profiles"
          value={stats.codingProfiles}
          icon={Code2}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div onClick={() => navigate('/admin/attendance')} className="cursor-pointer">
          <MetricCard
            label="Below 75% Attendance"
            value={stats.belowAttendance}
            icon={AlertTriangle}
          />
        </div>
        <div onClick={() => navigate('/admin/fees')} className="cursor-pointer">
          <MetricCard
            label="Fees Pending (Students)"
            value={stats.feesPendingCount}
            icon={UserX}
            sub={`${formatINR(stats.totalPending)} total pending`}
          />
        </div>
        <MetricCard
          label="Last Sync"
          value={stats.lastSync ? new Date(stats.lastSync.finished_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
          icon={Clock}
          sub={stats.lastSync ? `${stats.lastSync.rows_fetched} rows · ${stats.lastSync.status}` : null}
        />
      </div>

      {/* Fee collection bar */}
      {stats.totalFee > 0 && (
        <div className="bg-white rounded-xl border border-primary/10 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-primary">Fee Collection Progress</h3>
            <span className="text-xs text-primary/40">
              {Math.round((stats.totalPaid / stats.totalFee) * 100)}% collected
            </span>
          </div>
          <div className="h-3 bg-primary/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-dark-ambient to-ambient rounded-full transition-all duration-700"
              style={{ width: `${Math.min((stats.totalPaid / stats.totalFee) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-primary/40">
            <span>Collected: {formatINR(stats.totalPaid)}</span>
            <span>Pending: {formatINR(stats.totalPending)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
