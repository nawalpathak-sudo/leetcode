import { Search, X } from 'lucide-react'

export function FilterBar({ campuses, batchesByCampus, campus, batch, search, onCampusChange, onBatchChange, onSearchChange, children }) {
  const batches = campus ? (batchesByCampus[campus] || []) : []

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={campus}
        onChange={e => { onCampusChange(e.target.value); onBatchChange('') }}
        className="px-3 py-2 rounded-lg border border-primary/15 bg-white text-sm text-primary focus:outline-none focus:border-ambient transition-colors"
      >
        <option value="">All Campuses</option>
        {campuses.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      <select
        value={batch}
        onChange={e => onBatchChange(e.target.value)}
        disabled={!campus}
        className="px-3 py-2 rounded-lg border border-primary/15 bg-white text-sm text-primary disabled:opacity-40 focus:outline-none focus:border-ambient transition-colors"
      >
        <option value="">All Batches</option>
        {batches.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/30" />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search student..."
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-primary/15 bg-white text-sm text-primary placeholder:text-primary/30 focus:outline-none focus:border-ambient transition-colors"
        />
        {search && (
          <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary">
            <X size={14} />
          </button>
        )}
      </div>

      {children}
    </div>
  )
}
