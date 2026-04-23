import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { action, ...body } = await req.json()

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    if (action === 'create') {
      const { name, phone, role, campus } = body
      if (!name || !phone || !role) {
        return NextResponse.json({ error: 'name, phone, and role are required' }, { status: 400 })
      }
      if (!['admin', 'faculty'].includes(role)) {
        return NextResponse.json({ error: 'role must be admin or faculty' }, { status: 400 })
      }
      if (role === 'faculty' && !campus) {
        return NextResponse.json({ error: 'campus is required for faculty' }, { status: 400 })
      }

      const formatted = phone.replace(/\D/g, '')
      const { data: user, error } = await supabase
        .from('admin_users')
        .insert({
          name,
          phone: formatted,
          role,
          campus: role === 'faculty' ? campus : null,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'A user with this phone number already exists.' }, { status: 409 })
        }
        throw error
      }

      return NextResponse.json({ success: true, user })
    }

    if (action === 'update') {
      const { id, active, role, campus, name } = body
      if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 })
      }

      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      if (typeof active === 'boolean') updates.active = active
      if (role) updates.role = role
      if (campus !== undefined) updates.campus = campus
      if (name) updates.name = name

      const { error } = await supabase
        .from('admin_users')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('manage-admin error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
