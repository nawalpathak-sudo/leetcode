import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import UsersClient from './_components/UsersClient'

export default async function UsersPage() {
  const supabase = await createClient()
  const headersList = await headers()

  const userId = headersList.get('x-user-id') || ''
  const userRole = headersList.get('x-user-role') || ''

  // Load admin users
  const { data: adminUsers } = await supabase
    .from('admin_users')
    .select('id, name, phone, role, campus, active, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  // Load campuses for dropdown (minimal: just names)
  const { data: campusData } = await supabase
    .from('master_campuses')
    .select('name')
    .eq('active', true)
    .order('name')

  const campuses = (campusData || []).map((c: { name: string }) => c.name)

  return (
    <UsersClient
      initialUsers={adminUsers || []}
      campuses={campuses}
      adminUser={{ id: userId, role: userRole }}
    />
  )
}
