import { createClient } from '@supabase/supabase-js'

const MAX_OTP_PER_PHONE = 3    // max 3 OTPs per phone per window
const MAX_OTP_PER_IP = 10      // max 10 OTPs per IP per window
const RATE_WINDOW_MINUTES = 10 // rate limit window
const COOLDOWN_SECONDS = 30    // min gap between OTPs for same phone

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

function isValidPhone(phone) {
  return /^91\d{10}$/.test(phone)
}

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

  const { phone } = req.body || {}

  if (!phone) {
    return res.status(400).json({ error: 'phone is required' })
  }

  if (!isValidPhone(phone)) {
    return res.status(400).json({ error: 'Invalid phone format. Expected 91 followed by 10 digits.' })
  }

  const clientIp = getClientIp(req)

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString()

    // Run all 3 rate limit checks in parallel
    const [phoneResult, ipResult, cooldownResult] = await Promise.all([
      supabase
        .from('otp_rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('phone', phone)
        .gte('created_at', windowStart),
      supabase
        .from('otp_rate_limits')
        .select('*', { count: 'exact', head: true })
        .eq('ip_address', clientIp)
        .gte('created_at', windowStart),
      supabase
        .from('otp_codes')
        .select('created_at')
        .eq('phone', phone)
        .single(),
    ])

    if (phoneResult.count >= MAX_OTP_PER_PHONE) {
      return res.status(429).json({
        error: `Too many OTP requests. Try again after ${RATE_WINDOW_MINUTES} minutes.`,
      })
    }

    if (ipResult.count >= MAX_OTP_PER_IP) {
      return res.status(429).json({
        error: 'Too many OTP requests from this network. Try again later.',
      })
    }

    if (cooldownResult.data) {
      const elapsed = (Date.now() - new Date(cooldownResult.data.created_at).getTime()) / 1000
      if (elapsed < COOLDOWN_SECONDS) {
        const wait = Math.ceil(COOLDOWN_SECONDS - elapsed)
        return res.status(429).json({
          error: `Please wait ${wait} seconds before requesting another OTP.`,
        })
      }
    }

    // All checks passed — generate and send OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Save OTP and log rate limit in parallel
    const [{ error: dbError }] = await Promise.all([
      supabase
        .from('otp_codes')
        .upsert(
          { phone, code: otp, expires_at: expiresAt, verified: false, attempts: 0, created_at: new Date().toISOString() },
          { onConflict: 'phone' },
        ),
      supabase
        .from('otp_rate_limits')
        .insert({ phone, ip_address: clientIp }),
    ])

    if (dbError) throw new Error(`DB error: ${dbError.message}`)

    const apiKey = process.env.TRUSTSIGNAL_API_KEY
    const sender = process.env.TRUSTSIGNAL_SENDER

    const tsRes = await fetch(
      `https://wpapi.trustsignal.io/api/v1/whatsapp/otp?api_key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender,
          to: phone,
          template_id: 'algoarena_1_otp_i86q1d8ae5z8kw3f',
          sample: { otp },
        }),
      },
    )

    const result = await tsRes.json()

    if (!tsRes.ok) {
      throw new Error(`TrustSignal error: ${JSON.stringify(result)}`)
    }

    return res.status(200).json({ success: true, message: 'OTP sent' })
  } catch (err) {
    console.error('send-otp error:', err)
    return res.status(500).json({ error: err.message })
  }
}
