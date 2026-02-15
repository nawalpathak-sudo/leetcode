import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const MAX_OTP_PER_PHONE = 3
const MAX_OTP_PER_IP = 10
const RATE_WINDOW_MINUTES = 10
const COOLDOWN_SECONDS = 30
const MAX_VERIFY_ATTEMPTS = 5

function apiMiddleware() {
  return {
    name: 'api-middleware',
    configureServer(server) {
      const env = loadEnv('', process.cwd(), '')

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()

        // Parse JSON body
        let body = {}
        if (req.method === 'POST') {
          body = await new Promise((resolve) => {
            let data = ''
            req.on('data', chunk => { data += chunk })
            req.on('end', () => {
              try { resolve(JSON.parse(data)) } catch { resolve({}) }
            })
          })
        }

        const json = (status, obj) => {
          res.writeHead(status, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(obj))
        }

        const getClientIp = () => {
          return (
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.headers['x-real-ip'] ||
            req.socket?.remoteAddress ||
            'unknown'
          )
        }

        try {
          const { createClient } = await import('@supabase/supabase-js')
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

          if (req.url === '/api/send-otp') {
            const { phone } = body
            if (!phone) return json(400, { error: 'phone is required' })

            if (!/^91\d{10}$/.test(phone)) {
              return json(400, { error: 'Invalid phone format. Expected 91 followed by 10 digits.' })
            }

            const clientIp = getClientIp()
            const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString()

            // Check per-phone rate limit
            const { count: phoneCount } = await supabase
              .from('otp_rate_limits')
              .select('*', { count: 'exact', head: true })
              .eq('phone', phone)
              .gte('created_at', windowStart)

            if (phoneCount >= MAX_OTP_PER_PHONE) {
              return json(429, { error: `Too many OTP requests. Try again after ${RATE_WINDOW_MINUTES} minutes.` })
            }

            // Check per-IP rate limit
            const { count: ipCount } = await supabase
              .from('otp_rate_limits')
              .select('*', { count: 'exact', head: true })
              .eq('ip_address', clientIp)
              .gte('created_at', windowStart)

            if (ipCount >= MAX_OTP_PER_IP) {
              return json(429, { error: 'Too many OTP requests from this network. Try again later.' })
            }

            // Check cooldown
            const { data: lastOtp } = await supabase
              .from('otp_codes')
              .select('created_at')
              .eq('phone', phone)
              .single()

            if (lastOtp) {
              const elapsed = (Date.now() - new Date(lastOtp.created_at).getTime()) / 1000
              if (elapsed < COOLDOWN_SECONDS) {
                const wait = Math.ceil(COOLDOWN_SECONDS - elapsed)
                return json(429, { error: `Please wait ${wait} seconds before requesting another OTP.` })
              }
            }

            // All checks passed
            const otp = String(Math.floor(100000 + Math.random() * 900000))
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

            const { error: dbError } = await supabase
              .from('otp_codes')
              .upsert({ phone, code: otp, expires_at: expiresAt, verified: false, attempts: 0, created_at: new Date().toISOString() }, { onConflict: 'phone' })

            if (dbError) return json(500, { error: `DB error: ${dbError.message}` })

            // Log for rate limiting
            await supabase
              .from('otp_rate_limits')
              .insert({ phone, ip_address: clientIp })

            const tsRes = await fetch(
              `https://wpapi.trustsignal.io/api/v1/whatsapp/otp?api_key=${env.TRUSTSIGNAL_API_KEY}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sender: env.TRUSTSIGNAL_SENDER,
                  to: phone,
                  template_id: 'algoarena_1_otp_i86q1d8ae5z8kw3f',
                  sample: { otp },
                }),
              },
            )
            const result = await tsRes.json()
            if (!tsRes.ok) return json(500, { error: `TrustSignal error: ${JSON.stringify(result)}` })

            return json(200, { success: true, message: 'OTP sent' })
          }

          if (req.url === '/api/verify-otp') {
            const { phone, code } = body
            if (!phone || !code) return json(400, { error: 'phone and code are required' })

            // Fetch OTP record (unverified + not expired)
            const { data: otpRecord, error: fetchError } = await supabase
              .from('otp_codes')
              .select('*')
              .eq('phone', phone)
              .eq('verified', false)
              .gt('expires_at', new Date().toISOString())
              .single()

            if (fetchError || !otpRecord) return json(401, { success: false, error: 'Invalid or expired OTP' })

            // Check max attempts
            if ((otpRecord.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
              await supabase.from('otp_codes').delete().eq('phone', phone)
              return json(429, { success: false, error: 'Too many failed attempts. Please request a new OTP.' })
            }

            // Wrong code — increment attempts
            if (otpRecord.code !== code) {
              await supabase
                .from('otp_codes')
                .update({ attempts: (otpRecord.attempts || 0) + 1 })
                .eq('phone', phone)

              const remaining = MAX_VERIFY_ATTEMPTS - (otpRecord.attempts || 0) - 1
              return json(401, { success: false, error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` })
            }

            // Correct code
            await supabase.from('otp_codes').update({ verified: true }).eq('phone', phone)

            return json(200, { success: true, message: 'OTP verified' })
          }

          return json(404, { error: 'Not found' })
        } catch (err) {
          console.error('API error:', err)
          return json(500, { error: err.message })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiMiddleware()],
})
