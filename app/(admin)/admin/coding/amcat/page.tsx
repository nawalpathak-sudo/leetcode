import AmcatClient from './_components/AmcatClient'

export const dynamic = 'force-dynamic'

export default function AmcatPage() {
  // AMCAT uses a separate Supabase project, so all data fetching
  // happens client-side via createAmcatClient
  return <AmcatClient />
}
