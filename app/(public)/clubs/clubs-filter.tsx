'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export function ClubsFilter({
  campuses,
  categories,
  activeCampus,
  activeCategory,
}: {
  campuses: string[]
  categories: string[]
  activeCampus: string
  activeCategory: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/clubs?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <div className="flex flex-wrap gap-2.5 mb-10">
      {/* Campus Pills */}
      <button
        onClick={() => updateFilter('campus', '')}
        className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150 ${
          !activeCampus
            ? 'bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white border-transparent shadow-[0_0_16px_rgba(245,158,11,0.2)]'
            : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:text-white hover:border-white/20'
        }`}
      >
        All Campuses
      </button>
      {campuses.map((campus) => (
        <button
          key={campus}
          onClick={() => updateFilter('campus', campus === activeCampus ? '' : campus)}
          className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150 ${
            campus === activeCampus
              ? 'bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-white border-transparent shadow-[0_0_16px_rgba(245,158,11,0.2)]'
              : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:text-white hover:border-white/20'
          }`}
        >
          {campus}
        </button>
      ))}

      {/* Divider */}
      <div className="w-px h-8 self-center bg-white/[0.08]" />

      {/* Category Pills */}
      <button
        onClick={() => updateFilter('category', '')}
        className={`px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150 ${
          !activeCategory
            ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
            : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:text-white hover:border-white/20'
        }`}
      >
        All Types
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => updateFilter('category', cat === activeCategory ? '' : cat)}
          className={`px-4 py-2 rounded-full text-sm font-medium border capitalize transition-all duration-150 ${
            cat === activeCategory
              ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20'
              : 'bg-white/[0.04] text-white/50 border-white/[0.08] hover:text-white hover:border-white/20'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
