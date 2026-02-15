import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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

        try {
          const { createClient } = await import('@supabase/supabase-js')
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

          if (req.url === '/api/send-otp') {
            const { phone } = body
            if (!phone) return json(400, { error: 'phone is required' })

            const otp = String(Math.floor(100000 + Math.random() * 900000))
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

            const { error: dbError } = await supabase
              .from('otp_codes')
              .upsert({ phone, code: otp, expires_at: expiresAt, verified: false }, { onConflict: 'phone' })

            if (dbError) return json(500, { error: `DB error: ${dbError.message}` })

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

            const { data, error } = await supabase
              .from('otp_codes')
              .select('*')
              .eq('phone', phone)
              .eq('code', code)
              .eq('verified', false)
              .gt('expires_at', new Date().toISOString())
              .single()

            if (error || !data) return json(401, { success: false, error: 'Invalid or expired OTP' })

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
