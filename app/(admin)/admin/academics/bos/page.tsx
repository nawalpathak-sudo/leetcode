import { createClient } from '@/lib/supabase/server'
import { fetchBOSList } from './_lib/queries'
import BOSListClient from './_components/BOSListClient'

export default async function BOSPage() {
  const supabase = await createClient()
  const bosList = await fetchBOSList(supabase)

  return <BOSListClient initialData={bosList} />
}
