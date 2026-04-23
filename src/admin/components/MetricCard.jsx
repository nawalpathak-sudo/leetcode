export function MetricCard({ label, value, icon: Icon, accent = false, sub }) {
  return (
    <div className="bg-white rounded-xl border border-primary/10 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-primary/50">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${accent ? 'text-dark-ambient' : 'text-primary'}`}>{value}</p>
          {sub && <p className="text-xs text-primary/40 mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-ambient/10 flex items-center justify-center">
            <Icon size={20} className="text-ambient" />
          </div>
        )}
      </div>
    </div>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-primary/10 p-6 shadow-sm animate-pulse">
      <div className="h-4 w-24 bg-primary/5 rounded mb-3" />
      <div className="h-8 w-32 bg-primary/10 rounded" />
    </div>
  )
}
