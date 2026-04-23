'use client'
import { Zap, CalendarDays, TrendingUp } from 'lucide-react'

export function ActivityStrip({ activity, label }) {
  if (!activity) return null
  return (
    <div className="bg-white rounded-xl border border-primary/10 shadow-sm p-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-xs text-primary/50 font-medium flex items-center justify-center gap-1 mb-1">
            <Zap size={12} className="text-dark-ambient" /> Yesterday
          </div>
          <div className="text-2xl font-bold text-dark-ambient">{activity.yesterday}</div>
          <div className="text-[10px] text-primary/30">{label}</div>
        </div>
        <div className="text-center border-x border-primary/10">
          <div className="text-xs text-primary/50 font-medium flex items-center justify-center gap-1 mb-1">
            <CalendarDays size={12} /> Last 7 Days
          </div>
          <div className="text-2xl font-bold text-primary">{activity.last7}</div>
          <div className="text-[10px] text-primary/30">{label}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-primary/50 font-medium flex items-center justify-center gap-1 mb-1">
            <TrendingUp size={12} /> Last 30 Days
          </div>
          <div className="text-2xl font-bold text-primary">{activity.last30}</div>
          <div className="text-[10px] text-primary/30">{label}</div>
        </div>
      </div>
    </div>
  )
}
