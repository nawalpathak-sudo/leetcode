import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_OTP_PER_PHONE = 3
const MAX_OTP_PER_IP = 10
const RATE_WINDOW_MINUTES = 10
const COOLDOWN_SECONDS = 30

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function isValidPhone(phone: string): boolean {
  return /^91\d{10}$/.test(phone)
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json()

    if (!phone) {
      return jsonResponse({ error: 'phone is required' }, 400)
    }

    if (!isValidPhone(phone)) {
      return jsonResponse({ error: 'Invalid phone format. Expected 91 followed by 10 digits.' }, 400)
    }

    const clientIp = getClientIp(req)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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

    if ((phoneResult.count ?? 0) >= MAX_OTP_PER_PHONE) {
      return jsonResponse({
        error: `Too many OTP requests. Try again after ${RATE_WINDOW_MINUTES} minutes.`,
      }, 429)
    }

    if ((ipResult.count ?? 0) >= MAX_OTP_PER_IP) {
      return jsonResponse({
        error: 'Too many OTP requests from this network. Try again later.',
      }, 429)
    }

    if (cooldownResult.data) {
      const elapsed = (Date.now() - new Date(cooldownResult.data.created_at).getTime()) / 1000
      if (elapsed < COOLDOWN_SECONDS) {
        const wait = Math.ceil(COOLDOWN_SECONDS - elapsed)
        return jsonResponse({
          error: `Please wait ${wait} seconds before requesting another OTP.`,
        }, 429)
      }
    }

    // All checks passed — generate and send OTP
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

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

    // Send OTP via TrustSignal WhatsApp API
    const apiKey = Deno.env.get('TRUSTSIGNAL_API_KEY')!
    const sender = Deno.env.get('TRUSTSIGNAL_SENDER')!

    const res = await fetch(
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

    const result = await res.json()

    if (!res.ok) {
      throw new Error(`TrustSignal error: ${JSON.stringify(result)}`)
    }

    return jsonResponse({ success: true, message: 'OTP sent' })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
