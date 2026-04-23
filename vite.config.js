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

        const isMultipart = (req.headers['content-type'] || '').includes('multipart')

        // Parse JSON body (skip for multipart — those need raw stream)
        let body = {}
        if (req.method === 'POST' && !isMultipart) {
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
                  template_id: 'algoarena_new_opt',
                  sample: { otp },
                }),
              },
            )
            const result = await tsRes.json()
            if (!tsRes.ok) return json(500, { error: `TrustSignal error: ${JSON.stringify(result)}` })

            return json(200, { success: true, message: 'OTP sent' })
          }

          if (req.url === '/api/extract-bos') {
            // Handle both multipart (file upload) and raw body
            if (!isMultipart) return json(400, { error: 'Upload a file' })
            // Buffer the raw body, then call Gemini inline
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            const rawBody = Buffer.concat(chunks)

            const boundary = (req.headers['content-type'] || '').match(/boundary=(.+)/)?.[1]
            if (!boundary) return json(400, { error: 'No multipart boundary' })

            // Parse multipart to get the file
            const boundaryBuf = Buffer.from('--' + boundary)
            let fileData = null
            let fileName = ''
            let start = rawBody.indexOf(boundaryBuf) + boundaryBuf.length + 2
            while (start < rawBody.length) {
              const end = rawBody.indexOf(boundaryBuf, start)
              if (end === -1) break
              const part = rawBody.slice(start, end - 2)
              const headerEnd = part.indexOf('\r\n\r\n')
              if (headerEnd !== -1) {
                const hdr = part.slice(0, headerEnd).toString()
                if (hdr.includes('name="file"')) {
                  fileData = part.slice(headerEnd + 4)
                  const fnMatch = hdr.match(/filename="([^"]+)"/)
                  fileName = fnMatch?.[1] || ''
                }
              }
              start = end + boundaryBuf.length + 2
            }

            if (!fileData) return json(400, { error: 'No file in upload' })

            // Detect file type
            const ext = fileName.toLowerCase().split('.').pop()
            const isCSV = ext === 'csv' || ext === 'txt'
            const mimeType = isCSV ? 'text/csv' : 'application/pdf'

            // For CSV, send as text directly; for PDF, send as base64
            let fileParts
            if (isCSV) {
              fileParts = { text: 'FILE CONTENT (CSV):\n' + fileData.toString('utf-8') }
            } else {
              fileParts = { inlineData: { mimeType, data: fileData.toString('base64') } }
            }
            const geminiKey = env.GEMINI_API_KEY
            if (!geminiKey) return json(500, { error: 'GEMINI_API_KEY not set' })

            try {
              const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        fileParts,
                        { text: `Extract the Board of Studies (BOS) curriculum from this document. Return ONLY valid JSON in this exact format:
{"name":"Detected BOS name","program":"B.Tech","semesters":[{"semester":1,"subjects":[{"subject_code":"CS101","subject_name":"Engineering Mathematics I","category":"BSC","lecture_hours":3,"tutorial_hours":1,"practical_hours":0,"is_elective":false,"topics":["Topic 1","Topic 2"]}]}]}

IMPORTANT RULES:
1. If the document has MULTIPLE BOS columns (e.g., original vs modified/SELECT), extract ONLY the SELECT / modified / rightmost version, IGNORE the original/left column entirely.
2. MERGE theory + lab into ONE subject. If "Data Structures" (3 cr) and "Data Structures Lab" (1 cr) appear as separate rows, COMBINE them into ONE subject: "Data Structures" with L=2, T=1, P=2 (theory credits from theory row, practical hours = lab credits × 2). Do this for ALL theory+lab pairs. The goal is MINIMUM UNIQUE subjects per semester.
3. L-T-P extraction:
   - If L-T-P pattern is given (e.g., 3-1-0), use directly.
   - L-T-P values are HOURS per week. Credits = L + T + P/2 (AICTE: 2 practical hours = 1 credit).
   - If L-T-P columns exist in document, use them directly as hours.
   - If only total credits given for a THEORY subject (no L-T-P): set L=credits, T=0, P=0. NEVER put anything in T unless document explicitly says Tutorial.
   - If only total credits for a LAB subject: set L=0, T=0, P=credits*2 (convert credits to hours: 1 credit = 2 hours).
   - If theory + lab rows exist for same subject: MERGE into ONE. L=theory_credits, T=0, P=lab_credits*2.
4. Category mapping: DC/PCC→PCC, AECC/HSS→HSS, BSC→BSC, ESC→ESC, SEC→PCC, GE/OE/OEC→OEC, PEC/PE→PEC, Minor→PEC, MD→OEC, VAC→HSS, DAP/Project→PrSI, DSEEC→PCC, Audit→AUC. If unsure, use PCC.
5. subject_code: Use code from document. If none, generate as SEM1-01, SEM1-02, etc.
6. Topics: Extract if listed, else empty array.
7. is_elective: true if marked elective/optional.
8. Skip total/summary rows. Only extract actual subjects.
9. Return ONLY the JSON object.` }
                      ]
                    }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 131072, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
                  })
                }
              )
              const gData = await geminiRes.json()
              let text = gData.candidates?.[0]?.content?.parts?.[0]?.text || ''
              if (!text) return json(422, { ok: false, error: 'Empty Gemini response', raw: JSON.stringify(gData).slice(0, 500) })

              text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
              let parsed
              try {
                parsed = JSON.parse(text)
              } catch {
                // Try to repair truncated JSON by closing open brackets
                let repaired = text
                const opens = (repaired.match(/\[/g) || []).length - (repaired.match(/\]/g) || []).length
                const braces = (repaired.match(/\{/g) || []).length - (repaired.match(/\}/g) || []).length
                // Trim trailing incomplete object/string
                repaired = repaired.replace(/,?\s*\{[^}]*$/, '')
                repaired = repaired.replace(/,?\s*"[^"]*$/, '')
                for (let i = 0; i < opens; i++) repaired += ']'
                for (let i = 0; i < braces; i++) repaired += '}'
                try {
                  parsed = JSON.parse(repaired)
                  console.log('Repaired truncated JSON successfully')
                } catch {
                  return json(422, { ok: false, error: 'JSON parse failed even after repair', preview: text.slice(0, 500) })
                }
              }

              return json(200, { ok: true, data: parsed })
            } catch (err) {
              return json(500, { ok: false, error: err.message })
            }
          }

          if (req.url === '/api/sync-gsheet') {
            // Set env vars and run sync inline
            process.env.SUPABASE_URL = env.SUPABASE_URL
            process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = env.GOOGLE_SERVICE_ACCOUNT_EMAIL
            process.env.GOOGLE_PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY
            process.env.GSHEET_ID = env.GSHEET_ID
            process.env.GSHEET_GID = env.GSHEET_GID
            process.env.SYNC_SECRET = env.SYNC_SECRET

            const { default: syncHandler } = await import(
              /* @vite-ignore */ 'file://' + process.cwd() + '/api/sync-gsheet.js'
            )
            const fakeReq = {
              headers: { authorization: `Bearer ${env.SYNC_SECRET}` },
            }
            const fakeRes = {
              _status: 200,
              _body: null,
              status(code) { this._status = code; return this },
              json(obj) { this._body = obj; return this },
            }
            await syncHandler(fakeReq, fakeRes)
            return json(fakeRes._status, fakeRes._body)
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
