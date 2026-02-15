import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Search, Code2, BookOpen, ChevronDown, ChevronRight, Layers, GitBranch, Binary, ArrowLeftRight, Boxes, Flame, Repeat, Sigma, BarChart3, SlidersHorizontal, X, Loader2, ThumbsUp, ThumbsDown, Lightbulb, Users, CheckCircle2 } from 'lucide-react'
import { loadPracticeProblems, loadSolvedMap } from '../lib/db'
import { fetchLeetCodeProblem } from '../lib/api'

const TOPIC_ICONS = {
  'Arrays': Layers,
  'Strings': Code2,
  'Linked List': GitBranch,
  'Trees': GitBranch,
  'Binary Search': Search,
  'Dynamic Programming': BarChart3,
  'Graph': Boxes,
  'Stack': Layers,
  'Greedy': Flame,
  'Backtracking': Repeat,
  'Math': Sigma,
  'Bit Manipulation': Binary,
  'Heap': BarChart3,
  'Sliding Window': SlidersHorizontal,
  'Two Pointers': ArrowLeftRight,
}

const DIFF_COLORS = {
  Easy: { text: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20', dot: 'bg-green-400', hex: '#4ade80' },
  Medium: { text: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/20', dot: 'bg-[#F59E0B]', hex: '#F59E0B' },
  Hard: { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', dot: 'bg-red-400', hex: '#f87171' },
}

function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

// ---- Problem Detail Modal ----

function ProblemModal({ problem, onClose, solvedBy }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showStudents, setShowStudents] = useState(false)

  useEffect(() => {
    fetchLeetCodeProblem(problem.title_slug).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [problem.title_slug])

  const dc = DIFF_COLORS[problem.difficulty] || DIFF_COLORS.Easy
  const students = solvedBy || []

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-[#0A1628] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-[#0A1628] border-b border-white/5 px-6 py-4 flex items-start justify-between z-10">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {data?.question_id && <span className="text-white/20 text-sm font-mono">#{data.question_id}</span>}
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${dc.bg} ${dc.text} border ${dc.border}`}>
                {problem.difficulty}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white">{problem.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ALTA Students solved */}
          {students.length > 0 && (
            <div className="bg-green-400/5 border border-green-400/15 rounded-xl p-4">
              <button onClick={() => setShowStudents(!showStudents)}
                className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-400/10 flex items-center justify-center">
                    <Users size={16} className="text-green-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-green-400">{students.length} ALTA Student{students.length !== 1 ? 's' : ''} Solved</div>
                    <div className="text-[10px] text-white/20">Click to {showStudents ? 'hide' : 'view'} names</div>
                  </div>
                </div>
                {showStudents ? <ChevronDown size={16} className="text-green-400/50" /> : <ChevronRight size={16} className="text-green-400/50" />}
              </button>
              {showStudents && (
                <div className="mt-3 pt-3 border-t border-green-400/10 grid grid-cols-2 gap-1.5">
                  {students.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02]">
                      <CheckCircle2 size={12} className="text-green-400/60 shrink-0" />
                      <span className="text-xs text-white/50 truncate">{s.student_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#F59E0B]" />
            </div>
          ) : data ? (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-green-400 mb-1">
                    <CheckCircle2 size={14} />
                    <span className="text-xs font-medium">Acceptance</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{data.ac_rate}%</div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-[#F59E0B] mb-1">
                    <Users size={14} />
                    <span className="text-xs font-medium">Solved By</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{formatNumber(data.total_accepted)}</div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-white/40 mb-1">
                    <ThumbsUp size={14} />
                    <span className="text-xs font-medium">Likes</span>
                  </div>
                  <div className="text-xl font-bold text-white">{formatNumber(data.likes)}</div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-white/40 mb-1">
                    <ThumbsDown size={14} />
                    <span className="text-xs font-medium">Dislikes</span>
                  </div>
                  <div className="text-xl font-bold text-white">{formatNumber(data.dislikes)}</div>
                </div>
              </div>

              {/* Acceptance bar */}
              <div>
                <div className="flex justify-between text-xs text-white/30 mb-1.5">
                  <span>Accepted: {formatNumber(data.total_accepted)}</span>
                  <span>Submissions: {formatNumber(data.total_submissions)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${data.ac_rate}%`, background: dc.hex }} />
                </div>
              </div>

              {/* Tags */}
              {data.tags?.length > 0 && (
                <div>
                  <div className="text-xs text-white/30 font-medium mb-2">Topics</div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.tags.map(t => (
                      <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-[#F59E0B]/5 border border-[#F59E0B]/15 text-[#F59E0B]/70">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Hints */}
              {data.hints?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-white/30 font-medium mb-2">
                    <Lightbulb size={12} /> Hints
                  </div>
                  <div className="space-y-2">
                    {data.hints.map((h, i) => (
                      <details key={i} className="group">
                        <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60 transition-colors">
                          Hint {i + 1}
                        </summary>
                        <p className="text-xs text-white/30 mt-1 pl-2 border-l border-white/10">{h}</p>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar Questions */}
              {data.similar_questions?.length > 0 && (
                <div>
                  <div className="text-xs text-white/30 font-medium mb-2">Similar Problems</div>
                  <div className="space-y-1">
                    {data.similar_questions.slice(0, 5).map((sq, i) => {
                      const sqDc = DIFF_COLORS[sq.difficulty] || DIFF_COLORS.Easy
                      return (
                        <a key={i} href={`https://leetcode.com/problems/${sq.titleSlug}/`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors group/sq">
                          <span className={`w-1.5 h-1.5 rounded-full ${sqDc.dot}`} />
                          <span className="text-xs text-white/50 group-hover/sq:text-white/80 flex-1 transition-colors">{sq.title}</span>
                          <span className={`text-[10px] ${sqDc.text}`}>{sq.difficulty}</span>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-white/20 text-sm">Could not load problem details.</div>
          )}

          {/* Notes from admin */}
          {problem.notes && (
            <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/15 rounded-lg px-4 py-3">
              <div className="text-[10px] text-[#F59E0B]/50 font-medium uppercase mb-1">Instructor Notes</div>
              <p className="text-sm text-white/60">{problem.notes}</p>
            </div>
          )}

          {/* CTA */}
          <a href={`https://leetcode.com/problems/${problem.title_slug}/`}
            target="_blank" rel="noopener noreferrer"
            className="block w-full text-center px-6 py-3.5 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#050A18] rounded-xl font-bold cv-glow-btn">
            Solve on LeetCode
          </a>
        </div>
      </div>
    </div>
  )
}

// ---- Main Page ----

export default function PracticePage() {
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [openTopics, setOpenTopics] = useState(new Set())
  const [modalProblem, setModalProblem] = useState(null)
  const [solvedMap, setSolvedMap] = useState({})

  useEffect(() => {
    Promise.all([loadPracticeProblems(), loadSolvedMap()]).then(([data, sMap]) => {
      setProblems(data)
      setSolvedMap(sMap)
      const topicSet = new Set(data.map(p => p.topic))
      setOpenTopics(topicSet)
      setLoading(false)
    })
  }, [])

  const filtered = problems.filter(p => {
    if (filter !== 'All' && p.difficulty !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.title.toLowerCase().includes(q) && !(p.tags || []).some(t => t.toLowerCase().includes(q))) return false
    }
    return true
  })

  // Group by topic
  const grouped = {}
  for (const p of filtered) {
    if (!grouped[p.topic]) grouped[p.topic] = []
    grouped[p.topic].push(p)
  }
  const topics = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  const toggleTopic = (topic) => {
    setOpenTopics(prev => {
      const next = new Set(prev)
      next.has(topic) ? next.delete(topic) : next.add(topic)
      return next
    })
  }

  const expandAll = () => setOpenTopics(new Set(topics.map(([t]) => t)))
  const collapseAll = () => setOpenTopics(new Set())

  // Stats
  const totalEasy = problems.filter(p => p.difficulty === 'Easy').length
  const totalMedium = problems.filter(p => p.difficulty === 'Medium').length
  const totalHard = problems.filter(p => p.difficulty === 'Hard').length

  return (
    <div className="min-h-screen bg-[#050A18] text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ background: 'rgba(5, 10, 24, 0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-6 opacity-70" />
            <span className="text-white/20">|</span>
            <span className="text-xl font-bold bg-gradient-to-r from-[#F59E0B] to-white bg-clip-text text-transparent">
              LeetCode Corner
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-white/50 hover:text-white text-sm font-medium transition-colors hidden sm:block">Home</Link>
            <a href="#problems" className="text-white/50 hover:text-white text-sm font-medium transition-colors hidden sm:block">Problems</a>
            <Link to="/portal"
              className="px-5 py-2 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#050A18] rounded-lg font-bold text-sm cv-glow-btn">
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-12 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#F59E0B]/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/5 text-[#F59E0B] text-sm font-medium mb-6">
            <BookOpen size={14} /> Curated by ALTA
          </div>
          <h1 className="text-5xl sm:text-6xl font-black mb-4">
            <span className="bg-gradient-to-r from-white via-[#F59E0B] to-[#D97706] bg-clip-text text-transparent">
              LeetCode Corner
            </span>
          </h1>
          <p className="text-white/40 text-lg mb-8 max-w-xl mx-auto">
            Topic-wise curated problems to level up your DSA skills. Click any problem for details and stats.
          </p>

          {/* Stats pills */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm">
              <span className="text-white font-bold">{problems.length}</span> <span className="text-white/40">Problems</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-green-400/5 border border-green-400/15 text-sm">
              <span className="text-green-400 font-bold">{totalEasy}</span> <span className="text-white/40">Easy</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-[#F59E0B]/5 border border-[#F59E0B]/15 text-sm">
              <span className="text-[#F59E0B] font-bold">{totalMedium}</span> <span className="text-white/40">Medium</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-red-400/5 border border-red-400/15 text-sm">
              <span className="text-red-400 font-bold">{totalHard}</span> <span className="text-white/40">Hard</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter bar */}
      <section id="problems" className="sticky top-[65px] z-40 border-b border-white/5 py-3 px-6" style={{ background: 'rgba(5, 10, 24, 0.9)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            {['All', 'Easy', 'Medium', 'Hard'].map(d => (
              <button key={d} onClick={() => setFilter(d)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  filter === d
                    ? d === 'All' ? 'bg-white/10 text-white'
                      : d === 'Easy' ? 'bg-green-400/15 text-green-400'
                      : d === 'Medium' ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                      : 'bg-red-400/15 text-red-400'
                    : 'text-white/30 hover:text-white/60'
                }`}>{d}</button>
            ))}
          </div>

          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input type="text" placeholder="Search problems or tags..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#F59E0B]/30" />
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button onClick={expandAll} className="text-xs text-white/20 hover:text-white/50 transition-colors">Expand all</button>
            <span className="text-white/10">|</span>
            <button onClick={collapseAll} className="text-xs text-white/20 hover:text-white/50 transition-colors">Collapse all</button>
          </div>

          <div className="text-white/20 text-sm">
            {filtered.length} problem{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      </section>

      {/* Topics accordion */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F59E0B] border-r-transparent" />
            </div>
          ) : topics.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen size={64} className="mx-auto text-white/10 mb-4" />
              <p className="text-white/30 text-lg">
                {problems.length === 0 ? 'No problems added yet. Admins can add them from the admin panel.' : 'No problems match your filters.'}
              </p>
            </div>
          ) : topics.map(([topic, items]) => {
            const Icon = TOPIC_ICONS[topic] || Code2
            const isOpen = openTopics.has(topic)
            const easyCount = items.filter(p => p.difficulty === 'Easy').length
            const medCount = items.filter(p => p.difficulty === 'Medium').length
            const hardCount = items.filter(p => p.difficulty === 'Hard').length

            return (
              <div key={topic} className="rounded-xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
                {/* Accordion header */}
                <button onClick={() => toggleTopic(topic)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-[#F59E0B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white">{topic}</h2>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-white/20 text-xs">{items.length} problem{items.length !== 1 ? 's' : ''}</span>
                      {easyCount > 0 && <span className="text-green-400/60 text-xs">{easyCount}E</span>}
                      {medCount > 0 && <span className="text-[#F59E0B]/60 text-xs">{medCount}M</span>}
                      {hardCount > 0 && <span className="text-red-400/60 text-xs">{hardCount}H</span>}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown size={18} className="text-white/20" /> : <ChevronRight size={18} className="text-white/20" />}
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div className="border-t border-white/[0.04]">
                    {items.map((p, i) => {
                      const dc = DIFF_COLORS[p.difficulty] || DIFF_COLORS.Easy
                      const solvedCount = (solvedMap[p.title_slug] || []).length
                      return (
                        <button key={p.id} onClick={() => setModalProblem(p)}
                          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors text-left border-b border-white/[0.03] last:border-b-0 group">
                          <span className="text-white/10 font-mono text-sm w-6 text-right shrink-0">{i + 1}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${dc.dot}`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-white group-hover:text-[#F59E0B] transition-colors">
                              {p.title}
                            </span>
                            {p.notes && (
                              <span className="text-xs text-white/15 ml-2 hidden sm:inline">&mdash; {p.notes}</span>
                            )}
                          </div>
                          {solvedCount > 0 && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-400/5 border border-green-400/15 text-green-400/60 shrink-0">
                              <CheckCircle2 size={10} /> {solvedCount} ALTA
                            </span>
                          )}
                          <div className="hidden md:flex gap-1.5 shrink-0">
                            {(p.tags || []).slice(0, 3).map(t => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/25">{t}</span>
                            ))}
                          </div>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${dc.bg} ${dc.text} border ${dc.border} shrink-0`}>
                            {p.difficulty}
                          </span>
                          <ExternalLink size={14} className="text-white/10 group-hover:text-[#F59E0B]/50 transition-colors shrink-0" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Modal */}
      {modalProblem && <ProblemModal problem={modalProblem} onClose={() => setModalProblem(null)} solvedBy={solvedMap[modalProblem.title_slug] || []} />}

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-5 opacity-40" />
            <span className="text-white/15">|</span>
            <span className="text-white/30 text-sm">AlgoArena by ALTA School of Technology</span>
          </div>
          <div className="flex items-center gap-6 text-white/20 text-sm">
            <Link to="/" className="hover:text-[#F59E0B] transition-colors">Home</Link>
            <Link to="/portal" className="hover:text-[#F59E0B] transition-colors">Student Portal</Link>
            <Link to="/admin" className="hover:text-[#F59E0B] transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
