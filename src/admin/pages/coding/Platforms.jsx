import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { lazy, Suspense } from 'react'

const StudentView = lazy(() => import('../../../components/StudentView'))

export default function Platforms() {
  const { adminUser, platforms, platform, setPlatform } = useOutletContext()
  const current = platforms.find(p => p.slug === platform)

  return (
    <div className="space-y-4">
      {/* Platform selector */}
      <div className="flex gap-2">
        {platforms.map(p => (
          <button
            key={p.slug}
            onClick={() => setPlatform(p.slug)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              platform === p.slug
                ? 'bg-primary text-white'
                : 'bg-white text-primary/60 border border-primary/10 hover:border-primary/30'
            }`}
          >
            {p.display_name}
          </button>
        ))}
      </div>

      <Suspense fallback={<div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-ambient border-r-transparent" /></div>}>
        <StudentView platform={platform} platformName={current?.display_name || platform} adminUser={adminUser} />
      </Suspense>
    </div>
  )
}
