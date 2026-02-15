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

  const { phone, code } = req.body || {}

  if (!phone || !code) {
    return res.status(400).json({ error: 'phone and code are required' })
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const { data, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      return res.status(401).json({ success: false, error: 'Invalid or expired OTP' })
    }

    await supabase
      .from('otp_codes')
      .update({ verified: true })
      .eq('phone', phone)

    return res.status(200).json({ success: true, message: 'OTP verified' })
  } catch (err) {
    console.error('verify-otp error:', err)
    return res.status(500).json({ error: err.message })
  }
}
