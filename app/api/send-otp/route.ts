import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_OTP_PER_PHONE = 3
const MAX_OTP_PER_IP = 10
const RATE_WINDOW_MINUTES = 10
const COOLDOWN_SECONDS = 30

function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function isValidPhone(phone: string) {
  return /^91\d{10}$/.test(phone)
}

export async function POST(req: NextRequest) {
  const { phone } = await req.json()

  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: 'Invalid phone format. Expected 91 followed by 10 digits.' }, { status: 400 })
  }

  const clientIp = getClientIp(req)

  try {
    const supabase = createAdminClient()
    const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString()

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

    if ((phoneResult.count ?? 0) >= MAX_OTP_PER_PHONE) {
      return NextResponse.json({ error: `Too many OTP requests. Try again after ${RATE_WINDOW_MINUTES} minutes.` }, { status: 429 })
    }

    if ((ipResult.count ?? 0) >= MAX_OTP_PER_IP) {
      return NextResponse.json({ error: 'Too many OTP requests from this network. Try again later.' }, { status: 429 })
    }

    if (cooldownResult.data) {
      const elapsed = (Date.now() - new Date(cooldownResult.data.created_at).getTime()) / 1000
      if (elapsed < COOLDOWN_SECONDS) {
        const wait = Math.ceil(COOLDOWN_SECONDS - elapsed)
        return NextResponse.json({ error: `Please wait ${wait} seconds before requesting another OTP.` }, { status: 429 })
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

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
          template_id: 'algoarena_new_opt',
          sample: { otp },
        }),
      },
    )

    const result = await tsRes.json()

    if (!tsRes.ok) {
      throw new Error(`TrustSignal error: ${JSON.stringify(result)}`)
    }

    return NextResponse.json({ success: true, message: 'OTP sent' })
  } catch (err: any) {
    console.error('send-otp error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
