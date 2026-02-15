import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Trophy, Code2, Users, Zap, ExternalLink, Play, Sparkles, ArrowRight, Star, TrendingUp, Target, Flame, Award, Crown, CalendarDays } from 'lucide-react'
import { loadAllProfiles } from '../lib/db'
import { computeRecentActivity } from '../lib/activity'

// ---- CONFIG: Edit these to update banners & content ----

const BANNERS = [
  { image: '', title: 'Hackathon 2025', subtitle: 'Register Now', link: '#', gradient: 'from-[#F59E0B]/20 to-[#0D1E56]/40' },
  { image: '', title: 'Code Sprint', subtitle: 'Weekly Challenge', link: '#', gradient: 'from-[#FFA116]/20 to-[#0D1E56]/40' },
  { image: '', title: 'DSA Bootcamp', subtitle: 'Starts Feb 20', link: '#', gradient: 'from-[#D97706]/20 to-[#0D1E56]/40' },
  { image: '', title: 'Open Source Day', subtitle: 'Contribute & Learn', link: '#', gradient: 'from-[#F97316]/20 to-[#0D1E56]/40' },
]

const AI_NEWS = [
  { title: 'Claude 4 Changes Everything', desc: 'Anthropic releases their most capable model yet with extended thinking and tool use capabilities.' },
  { title: 'LLMs in Competitive Programming', desc: 'How AI models are now solving IOI-level problems and what it means for coders.' },
  { title: 'Build AI Agents with LangChain', desc: 'A practical guide to building autonomous AI agents that can code, debug, and deploy.' },
]

const YOUTUBE_EMBED_ID = '' // Paste a YouTube video ID here, e.g. 'dQw4w9WgXcQ'

// ---- HOOKS ----

function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

function AnimateIn({ children, className = '', delay = 0 }) {
  const [ref, inView] = useInView()
  return (
    <div ref={ref}
      className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

function AnimatedNumber({ value, suffix = '' }) {
  const [ref, inView] = useInView()
  const [num, setNum] = useState(0)
  useEffect(() => {
    if (!inView || !value) return
    let current = 0
    const step = Math.max(1, Math.ceil(value / 60))
    const t = setInterval(() => {
      current += step
      if (current >= value) { setNum(value); clearInterval(t) }
      else setNum(current)
    }, 20)
    return () => clearInterval(t)
  }, [inView, value])
  return <span ref={ref}>{num.toLocaleString()}{suffix}</span>
}

// ---- NEURAL NETWORK CANVAS ----

function NeuralNetwork() {
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const nodesRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const NODE_COUNT = 80
    const CONNECT_DIST = 150
    const MOUSE_DIST = 200

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    // Initialize nodes once
    if (!nodesRef.current) {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      nodesRef.current = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1,
        depth: Math.random(),        // 0 = far, 1 = near
        pulse: Math.random() * Math.PI * 2,
      }))
    }
    const nodes = nodesRef.current

    function handleMouseMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    function handleMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 }
    }
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    let time = 0
    function draw() {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)
      time += 0.005

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      // Update nodes
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        n.pulse += 0.02

        // Bounce off edges with padding
        if (n.x < -20) n.x = w + 20
        if (n.x > w + 20) n.x = -20
        if (n.y < -20) n.y = h + 20
        if (n.y > h + 20) n.y = -20

        // Mouse repulsion (gentle)
        const dmx = n.x - mx
        const dmy = n.y - my
        const dm = Math.sqrt(dmx * dmx + dmy * dmy)
        if (dm < MOUSE_DIST && dm > 0) {
          const force = (1 - dm / MOUSE_DIST) * 0.5
          n.x += (dmx / dm) * force
          n.y += (dmy / dm) * force
        }
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.15 * ((a.depth + b.depth) / 2)

            // Near mouse? boost connection
            const midX = (a.x + b.x) / 2
            const midY = (a.y + b.y) / 2
            const dMouse = Math.sqrt((midX - mx) ** 2 + (midY - my) ** 2)
            const mouseBoost = dMouse < MOUSE_DIST ? (1 - dMouse / MOUSE_DIST) * 0.25 : 0

            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(245, 158, 11, ${alpha + mouseBoost})`
            ctx.lineWidth = 0.5 + mouseBoost * 2
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const pulseScale = 1 + Math.sin(n.pulse) * 0.3
        const alpha = 0.15 + n.depth * 0.35
        const r = n.r * pulseScale * (0.5 + n.depth * 0.5)

        // Mouse proximity glow
        const dMouse = Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2)
        const mouseGlow = dMouse < MOUSE_DIST ? (1 - dMouse / MOUSE_DIST) * 0.6 : 0

        // Outer glow
        if (r > 1.5 || mouseGlow > 0.1) {
          const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 4 + mouseGlow * 10)
          grad.addColorStop(0, `rgba(245, 158, 11, ${(alpha * 0.3 + mouseGlow * 0.3)})`)
          grad.addColorStop(1, 'rgba(245, 158, 11, 0)')
          ctx.beginPath()
          ctx.arc(n.x, n.y, r * 4 + mouseGlow * 10, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }

        // Core dot
        ctx.beginPath()
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(245, 158, 11, ${alpha + mouseGlow})`
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.6 }}
    />
  )
}

// ---- MAIN COMPONENT ----

export default function HomePage() {
  const [leaderboard, setLeaderboard] = useState([])
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState([])
  const [batches, setBatches] = useState([])
  const [activeBatch, setActiveBatch] = useState('all')
  const [activePlatform, setActivePlatform] = useState('all')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ students: 0, solved: 0, contests: 0, topScore: 0 })
  const [insights, setInsights] = useState(null)

  useEffect(() => {
    ;(async () => {
      const [lc, cf] = await Promise.all([
        loadAllProfiles('leetcode', { includeRaw: true }),
        loadAllProfiles('codeforces', { includeRaw: true })
      ])
      const map = new Map()

      for (const p of [...lc, ...cf]) {
        if (!map.has(p.lead_id)) {
          map.set(p.lead_id, {
            lead_id: p.lead_id, student_name: p.student_name, college: p.college, batch: p.batch,
            student_username: p.student_username,
            lc_score: 0, cf_score: 0, total_score: 0, lc_solved: 0, cf_solved: 0, cf_rating: 0,
            lc_easy: 0, lc_medium: 0, lc_hard: 0, lc_contest_rating: 0, cf_max_rating: 0,
            contests: 0,
          })
        }
        const s = map.get(p.lead_id)
        if (p.platform === 'leetcode') {
          s.lc_score = p.score || 0
          s.lc_solved = p.total_solved || 0
          s.lc_easy = p.easy || 0
          s.lc_medium = p.medium || 0
          s.lc_hard = p.hard || 0
          s.lc_contest_rating = p.contest_rating || 0
          s.contests += p.contests_attended || 0
        } else {
          s.cf_score = p.score || 0
          s.cf_solved = p.problems_solved || 0
          s.cf_rating = p.rating || 0
          s.cf_max_rating = p.max_rating || 0
          s.contests += p.contests_attended || 0
        }
        s.total_score = s.lc_score + s.cf_score
      }

      const all = [...map.values()].sort((a, b) => b.total_score - a.total_score)
      setLeaderboard(all)

      const batchSet = new Set(all.map(s => s.batch).filter(Boolean))
      setBatches([...batchSet].sort())

      setStats({
        students: all.length,
        solved: all.reduce((sum, s) => sum + s.lc_solved + s.cf_solved, 0),
        contests: all.reduce((sum, s) => sum + s.contests, 0),
        topScore: all[0]?.total_score || 0,
      })

      // Compute insights
      const totalEasy = all.reduce((s, x) => s + x.lc_easy, 0)
      const totalMedium = all.reduce((s, x) => s + x.lc_medium, 0)
      const totalHard = all.reduce((s, x) => s + x.lc_hard, 0)

      const topLcSolver = [...all].sort((a, b) => b.lc_solved - a.lc_solved)[0]
      const topCfRating = [...all].filter(s => s.cf_max_rating > 0).sort((a, b) => b.cf_max_rating - a.cf_max_rating)[0]
      const topContester = [...all].sort((a, b) => b.contests - a.contests)[0]
      const avgLcScore = all.length ? Math.round(all.reduce((s, x) => s + x.lc_score, 0) / all.length) : 0
      const avgCfScore = all.length ? Math.round(all.reduce((s, x) => s + x.cf_score, 0) / all.length) : 0

      setInsights({
        totalEasy, totalMedium, totalHard,
        topLcSolver, topCfRating, topContester,
        avgLcScore, avgCfScore,
      })

      // Compute weekly activity leaderboard
      const weeklyData = []
      for (const p of [...lc, ...cf]) {
        if (!p.raw_json) continue
        const activity = computeRecentActivity(p.raw_json, p.platform)
        if (!activity.last7) continue

        let existing = weeklyData.find(w => w.lead_id === p.lead_id)
        if (!existing) {
          existing = {
            lead_id: p.lead_id,
            student_name: p.student_name,
            college: p.college,
            batch: p.batch,
            lc_last7: 0,
            cf_last7: 0,
            total_last7: 0,
          }
          weeklyData.push(existing)
        }
        if (p.platform === 'leetcode') {
          existing.lc_last7 = activity.last7
        } else {
          existing.cf_last7 = activity.last7
        }
        existing.total_last7 = existing.lc_last7 + existing.cf_last7
      }
      setWeeklyLeaderboard(weeklyData.sort((a, b) => b.total_last7 - a.total_last7).slice(0, 20))

      setLoading(false)
    })()
  }, [])

  const filtered = leaderboard.filter(s => {
    if (activeBatch !== 'all' && s.batch !== activeBatch) return false
    return true
  }).sort((a, b) => {
    if (activePlatform === 'leetcode') return b.lc_score - a.lc_score
    if (activePlatform === 'codeforces') return b.cf_score - a.cf_score
    return b.total_score - a.total_score
  })

  return (
    <div className="min-h-screen bg-[#050A18] text-white overflow-hidden">
      {/* ===== HEADER ===== */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5" style={{ background: 'rgba(5, 10, 24, 0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-6 opacity-70" />
            <span className="text-white/20">|</span>
            <span className="text-xl font-bold bg-gradient-to-r from-[#F59E0B] to-white bg-clip-text text-transparent">
              AlgoArena
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#leaderboard" className="text-white/50 hover:text-white text-sm font-medium transition-colors hidden sm:block">Leaderboard</a>
            <a href="#banners" className="text-white/50 hover:text-white text-sm font-medium transition-colors hidden sm:block">Events</a>
            <Link to="/practice" className="text-white/50 hover:text-white text-sm font-medium transition-colors hidden sm:block">Practice</Link>
            <a href="#ai-news" className="text-white/50 hover:text-white text-sm font-medium transition-colors hidden sm:block">AI Corner</a>
            <Link to="/portal"
              className="px-5 py-2 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#050A18] rounded-lg font-bold text-sm cv-glow-btn">
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative min-h-[90vh] flex items-center justify-center">
        {/* Neural network background */}
        <NeuralNetwork />

        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div className="cv-animate-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#F59E0B]/20 bg-[#F59E0B]/5 text-[#F59E0B] text-sm font-medium mb-8">
              <Sparkles size={14} /> ALTA School of Technology
            </div>
          </div>

          <h1 className="cv-animate-in cv-stagger-1 text-6xl sm:text-8xl font-black tracking-tight mb-6">
            <span className="bg-gradient-to-r from-white via-[#F59E0B] to-[#D97706] bg-clip-text text-transparent cv-glow-text">
              AlgoArena
            </span>
          </h1>

          <p className="cv-stagger-2 text-3xl sm:text-4xl font-bold text-[#F59E0B]/70 mb-4 max-w-2xl mx-auto tracking-wide uppercase cv-glitch cursor-pointer" data-text="Coders Assemble">
            Coders Assemble
          </p>

          <p className="cv-animate-in cv-stagger-3 text-white/20 mb-10">
            LeetCode &middot; Codeforces &middot; HackerRank &middot; CodeChef &middot; GitHub
          </p>

          <div className="cv-animate-in cv-stagger-4 flex flex-wrap items-center justify-center gap-4">
            <Link to="/portal"
              className="group px-8 py-4 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#050A18] rounded-xl font-bold text-lg cv-glow-btn flex items-center gap-2">
              Enter AlgoArena
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#leaderboard"
              className="px-8 py-4 cv-glass rounded-xl font-semibold text-white/70 hover:text-white transition-all hover:border-[#F59E0B]/30 flex items-center gap-2">
              <Trophy size={18} /> View Leaderboard
            </a>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050A18] to-transparent" />
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="relative z-10 -mt-16">
        <div className="max-w-5xl mx-auto px-6">
          <AnimateIn>
            <div className="cv-glass rounded-2xl p-1">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
                {[
                  { icon: <Users size={20} />, label: 'Students', value: stats.students },
                  { icon: <Code2 size={20} />, label: 'Problems Solved', value: stats.solved },
                  { icon: <Trophy size={20} />, label: 'Contests Joined', value: stats.contests },
                  { icon: <Zap size={20} />, label: 'Top Score', value: stats.topScore, suffix: '/2000' },
                ].map((s, i) => (
                  <div key={i} className="px-6 py-6 text-center">
                    <div className="text-[#F59E0B] mb-2 flex justify-center">{s.icon}</div>
                    <div className="text-2xl sm:text-3xl font-bold text-white">
                      <AnimatedNumber value={s.value} suffix={s.suffix} />
                    </div>
                    <div className="text-white/30 text-sm mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* ===== INSIGHTS ===== */}
      {insights && (
        <section className="relative py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <AnimateIn>
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black mb-3">
                  <span className="bg-gradient-to-r from-[#F59E0B] to-white bg-clip-text text-transparent">Insights</span>
                </h2>
                <p className="text-white/30">A snapshot of our community's coding journey</p>
              </div>
            </AnimateIn>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {/* Difficulty Breakdown */}
              <AnimateIn delay={100}>
                <div className="cv-glass rounded-2xl p-6 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Target size={18} className="text-[#F59E0B]" />
                    <span className="text-white/50 text-sm font-medium">LeetCode Difficulty Split</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#00B8A3]">Easy</span>
                        <span className="text-white font-mono">{insights.totalEasy.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-[#00B8A3]" style={{ width: `${Math.min(100, (insights.totalEasy / (insights.totalEasy + insights.totalMedium + insights.totalHard || 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#FFA116]">Medium</span>
                        <span className="text-white font-mono">{insights.totalMedium.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-[#FFA116]" style={{ width: `${Math.min(100, (insights.totalMedium / (insights.totalEasy + insights.totalMedium + insights.totalHard || 1)) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#FF375F]">Hard</span>
                        <span className="text-white font-mono">{insights.totalHard.toLocaleString()}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-[#FF375F]" style={{ width: `${Math.min(100, (insights.totalHard / (insights.totalEasy + insights.totalMedium + insights.totalHard || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </AnimateIn>

              {/* Top LeetCode Solver */}
              <AnimateIn delay={200}>
                <div className="cv-glass rounded-2xl p-6 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Flame size={18} className="text-[#FFA116]" />
                    <span className="text-white/50 text-sm font-medium">Top LeetCode Solver</span>
                  </div>
                  {insights.topLcSolver ? (
                    <div>
                      <div className="text-white font-bold text-lg mb-1">{insights.topLcSolver.student_name}</div>
                      <div className="text-white/30 text-sm mb-3">{insights.topLcSolver.college}</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-[#FFA116]">{insights.topLcSolver.lc_solved}</span>
                        <span className="text-white/30 text-sm">problems solved</span>
                      </div>
                      <div className="mt-2 text-xs text-white/20">
                        {insights.topLcSolver.lc_easy}E / {insights.topLcSolver.lc_medium}M / {insights.topLcSolver.lc_hard}H
                      </div>
                    </div>
                  ) : (
                    <div className="text-white/20 text-sm">No data yet</div>
                  )}
                </div>
              </AnimateIn>

              {/* Top CF Rating */}
              <AnimateIn delay={300}>
                <div className="cv-glass rounded-2xl p-6 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={18} className="text-[#1F8ACB]" />
                    <span className="text-white/50 text-sm font-medium">Highest CF Rating</span>
                  </div>
                  {insights.topCfRating ? (
                    <div>
                      <div className="text-white font-bold text-lg mb-1">{insights.topCfRating.student_name}</div>
                      <div className="text-white/30 text-sm mb-3">{insights.topCfRating.college}</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-[#1F8ACB]">{insights.topCfRating.cf_max_rating}</span>
                        <span className="text-white/30 text-sm">max rating</span>
                      </div>
                      <div className="mt-2 text-xs text-white/20">
                        Current: {insights.topCfRating.cf_rating}
                      </div>
                    </div>
                  ) : (
                    <div className="text-white/20 text-sm">No data yet</div>
                  )}
                </div>
              </AnimateIn>

              {/* Average Scores + Most Contests */}
              <AnimateIn delay={400}>
                <div className="cv-glass rounded-2xl p-6 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Award size={18} className="text-[#F59E0B]" />
                    <span className="text-white/50 text-sm font-medium">Community Averages</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-white/40 text-xs mb-1">Avg LeetCode Score</div>
                      <div className="text-2xl font-bold text-[#FFA116]">{insights.avgLcScore}<span className="text-white/20 text-sm font-normal"> / 1000</span></div>
                    </div>
                    <div>
                      <div className="text-white/40 text-xs mb-1">Avg Codeforces Score</div>
                      <div className="text-2xl font-bold text-[#1F8ACB]">{insights.avgCfScore}<span className="text-white/20 text-sm font-normal"> / 1000</span></div>
                    </div>
                    {insights.topContester && (
                      <div className="pt-2 border-t border-white/5">
                        <div className="text-white/40 text-xs mb-1">Most Contests</div>
                        <div className="text-white font-semibold text-sm">{insights.topContester.student_name} — <span className="text-[#F59E0B]">{insights.topContester.contests}</span></div>
                      </div>
                    )}
                  </div>
                </div>
              </AnimateIn>
            </div>
          </div>
        </section>
      )}

      {/* ===== WEEKLY LEADERBOARD ===== */}
      {weeklyLeaderboard.length > 0 && (
        <section className="relative py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <AnimateIn>
              <div className="text-center mb-12">
                <h2 className="text-4xl font-black mb-3">
                  <span className="bg-gradient-to-r from-[#22ACD1] to-white bg-clip-text text-transparent">Most Active This Week</span>
                </h2>
                <p className="text-white/30 text-lg">Top 20 coders in the last 7 days</p>
              </div>
            </AnimateIn>

            <AnimateIn delay={100}>
              <div className="cv-glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-white/30">
                        <th className="py-4 px-5 text-left font-medium w-16">#</th>
                        <th className="py-4 px-5 text-left font-medium">Student</th>
                        <th className="py-4 px-5 text-left font-medium hidden md:table-cell">College</th>
                        <th className="py-4 px-5 text-left font-medium hidden lg:table-cell">Batch</th>
                        <th className="py-4 px-5 text-right font-medium">LC</th>
                        <th className="py-4 px-5 text-right font-medium">CF</th>
                        <th className="py-4 px-5 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyLeaderboard.map((s, i) => (
                        <tr key={s.lead_id} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                          <td className="py-3.5 px-5">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                              i === 0 ? 'bg-amber-100 text-amber-700' :
                              i === 1 ? 'bg-gray-100 text-gray-700' :
                              i === 2 ? 'bg-orange-100 text-orange-700' :
                              'text-white/20'
                            }`}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#22ACD1]/20 to-[#0D1E56] flex items-center justify-center text-xs font-bold text-[#22ACD1]/70 shrink-0">
                                {(s.student_name || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-white">{s.student_name || s.lead_id}</div>
                                <div className="text-white/20 text-xs md:hidden">{s.college}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5 text-white/40 hidden md:table-cell">{s.college}</td>
                          <td className="py-3.5 px-5 text-white/30 hidden lg:table-cell">{s.batch}</td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="text-[#FFA116] font-mono font-medium">{s.lc_last7}</span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="text-[#1F8ACB] font-mono font-medium">{s.cf_last7}</span>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span className="text-[#22ACD1] font-bold font-mono text-lg">{s.total_last7}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </AnimateIn>
          </div>
        </section>
      )}

      {/* ===== LEADERBOARD ===== */}
      <section id="leaderboard" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-12">
              <h2 className="text-4xl sm:text-5xl font-black mb-3">
                <span className="bg-gradient-to-r from-[#F59E0B] to-white bg-clip-text text-transparent">Leaderboard</span>
              </h2>
              <p className="text-white/30 text-lg">Top coders across all campuses</p>
            </div>
          </AnimateIn>

          {/* Filters */}
          <AnimateIn delay={100}>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {/* Platform filter */}
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                {[
                  { key: 'all', label: 'Combined' },
                  { key: 'leetcode', label: 'LeetCode' },
                  { key: 'codeforces', label: 'Codeforces' },
                ].map(p => (
                  <button key={p.key} onClick={() => setActivePlatform(p.key)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      activePlatform === p.key
                        ? 'bg-[#F59E0B] text-[#050A18]'
                        : 'text-white/40 hover:text-white/70'
                    }`}>{p.label}</button>
                ))}
              </div>

              <div className="h-6 w-px bg-white/10 hidden sm:block" />

              {/* Batch filter */}
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => setActiveBatch('all')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    activeBatch === 'all' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
                  }`}>All Batches</button>
                {batches.map(b => (
                  <button key={b} onClick={() => setActiveBatch(b)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      activeBatch === b ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'
                    }`}>{b}</button>
                ))}
              </div>
            </div>
          </AnimateIn>

          {/* Podium + Table */}
          <AnimateIn delay={200}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F59E0B] border-r-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-white/20">No students found for this filter.</div>
            ) : (
              <>
                {/* ---- PODIUM: Top 3 ---- */}
                {filtered.length >= 3 && (() => {
                  const getScore = (s) => activePlatform === 'leetcode' ? s.lc_score : activePlatform === 'codeforces' ? s.cf_score : s.total_score
                  const podium = [
                    { s: filtered[1], rank: 2, medal: '🥈', color: '#C0C0C0', pedestal: 'h-24 sm:h-28', avatar: 'w-14 h-14 sm:w-16 sm:h-16 text-base', scoreSize: 'text-xl sm:text-2xl' },
                    { s: filtered[0], rank: 1, medal: '🥇', color: '#FFD700', pedestal: 'h-32 sm:h-40', avatar: 'w-18 h-18 sm:w-22 sm:h-22 text-xl', scoreSize: 'text-2xl sm:text-3xl' },
                    { s: filtered[2], rank: 3, medal: '🥉', color: '#CD7F32', pedestal: 'h-18 sm:h-20', avatar: 'w-12 h-12 sm:w-14 sm:h-14 text-sm', scoreSize: 'text-lg sm:text-xl' },
                  ]
                  return (
                    <div className="flex items-end justify-center gap-2 sm:gap-5 mb-12 pt-4">
                      {podium.map(({ s, rank, medal, color, pedestal, avatar, scoreSize }) => {
                        const score = getScore(s)
                        return (
                          <div key={s.lead_id} className="flex flex-col items-center flex-1 max-w-[180px]">
                            {/* Medal */}
                            <div className="text-2xl sm:text-3xl mb-1.5">{medal}</div>

                            {/* Avatar with glow ring */}
                            <div className="relative mb-3">
                              <div className={`${avatar} rounded-full flex items-center justify-center font-black relative`}
                                style={{
                                  background: `linear-gradient(135deg, ${color}25, ${color}08)`,
                                  border: `2px solid ${color}`,
                                  boxShadow: `0 0 24px ${color}35, 0 0 48px ${color}10`,
                                }}>
                                <span style={{ color }}>{(s.student_name || '?')[0].toUpperCase()}</span>
                              </div>
                              {rank === 1 && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                  <Crown size={20} className="text-[#FFD700]" style={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.7))' }} />
                                </div>
                              )}
                            </div>

                            {/* Name + College */}
                            <div className="text-white font-bold text-xs sm:text-sm text-center truncate w-full">{s.student_name || s.lead_id}</div>
                            <div className="text-white/20 text-[10px] sm:text-xs text-center truncate w-full mb-2">{s.college}</div>

                            {/* Score */}
                            <div className={`${scoreSize} font-black font-mono mb-0.5`}
                              style={{ color, textShadow: `0 0 20px ${color}40` }}>
                              {Math.round(score)}
                            </div>
                            <div className="text-white/20 text-[10px] sm:text-xs mb-3 font-mono">
                              LC {Math.round(s.lc_score)} &middot; CF {Math.round(s.cf_score)}
                            </div>

                            {/* Pedestal */}
                            <div className={`w-full ${pedestal} rounded-t-xl relative overflow-hidden`}
                              style={{
                                background: `linear-gradient(180deg, ${color}18, ${color}04)`,
                                borderTop: `2px solid ${color}50`,
                                borderLeft: `1px solid ${color}15`,
                                borderRight: `1px solid ${color}15`,
                              }}>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-4xl sm:text-5xl font-black select-none" style={{ color: `${color}10` }}>{rank}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* ---- TABLE: #4–20 (or all if < 3 students) ---- */}
                {(() => {
                  const tableStart = filtered.length >= 3 ? 3 : 0
                  const tableData = filtered.slice(tableStart, 20)
                  if (tableData.length === 0) return null
                  return (
                    <div className="cv-glass rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/5 text-white/30">
                              <th className="py-4 px-5 text-left font-medium w-16">#</th>
                              <th className="py-4 px-5 text-left font-medium">Student</th>
                              <th className="py-4 px-5 text-left font-medium hidden md:table-cell">College</th>
                              <th className="py-4 px-5 text-left font-medium hidden lg:table-cell">Batch</th>
                              <th className="py-4 px-5 text-right font-medium">LC</th>
                              <th className="py-4 px-5 text-right font-medium">CF</th>
                              <th className="py-4 px-5 text-right font-medium">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.map((s, i) => {
                              const rank = tableStart + i + 1
                              const score = activePlatform === 'leetcode' ? s.lc_score : activePlatform === 'codeforces' ? s.cf_score : s.total_score
                              return (
                                <tr key={s.lead_id}
                                  className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
                                  <td className="py-3.5 px-5">
                                    <span className="font-bold text-lg text-white/20">{rank}</span>
                                  </td>
                                  <td className="py-3.5 px-5">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F59E0B]/20 to-[#0D1E56] flex items-center justify-center text-xs font-bold text-[#F59E0B]/70 shrink-0">
                                        {(s.student_name || '?')[0].toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="font-semibold text-white">{s.student_name || s.lead_id}</div>
                                        <div className="text-white/20 text-xs md:hidden">{s.college}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-5 text-white/40 hidden md:table-cell">{s.college}</td>
                                  <td className="py-3.5 px-5 text-white/30 hidden lg:table-cell">{s.batch}</td>
                                  <td className="py-3.5 px-5 text-right">
                                    <span className="text-[#FFA116] font-mono font-medium">{Math.round(s.lc_score)}</span>
                                  </td>
                                  <td className="py-3.5 px-5 text-right">
                                    <span className="text-[#1F8ACB] font-mono font-medium">{Math.round(s.cf_score)}</span>
                                  </td>
                                  <td className="py-3.5 px-5 text-right">
                                    <span className="text-white font-bold font-mono text-base">{Math.round(score)}</span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </AnimateIn>
        </div>
      </section>

      {/* ===== BANNERS ===== */}
      <section id="banners" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black mb-3">
                <span className="bg-gradient-to-r from-[#F59E0B] to-white bg-clip-text text-transparent">Events & Announcements</span>
              </h2>
              <p className="text-white/30">Stay updated with the latest happenings</p>
            </div>
          </AnimateIn>

          {/* Row 1: Rectangle + Square */}
          <div className="grid md:grid-cols-3 gap-5 mb-5">
            <AnimateIn className="md:col-span-2" delay={100}>
              <a href={BANNERS[0].link} className="cv-banner block aspect-[2/1] relative group">
                {BANNERS[0].image ? (
                  <img src={BANNERS[0].image} alt={BANNERS[0].title} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${BANNERS[0].gradient} flex items-end p-8`}>
                    <div>
                      <div className="text-white/50 text-sm font-medium mb-1">{BANNERS[0].subtitle}</div>
                      <div className="text-white text-2xl font-bold">{BANNERS[0].title}</div>
                    </div>
                    <ArrowRight size={24} className="absolute top-6 right-6 text-white/20 group-hover:text-[#F59E0B] group-hover:translate-x-1 transition-all" />
                  </div>
                )}
              </a>
            </AnimateIn>
            <AnimateIn delay={200}>
              <a href={BANNERS[1].link} className="cv-banner block aspect-square relative group">
                {BANNERS[1].image ? (
                  <img src={BANNERS[1].image} alt={BANNERS[1].title} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${BANNERS[1].gradient} flex items-end p-8`}>
                    <div>
                      <div className="text-white/50 text-sm font-medium mb-1">{BANNERS[1].subtitle}</div>
                      <div className="text-white text-2xl font-bold">{BANNERS[1].title}</div>
                    </div>
                    <ArrowRight size={24} className="absolute top-6 right-6 text-white/20 group-hover:text-[#F59E0B] group-hover:translate-x-1 transition-all" />
                  </div>
                )}
              </a>
            </AnimateIn>
          </div>

          {/* Row 2: Square + Rectangle */}
          <div className="grid md:grid-cols-3 gap-5">
            <AnimateIn delay={300}>
              <a href={BANNERS[2].link} className="cv-banner block aspect-square relative group">
                {BANNERS[2].image ? (
                  <img src={BANNERS[2].image} alt={BANNERS[2].title} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${BANNERS[2].gradient} flex items-end p-8`}>
                    <div>
                      <div className="text-white/50 text-sm font-medium mb-1">{BANNERS[2].subtitle}</div>
                      <div className="text-white text-2xl font-bold">{BANNERS[2].title}</div>
                    </div>
                    <ArrowRight size={24} className="absolute top-6 right-6 text-white/20 group-hover:text-[#F59E0B] group-hover:translate-x-1 transition-all" />
                  </div>
                )}
              </a>
            </AnimateIn>
            <AnimateIn className="md:col-span-2" delay={400}>
              <a href={BANNERS[3].link} className="cv-banner block aspect-[2/1] relative group">
                {BANNERS[3].image ? (
                  <img src={BANNERS[3].image} alt={BANNERS[3].title} />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${BANNERS[3].gradient} flex items-end p-8`}>
                    <div>
                      <div className="text-white/50 text-sm font-medium mb-1">{BANNERS[3].subtitle}</div>
                      <div className="text-white text-2xl font-bold">{BANNERS[3].title}</div>
                    </div>
                    <ArrowRight size={24} className="absolute top-6 right-6 text-white/20 group-hover:text-[#F59E0B] group-hover:translate-x-1 transition-all" />
                  </div>
                )}
              </a>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* ===== WHAT'S NEW IN AI ===== */}
      <section id="ai-news" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <AnimateIn>
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black mb-3">
                <span className="bg-gradient-to-r from-[#F59E0B] to-white bg-clip-text text-transparent">What's New in AI</span>
              </h2>
              <p className="text-white/30">Stay ahead with the latest in artificial intelligence</p>
            </div>
          </AnimateIn>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Articles */}
            <div className="space-y-4">
              {AI_NEWS.map((item, i) => (
                <AnimateIn key={i} delay={i * 100}>
                  <div className="cv-glass cv-glass-hover rounded-xl p-6 cursor-pointer transition-all group">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#F59E0B]/20 to-transparent flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles size={18} className="text-[#F59E0B]" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white group-hover:text-[#F59E0B] transition-colors mb-1.5">{item.title}</h4>
                        <p className="text-white/30 text-sm leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                </AnimateIn>
              ))}
            </div>

            {/* YouTube */}
            <AnimateIn delay={200}>
              <div className="cv-glass rounded-xl overflow-hidden h-full min-h-[300px] flex flex-col">
                {YOUTUBE_EMBED_ID ? (
                  <iframe
                    className="w-full flex-1"
                    src={`https://www.youtube.com/embed/${YOUTUBE_EMBED_ID}`}
                    title="Featured Video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4 group cursor-pointer hover:bg-[#F59E0B]/10 transition-colors">
                      <Play size={32} className="text-[#F59E0B] ml-1" />
                    </div>
                    <h4 className="text-white font-bold text-lg mb-1">Featured Video</h4>
                    <p className="text-white/30 text-sm">Add a YouTube video ID to the YOUTUBE_EMBED_ID constant</p>
                  </div>
                )}
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="py-20 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F59E0B]/5 to-transparent" />
        <AnimateIn>
          <div className="max-w-3xl mx-auto text-center relative z-10">
            <h2 className="text-4xl sm:text-5xl font-black mb-4 text-white">Ready to compete?</h2>
            <p className="text-white/40 text-lg mb-8">Login to track your coding profile, view benchmarks, and climb the leaderboard.</p>
            <Link to="/portal"
              className="inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#050A18] rounded-xl font-bold text-lg cv-glow-btn">
              Enter AlgoArena <ArrowRight size={20} />
            </Link>
          </div>
        </AnimateIn>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-5 opacity-40" />
            <span className="text-white/15">|</span>
            <span className="text-white/30 text-sm">AlgoArena by ALTA School of Technology</span>
          </div>
          <div className="flex items-center gap-6 text-white/20 text-sm">
            <Link to="/practice" className="hover:text-[#F59E0B] transition-colors">Practice</Link>
            <Link to="/portal" className="hover:text-[#F59E0B] transition-colors">Student Portal</Link>
            <Link to="/admin" className="hover:text-[#F59E0B] transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
