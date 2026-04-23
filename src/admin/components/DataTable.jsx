import { Fragment } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

export function DataTable({ columns, data, sortBy, sortAsc, onSort, page, pageSize, total, onPageChange, loading, onRowClick, expandedRow, renderExpanded }) {
  const totalPages = Math.ceil(total / pageSize)
  const from = page * pageSize + 1
  const to = Math.min((page + 1) * pageSize, total)

  if (loading) return <TableSkeleton columns={columns.length} />

  return (
    <div className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-primary/[0.03]">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && onSort?.(col.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-primary/60 uppercase tracking-wider ${col.sortable !== false ? 'cursor-pointer hover:text-primary select-none' : ''} ${col.align === 'right' ? 'text-right' : ''}`}
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
          <tbody className="divide-y divide-primary/5">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-primary/40 text-sm">
                  No data found
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <Fragment key={row.lead_id || i}>
                  <tr
                    onClick={() => onRowClick?.(row)}
                    className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-ambient/5' : ''} ${expandedRow === (row.lead_id || i) ? 'bg-ambient/5' : ''}`}
                  >
                    {columns.map(col => (
                      <td key={col.key} className={`px-4 py-3 text-sm text-primary ${col.align === 'right' ? 'text-right' : ''} ${col.mono ? 'font-mono' : ''}`}>
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                  {expandedRow === (row.lead_id || i) && renderExpanded && (
                    <tr key={`exp-${row.lead_id || i}`}>
                      <td colSpan={columns.length} className="px-4 py-4 bg-primary/[0.02]">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-primary/5">
          <span className="text-xs text-primary/40">
            Showing {from}–{to} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
              className="p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 py-1 text-xs font-medium text-primary/60">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TableSkeleton({ columns }) {
  return (
    <div className="bg-white rounded-xl border border-primary/10 shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="h-8 bg-primary/5 rounded animate-pulse" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-primary/[0.03] rounded animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
    </div>
  )
}
