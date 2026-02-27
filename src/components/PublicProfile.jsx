import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ExternalLink, LogIn } from 'lucide-react'
import { getStudentBySlug, getStudentProfiles } from '../lib/db'
import { PLATFORMS, SCORED_PLATFORMS, DetailedStats, GitHubStats, FullSpinner } from './StudentPortal'
import SubmissionHeatmap from './SubmissionHeatmap'

function extractStats(platform, profile) {
  if (!profile?.stats) return null
  return { ...profile.stats, score: profile.score }
}

export default function PublicProfile() {
  const { slug } = useParams()
  const [student, setStudent] = useState(null)
  const [profiles, setProfiles] = useState([])
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
      setLoading(false)
    })()
  }, [slug])

  if (loading) return <FullSpinner />

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary to-[#162a6b] flex items-center justify-center p-3 sm:p-4">
        <div className="text-center">
          <img src="/alta-white-text.png" alt="ALTA" className="h-8 sm:h-10 mx-auto mb-6" />
          <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-8 max-w-md">
            <h1 className="text-xl sm:text-2xl font-bold text-primary mb-2">Profile Not Found</h1>
            <p className="text-primary/50 mb-6 text-sm sm:text-base">We couldn't find a student profile matching this link.</p>
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
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/alta-white-text.png" alt="ALTA" className="h-6 sm:h-7" />
            <span className="text-white/30 hidden sm:inline">|</span>
            <span className="text-white font-medium hidden sm:inline">Student Profile</span>
          </div>
          <a href="https://altaschool.tech" target="_blank" rel="noopener noreferrer"
            className="text-white/40 hover:text-white/70 text-sm font-medium transition-colors">
            altaschool.tech
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Student Info Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-8">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-3xl font-bold text-primary truncate">{student.student_name || student.lead_id}</h2>
              <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 sm:mt-3 text-xs sm:text-sm text-primary/60">
                {student.college && <span className="flex items-center gap-1.5 bg-primary/5 px-2 sm:px-3 py-1 rounded-full">{student.college}</span>}
                {student.batch && <span className="flex items-center gap-1.5 bg-ambient/10 text-dark-ambient px-2 sm:px-3 py-1 rounded-full">{student.batch}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Stats */}
        {SCORED_PLATFORMS.map(plat => {
          const prof = profileMap[plat]
          const stats = extractStats(plat, prof)
          if (!stats) return null
          const platInfo = PLATFORMS.find(p => p.slug === plat)
          return <DetailedStats key={plat} platform={platInfo} stats={stats} />
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
        <div className="bg-white rounded-2xl shadow-sm border border-primary/10 p-4 sm:p-8">
          <h3 className="text-base sm:text-lg font-bold text-primary mb-3 sm:mb-4 flex items-center gap-2">
            <ExternalLink size={20} /> Platform Profiles
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {PLATFORMS.map(plat => {
              const prof = profileMap[plat.slug]
              const hasUsername = prof?.username
              return (
                <div key={plat.slug} className={`flex items-center justify-between px-3 sm:px-4 py-3 rounded-xl border ${
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
        {!SCORED_PLATFORMS.some(p => profileMap[p]?.stats) && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 sm:px-6 py-4 rounded-xl text-center">
            <p className="font-medium mb-1">No coding data yet</p>
            <p className="text-sm">This student's profiles haven't been fetched yet.</p>
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
