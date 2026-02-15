import { createClient } from '@supabase/supabase-js'

const MAX_VERIFY_ATTEMPTS = 5

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

    // Fetch the OTP record for this phone (unverified + not expired)
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (fetchError || !otpRecord) {
      return res.status(401).json({ success: false, error: 'Invalid or expired OTP' })
    }

    // Check if max attempts exceeded
    if ((otpRecord.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      // Invalidate the OTP entirely
      await supabase
        .from('otp_codes')
        .delete()
        .eq('phone', phone)

      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Please request a new OTP.',
      })
    }

    // Wrong code — increment attempts
    if (otpRecord.code !== code) {
      await supabase
        .from('otp_codes')
        .update({ attempts: (otpRecord.attempts || 0) + 1 })
        .eq('phone', phone)

      const remaining = MAX_VERIFY_ATTEMPTS - (otpRecord.attempts || 0) - 1
      return res.status(401).json({
        success: false,
        error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      })
    }

    // Correct code — mark verified
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
