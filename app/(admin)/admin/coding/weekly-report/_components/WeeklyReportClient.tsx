'use client';

import { useState, useMemo } from 'react';
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Users, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface Row {
  name: string; campus: string; batch: string; username: string;
  w3: number; w2: number; w1: number; w0: number;
  easy: number; med: number; hard: number; total: number;
}

type SortKey = keyof Row;
type SortDir = 'asc' | 'desc';

function cellColor(val: number, max: number) {
  if (max === 0) return {};
  if (val === 0) return { backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444' };
  const pct = val / max;
  if (pct >= 0.7) return { backgroundColor: 'rgba(34,172,209,0.12)', color: '#22ACD1', fontWeight: 600 };
  if (pct >= 0.4) return { backgroundColor: 'rgba(59,195,226,0.06)', color: 'var(--color-text-primary)' };
  return { color: 'var(--color-text-secondary)' };
}

function diffColor(val: number) {
  if (val === 0) return { color: 'var(--color-text-secondary)' };
  return { color: 'var(--color-text-primary)', fontWeight: 500 };
}

export default function WeeklyReportClient({ rows, weekLabels }: { rows: Row[]; weekLabels: string[] }) {
  const [search, setSearch] = useState('');
  const [campus, setCampus] = useState('');
  const [batch, setBatch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const campuses = useMemo(() => [...new Set(rows.map(r => r.campus).filter(Boolean))].sort(), [rows]);
  const batches = useMemo(() => [...new Set(rows.map(r => r.batch).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    let f = rows;
    if (campus) f = f.filter(r => r.campus === campus);
    if (batch) f = f.filter(r => r.batch === batch);
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(r => r.name.toLowerCase().includes(q) || r.username.toLowerCase().includes(q));
    }
    f.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return f;
  }, [rows, campus, batch, search, sortKey, sortDir]);

  const maxWeekly = useMemo(() => Math.max(...rows.map(r => Math.max(r.w0, r.w1, r.w2, r.w3)), 1), [rows]);
  const maxTotal = useMemo(() => Math.max(...rows.map(r => r.total), 1), [rows]);

  const activeThisWeek = rows.filter(r => r.w0 > 0).length;
  const avgTotal = rows.length ? Math.round(rows.reduce((s, r) => s + r.total, 0) / rows.length) : 0;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown size={12} className="opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  }

  function exportCSV() {
    const headers = ['Name', 'Campus', 'Batch', 'Username', ...weekLabels, 'YTD Easy', 'YTD Medium', 'YTD Hard', 'YTD Total'];
    const csvRows = filtered.map(r => [r.name, r.campus, r.batch, r.username, r.w3, r.w2, r.w1, r.w0, r.easy, r.med, r.hard, r.total].join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leetcode-weekly-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const cols: { key: SortKey; label: string; width: string }[] = [
    { key: 'name', label: 'Student', width: 'min-w-[180px]' },
    { key: 'campus', label: 'Campus', width: 'min-w-[80px]' },
    { key: 'batch', label: 'Batch', width: 'min-w-[60px]' },
    { key: 'username', label: 'Username', width: 'min-w-[120px]' },
    { key: 'w3', label: weekLabels[0], width: 'min-w-[110px]' },
    { key: 'w2', label: weekLabels[1], width: 'min-w-[110px]' },
    { key: 'w1', label: weekLabels[2], width: 'min-w-[110px]' },
    { key: 'w0', label: weekLabels[3], width: 'min-w-[110px]' },
    { key: 'easy', label: 'Easy', width: 'min-w-[60px]' },
    { key: 'med', label: 'Medium', width: 'min-w-[70px]' },
    { key: 'hard', label: 'Hard', width: 'min-w-[60px]' },
    { key: 'total', label: 'Total', width: 'min-w-[60px]' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>LeetCode Weekly Report</h1>
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { icon: Users, label: 'Total Students', value: rows.length, color: 'var(--color-primary)' },
          { icon: TrendingUp, label: 'Avg Problems (YTD)', value: avgTotal, color: 'var(--color-ambient)' },
          { icon: CheckCircle, label: 'Active This Week', value: activeThisWeek, color: '#22C55E' },
          { icon: AlertTriangle, label: 'Inactive This Week', value: rows.length - activeThisWeek, color: '#EF4444' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color + '12' }}>
                <s.icon size={20} style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or username..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[var(--color-ambient)]" />
        </div>
        <select value={campus} onChange={e => setCampus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
          <option value="">All Campuses</option>
          {campuses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={batch} onChange={e => setBatch(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none">
          <option value="">All Batches</option>
          {batches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{filtered.length} students</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100" style={{ backgroundColor: 'var(--color-bg)' }}>
                <th className="px-3 py-3 text-left text-xs font-semibold w-10" style={{ color: 'var(--color-text-secondary)' }}>#</th>
                {cols.map(c => (
                  <th key={c.key} onClick={() => toggleSort(c.key)}
                    className={`px-3 py-3 text-left text-xs font-semibold cursor-pointer select-none hover:bg-gray-50 ${c.width}`}
                    style={{ color: 'var(--color-text-secondary)' }}>
                    <div className="flex items-center gap-1">
                      {c.label} <SortIcon col={c.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--color-text-primary)' }}>{r.name}</td>
                  <td className="px-3 py-2.5" style={{ color: 'var(--color-text-secondary)' }}>{r.campus}</td>
                  <td className="px-3 py-2.5" style={{ color: 'var(--color-text-secondary)' }}>{r.batch}</td>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>{r.username}</td>
                  <td className="px-3 py-2.5 text-center" style={cellColor(r.w3, maxWeekly)}>{r.w3}</td>
                  <td className="px-3 py-2.5 text-center" style={cellColor(r.w2, maxWeekly)}>{r.w2}</td>
                  <td className="px-3 py-2.5 text-center" style={cellColor(r.w1, maxWeekly)}>{r.w1}</td>
                  <td className="px-3 py-2.5 text-center" style={cellColor(r.w0, maxWeekly)}>{r.w0}</td>
                  <td className="px-3 py-2.5 text-center"><span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-600" style={diffColor(r.easy)}>{r.easy}</span></td>
                  <td className="px-3 py-2.5 text-center"><span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-600" style={diffColor(r.med)}>{r.med}</span></td>
                  <td className="px-3 py-2.5 text-center"><span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600" style={diffColor(r.hard)}>{r.hard}</span></td>
                  <td className="px-3 py-2.5 text-center font-bold" style={cellColor(r.total, maxTotal)}>{r.total}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={13} className="px-3 py-12 text-center text-gray-400">No students found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
