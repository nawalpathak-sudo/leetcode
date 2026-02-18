import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, ...body } = req.body || {}

  if (!action) {
    return res.status(400).json({ error: 'action is required' })
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    if (action === 'create') {
      const { name, phone, role, campus } = body
      if (!name || !phone || !role) {
        return res.status(400).json({ error: 'name, phone, and role are required' })
      }
      if (!['admin', 'faculty'].includes(role)) {
        return res.status(400).json({ error: 'role must be admin or faculty' })
      }
      if (role === 'faculty' && !campus) {
        return res.status(400).json({ error: 'campus is required for faculty' })
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
          return res.status(409).json({ error: 'A user with this phone number already exists.' })
        }
        throw error
      }

      return res.status(200).json({ success: true, user })
    }

    if (action === 'update') {
      const { id, active, role, campus, name } = body
      if (!id) {
        return res.status(400).json({ error: 'id is required' })
      }

      const updates = { updated_at: new Date().toISOString() }
      if (typeof active === 'boolean') updates.active = active
      if (role) updates.role = role
      if (campus !== undefined) updates.campus = campus
      if (name) updates.name = name

      const { error } = await supabase
        .from('admin_users')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('manage-admin error:', err)
    return res.status(500).json({ error: err.message })
  }
}
