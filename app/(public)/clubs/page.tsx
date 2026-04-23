import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Users, Search } from 'lucide-react'
import type { Metadata } from 'next'
import { ClubsFilter } from './clubs-filter'

export const metadata: Metadata = {
  title: 'Student Clubs',
  description:
    'Browse all student clubs at ALTA School of Technology. Find coding, cultural, sports, and tech communities.',
}

export default async function ClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ campus?: string; category?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('clubs')
    .select('id, name, description, campus_name, logo_url, category, club_members(count)')
    .eq('active', true)
    .order('name', { ascending: true })

  if (params.campus) {
    query = query.eq('campus_name', params.campus)
  }
  if (params.category) {
    query = query.eq('category', params.category)
  }

  const { data: clubs } = await query

  // Fetch distinct campuses and categories for filters
  const [campusRes, categoryList] = await Promise.all([
    supabase
      .from('clubs')
      .select('campus_name')
      .eq('active', true),
    ['coding', 'cultural', 'sports', 'tech', 'social'],
  ])

  const campuses = [
    ...new Set((campusRes.data ?? []).map((c: any) => c.campus_name)),
  ] as string[]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-10 pt-4">
        <h1 className="text-3xl sm:text-4xl font-bold">
          <span className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] bg-clip-text text-transparent">
            Student Clubs
          </span>
        </h1>
        <p className="text-base mt-3 text-white/50">
          Find a community that matches your interests
        </p>
      </div>

      {/* Filters (Client Component) */}
      <ClubsFilter
        campuses={campuses}
        categories={categoryList}
        activeCampus={params.campus ?? ''}
        activeCategory={params.category ?? ''}
      />

      {/* Clubs Grid */}
      {(clubs ?? []).length === 0 ? (
        <div className="text-center py-24">
          <Search className="w-12 h-12 mx-auto mb-4 text-white/10" />
          <p className="text-white/40 text-lg">
            No clubs found. Try adjusting your filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(clubs ?? []).map((club: any) => {
            const memberCount = club.club_members?.[0]?.count ?? 0
            return (
              <Link
                key={club.id}
                href={`/clubs/${club.id}`}
                className="cv-glass cv-glass-hover group block rounded-2xl p-6 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  {club.logo_url ? (
                    <img
                      src={club.logo_url}
                      alt={club.name}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0 ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white font-bold text-xl">
                      {club.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base text-white group-hover:text-[#F59E0B] transition-colors truncate">
                      {club.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium border border-[#F59E0B]/20 bg-[#F59E0B]/5 text-[#F59E0B]">
                        {club.campus_name}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full capitalize bg-white/[0.04] text-white/40 border border-white/[0.06]">
                        {club.category}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-sm mt-4 line-clamp-2 text-white/50">
                  {club.description || 'No description yet.'}
                </p>

                <div className="flex items-center gap-1.5 mt-4 text-xs font-medium text-white/30">
                  <Users className="w-3.5 h-3.5" />
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
