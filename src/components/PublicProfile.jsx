import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ExternalLink, LogIn, Trophy } from 'lucide-react'
import { getStudentBySlug, getStudentProfiles, loadAllProfiles } from '../lib/db'
import {
  PLATFORMS, SCORED_PLATFORMS,
  ScoreCard, BenchmarkChart, DetailedStats, GitHubStats, FullSpinner, avg,
} from './StudentPortal'
import { ActivityStrip } from './StudentView'
import { computeRecentActivity } from '../lib/activity'
import SubmissionHeatmap from './SubmissionHeatmap'

export default function PublicProfile() {
  const { slug } = useParams()
  const [student, setStudent] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [benchmarks, setBenchmarks] = useState({})
  const [leaderboards, setLeaderboards] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    ;(async () => {
      setLoading(true)
      const s = await getStudentBySlug(slug)
      if (!s) { setNotFound(true); setLoading(false); return }
      setStudent(s)

      const profs = await getStudentProfiles(s.lead_id)
      setProfiles(profs)

      const bm = {}
      const lb = {}
      for (const plat of SCORED_PLATFORMS) {
        const all = await loadAllProfiles(plat, { includeRaw: true })
        const myProfile = all.find(p => p.lead_id === s.lead_id)
        if (myProfile && all.length > 0) {
          const sameCollege = all.filter(p => p.college && p.college === s.college)
          const sameBatch = all.filter(p => p.batch && p.batch === s.batch)
          bm[plat] = {
            myScore: myProfile.score || 0,
            myStats: myProfile,
            overall: { avg: avg(all, 'score'), rank: all.filter(p => p.score > myProfile.score).length + 1, total: all.length },
            college: sameCollege.length > 1
              ? { avg: avg(sameCollege, 'score'), rank: sameCollege.filter(p => p.score > myProfile.score).length + 1, total: sameCollege.length, name: s.college }
              : null,
            batch: sameBatch.length > 1
              ? { avg: avg(sameBatch, 'score'), rank: sameBatch.filter(p => p.score > myProfile.score).length + 1, total: sameBatch.length, name: s.batch }
              : null,
          }

          // Compute activity for leaderboard
          for (const p of all) {
            if (!p.raw_json) continue
            const activity = computeRecentActivity(p.raw_json, plat)
            if (!activity.last7) continue

            if (!lb[p.lead_id]) {
              lb[p.lead_id] = {
                lead_id: p.lead_id,
                student_name: p.student_name,
                college: p.college,
                batch: p.batch,
                lc_last7: 0,
                cf_last7: 0,
                total_last7: 0,
              }
            }
            if (plat === 'leetcode') {
              lb[p.lead_id].lc_last7 = activity.last7
            } else {
              lb[p.lead_id].cf_last7 = activity.last7
            }
            lb[p.lead_id].total_last7 = lb[p.lead_id].lc_last7 + lb[p.lead_id].cf_last7
          }
        }
      }
      setBenchmarks(bm)

      // Convert leaderboard map to sorted array
      const leaderboardArray = Object.values(lb)
        .sort((a, b) => b.total_last7 - a.total_last7)
        .slice(0, 10)
      setLeaderboards(leaderboardArray)
      setLoading(false)
    })()
  }, [slug])

  if (loading) return <FullSpinner />

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary to-[#162a6b] flex items-center justify-center p-4">
        <div className="text-center">
          <img src="/alta-white-text.png" alt="ALTA" className="h-10 mx-auto mb-6" />
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
            <h1 className="text-2xl font-bold text-primary mb-2">Profile Not Found</h1>
            <p className="text-primary/50 mb-6">We couldn't find a student profile matching this link.</p>
            <Link to="/portal" className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold transition-colors">
              <LogIn size={16} /> Go to Student Portal
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const profileMap = {}
  for (const p of profiles) profileMap[p.platform] = p

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-primary sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-7" />
            <span className="text-white/30">|</span>
            <span className="text-white font-medium">Student Profile</span>
          </div>
          <a href="https://altaschool.tech" target="_blank" rel="noopener noreferrer"
            className="text-white/40 hover:text-white/70 text-sm font-medium transition-colors">
            altaschool.tech
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Student Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-8">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-primary">{student.student_name || student.lead_id}</h2>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-primary/60">
                {student.college && <span className="flex items-center gap-1.5 bg-primary/5 px-3 py-1 rounded-full">{student.college}</span>}
                {student.batch && <span className="flex items-center gap-1.5 bg-ambient/10 text-dark-ambient px-3 py-1 rounded-full">{student.batch}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Platform Scores Overview */}
        {SCORED_PLATFORMS.some(p => benchmarks[p]) && (
          <div className="grid md:grid-cols-2 gap-6">
            {SCORED_PLATFORMS.map(plat => {
              const bm = benchmarks[plat]
              if (!bm) return null
              const platInfo = PLATFORMS.find(p => p.slug === plat)
              return <ScoreCard key={plat} platform={platInfo} benchmark={bm} />
            })}
          </div>
        )}

        {/* Recent Activity */}
        {SCORED_PLATFORMS.map(plat => {
          const prof = profileMap[plat]
          if (!prof?.raw_json) return null
          const activity = computeRecentActivity(prof.raw_json, plat)
          if (!activity.last30) return null
          const platInfo = PLATFORMS.find(p => p.slug === plat)
          return (
            <div key={`act-${plat}`}>
              <h3 className="text-sm font-semibold text-primary/50 mb-2 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: platInfo.color }} />
                {platInfo.name} — Recent Activity
              </h3>
              <ActivityStrip activity={activity} label="Problems Solved" />
            </div>
          )
        })}

        {/* Leaderboard - Most Problems Solved in Last 7 Days */}
        {leaderboards.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-6">
            <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
              <Trophy size={18} className="text-dark-ambient" />
              Top 10 Most Active (Last 7 Days)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary/10 text-primary/50 text-xs">
                    <th className="py-2 text-left font-medium">Rank</th>
                    <th className="py-2 text-left font-medium">Student</th>
                    <th className="py-2 text-right font-medium">LC</th>
                    <th className="py-2 text-right font-medium">CF</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboards.map((s, idx) => (
                    <tr key={s.lead_id} className="border-b border-primary/5 hover:bg-ambient/5 transition-colors">
                      <td className="py-2">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          idx === 0 ? 'bg-amber-100 text-amber-700' :
                          idx === 1 ? 'bg-gray-100 text-gray-700' :
                          idx === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-primary/5 text-primary/50'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2">
                        <div>
                          <div className="font-medium text-primary">{s.student_name || s.lead_id}</div>
                          <div className="text-xs text-primary/30">
                            {s.college && <span>{s.college}</span>}
                            {s.batch && s.college && <span className="mx-1">•</span>}
                            {s.batch && <span>{s.batch}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <span className="text-amber-600 font-mono font-medium">{s.lc_last7}</span>
                      </td>
                      <td className="py-2 text-right">
                        <span className="text-blue-600 font-mono font-medium">{s.cf_last7}</span>
                      </td>
                      <td className="py-2 text-right">
                        <span className="font-bold text-dark-ambient text-lg">{s.total_last7}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Benchmark Charts */}
        {SCORED_PLATFORMS.map(plat => {
          const bm = benchmarks[plat]
          if (!bm) return null
          const platInfo = PLATFORMS.find(p => p.slug === plat)
          return <BenchmarkChart key={plat} platform={platInfo} benchmark={bm} />
        })}

        {/* Detailed Stats */}
        {SCORED_PLATFORMS.map(plat => {
          const bm = benchmarks[plat]
          if (!bm?.myStats) return null
          const platInfo = PLATFORMS.find(p => p.slug === plat)
          return <DetailedStats key={plat} platform={platInfo} stats={bm.myStats} />
        })}

        {/* Submission Heatmaps */}
        {SCORED_PLATFORMS.map(plat => {
          const prof = profileMap[plat]
          if (!prof?.raw_json) return null
          const platInfo = PLATFORMS.find(p => p.slug === plat)
          return <SubmissionHeatmap key={`hm-${plat}`} rawJson={prof.raw_json} platform={plat} color={platInfo.color} platformName={platInfo.name} />
        })}

        {/* GitHub Contribution Heatmap */}
        {profileMap.github?.raw_json?.contributions && (
          <SubmissionHeatmap rawJson={profileMap.github.raw_json} platform="github" color="#333333" platformName="GitHub" />
        )}

        {/* GitHub Analytics */}
        {profileMap.github?.stats && (
          <GitHubStats stats={profileMap.github.stats} username={profileMap.github.username} />
        )}

        {/* All Platform Links */}
        <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-8">
          <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
            <ExternalLink size={20} /> Platform Profiles
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PLATFORMS.map(plat => {
              const prof = profileMap[plat.slug]
              const hasUsername = prof?.username
              return (
                <div key={plat.slug} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                  hasUsername ? 'border-primary/10 bg-white' : 'border-dashed border-primary/10 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plat.color }} />
                    <div>
                      <div className="font-medium text-primary text-sm">{plat.name}</div>
                      {hasUsername ? (
                        <div className="text-dark-ambient text-sm">@{prof.username}</div>
                      ) : (
                        <div className="text-primary/30 text-sm">Not linked</div>
                      )}
                    </div>
                  </div>
                  {hasUsername && (
                    <a href={plat.urlTemplate.replace('{u}', prof.username)} target="_blank" rel="noopener noreferrer"
                      className="text-ambient hover:text-dark-ambient transition-colors">
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* No data message */}
        {!SCORED_PLATFORMS.some(p => benchmarks[p]) && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-xl text-center">
            <p className="font-medium mb-1">No scored profiles yet</p>
            <p className="text-sm">This student hasn't been scored on any platform yet.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-primary/30 text-sm">
        ALTA School of Technology
      </div>
    </div>
  )
}
