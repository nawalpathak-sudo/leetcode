import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_VERIFY_ATTEMPTS = 5

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
    const { phone, code } = await req.json()

    if (!phone || !code) {
      return jsonResponse({ error: 'phone and code are required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the OTP record for this phone (unverified + not expired)
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (fetchError || !otpRecord) {
      return jsonResponse({ success: false, error: 'Invalid or expired OTP' }, 401)
    }

    // Check if max attempts exceeded
    if ((otpRecord.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      await supabase
        .from('otp_codes')
        .delete()
        .eq('phone', phone)

      return jsonResponse({
        success: false,
        error: 'Too many failed attempts. Please request a new OTP.',
      }, 429)
    }

    // Wrong code — increment attempts
    if (otpRecord.code !== code) {
      await supabase
        .from('otp_codes')
        .update({ attempts: (otpRecord.attempts || 0) + 1 })
        .eq('phone', phone)

      const remaining = MAX_VERIFY_ATTEMPTS - (otpRecord.attempts || 0) - 1
      return jsonResponse({
        success: false,
        error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      }, 401)
    }

    // Correct code — mark verified
    await supabase
      .from('otp_codes')
      .update({ verified: true })
      .eq('phone', phone)

    return jsonResponse({ success: true, message: 'OTP verified' })
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500)
  }
})
