'use client'

import { Users, UserCheck, Building2, RefreshCw } from 'lucide-react'

interface Props {
  totalStudents: number
  activeStudents: number
  campusCounts: Record<string, number>
  lastSync: any
}

export default function DashboardClient({ totalStudents, activeStudents, campusCounts, lastSync }: Props) {
  const stats = [
    { label: 'Total Students', value: totalStudents, icon: Users, color: 'var(--color-primary)' },
    { label: 'Active Students', value: activeStudents, icon: UserCheck, color: 'var(--color-dark-ambient)' },
    { label: 'Campuses', value: Object.keys(campusCounts).length, icon: Building2, color: 'var(--color-ambient)' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border p-6" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{stat.label}</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--color-active-bg)' }}>
                  <Icon size={24} style={{ color: 'var(--color-dark-ambient)' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Campus breakdown */}
      <div className="bg-white rounded-xl shadow-sm border p-6" style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-primary)' }}>
          Students by Campus
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(campusCounts).sort((a, b) => b[1] - a[1]).map(([campus, count]) => (
            <div key={campus} className="text-center p-4 rounded-lg" style={{ background: 'var(--color-bg)' }}>
              <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{count}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{campus}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Last sync */}
      {lastSync && (
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <RefreshCw size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Last sync: {new Date(lastSync.started_at).toLocaleString()} — {lastSync.status}
            {lastSync.rows_upserted ? ` (${lastSync.rows_upserted} rows)` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
