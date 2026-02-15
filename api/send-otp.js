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

  const { phone } = req.body || {}

  if (!phone) {
    return res.status(400).json({ error: 'phone is required' })
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { error: dbError } = await supabase
      .from('otp_codes')
      .upsert(
        { phone, code: otp, expires_at: expiresAt, verified: false },
        { onConflict: 'phone' },
      )

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
