import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json()

    if (!phone) {
      return new Response(JSON.stringify({ error: 'phone is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min expiry

    // Store OTP in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error: dbError } = await supabase
      .from('otp_codes')
      .upsert(
        { phone, code: otp, expires_at: expiresAt, verified: false },
        { onConflict: 'phone' },
      )

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

    return new Response(
      JSON.stringify({ success: true, message: 'OTP sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
