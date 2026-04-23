import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSign } from 'crypto'

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets.readonly'

function base64url(str: string) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify({
    iss: email, scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }))

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(key, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${header}.${payload}.${signature}`,
  })

  const data = await res.json()
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

async function fetchSheetData(token: string, sheetId: string, gid: string) {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const meta = await metaRes.json()
  const sheet = meta.sheets?.find((s: any) => String(s.properties.sheetId) === String(gid))
  const sheetName = sheet?.properties?.title || 'Sheet1'

  const dataRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetName)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await dataRes.json()
  if (!data.values || data.values.length < 2) throw new Error('Sheet is empty or has no data rows')
  return data.values
}

function parseNumber(val: string) {
  if (!val || val === '' || val === '-' || val === 'NA') return null
  const n = parseFloat(String(val).replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function parseDate(val: string) {
  if (!val || val === '' || val === '-' || val === 'NA') return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
}

function buildHeaderMap(headers: string[]) {
  const map: Record<string, number> = {}
  headers.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    map[key] = i
  })
  return map
}

function get(row: string[], map: Record<string, number>, key: string) {
  const idx = map[key]
  return idx !== undefined ? (row[idx] || '') : ''
}

function processRows(rows: string[][]) {
  const map = buildHeaderMap(rows[0])
  const dataRows = rows.slice(1)
  const students: any[] = []
  const attendance: any[] = []
  const fees: any[] = []

  for (const row of dataRows) {
    const id = get(row, map, 'id')?.trim()
    if (!id || id === 'ID' || !/^\d+$/.test(id)) continue

    students.push({
      lead_id: id,
      student_name: get(row, map, 'name') || '',
      email: get(row, map, 'email') || '',
      college: get(row, map, 'campus_name') || '',
      batch: get(row, map, 'batch') || '',
      cplm_id: get(row, map, 'cplm_id') || null,
      campus_name: get(row, map, 'campus_name') || '',
      program_name: get(row, map, 'program_name') || '',
      degree_name: get(row, map, 'degree_name') || '',
      offering_type: get(row, map, 'offering_type') || '',
      active_status: get(row, map, 'active_status') || 'Active',
      rtc: get(row, map, 'rtc') || '',
      reason: get(row, map, 'reason') || '',
      marked_inactive_date: parseDate(get(row, map, 'marked_inactive_date')),
      refund_req_on_crm: get(row, map, 'refund_req_on_crm') || '',
      refund_asked_date: parseDate(get(row, map, 'refund_asked_date')),
      refund_status: get(row, map, 'status') || '',
      refund_date: parseDate(get(row, map, 'refund_date')),
    })

    attendance.push({
      lead_id: id,
      overall_pct: parseNumber(get(row, map, 'overall_attendance')),
      sem1_pct: parseNumber(get(row, map, 'sem_1_attendance')),
      sem2_pct: parseNumber(get(row, map, 'sem_2_attendance')),
      sem3_pct: parseNumber(get(row, map, 'sem_3_attendance')),
      sem4_pct: parseNumber(get(row, map, 'sem_4_attendance')),
      sem5_pct: parseNumber(get(row, map, 'sem_5_attendance')),
      sem6_pct: parseNumber(get(row, map, 'sem_6_attendance')),
      synced_at: new Date().toISOString(),
    })

    fees.push({
      lead_id: id,
      total_fee: parseNumber(get(row, map, 'total_fee')),
      total_fee_paid: parseNumber(get(row, map, 'total_fee_paid')),
      total_fee_pending: parseNumber(get(row, map, 'total_fee_pending')),
      total_fee_till_date: parseNumber(get(row, map, 'total_fee_till_date')),
      total_fee_paid_till_date: parseNumber(get(row, map, 'total_fee_paid_till_date')),
      total_fee_pending_till_date: parseNumber(get(row, map, 'total_fee_pending_till_date')),
      sem1_fee: parseNumber(get(row, map, 'sem1_fee')), sem1_fee_paid: parseNumber(get(row, map, 'sem1_fee_paid')),
      sem1_fee_pending: parseNumber(get(row, map, 'sem1_fee_pending')),
      sem1_pending_bucket: get(row, map, 'sem1_fee_pending_bucket') || '',
      sem1_deadline_date: parseDate(get(row, map, 'sem1_fee_deadline_date')),
      sem1_deadline_bucket: get(row, map, 'sem1_deadline_bucket') || '',
      sem2_fee: parseNumber(get(row, map, 'sem2_fee')), sem2_fee_paid: parseNumber(get(row, map, 'sem2_fee_paid')),
      sem2_fee_pending: parseNumber(get(row, map, 'sem2_fee_pending')),
      sem2_pending_bucket: get(row, map, 'sem2_fee_pending_bucket') || '',
      sem2_deadline_date: parseDate(get(row, map, 'sem2_fee_deadline_date')),
      sem2_deadline_bucket: get(row, map, 'sem2_deadline_bucket') || '',
      sem3_fee: parseNumber(get(row, map, 'sem3_fee')), sem3_fee_paid: parseNumber(get(row, map, 'sem3_fee_paid')),
      sem3_fee_pending: parseNumber(get(row, map, 'sem3_fee_pending')),
      sem3_pending_bucket: get(row, map, 'sem3_fee_pending_bucket') || '',
      sem3_deadline_date: parseDate(get(row, map, 'sem3_fee_deadline_date')),
      sem3_deadline_bucket: get(row, map, 'sem3_deadline_bucket') || '',
      sem4_fee: parseNumber(get(row, map, 'sem4_fee')), sem4_fee_paid: parseNumber(get(row, map, 'sem4_fee_paid')),
      sem4_fee_pending: parseNumber(get(row, map, 'sem4_fee_pending')),
      sem4_pending_bucket: get(row, map, 'sem4_fee_pending_bucket') || '',
      sem4_deadline_date: parseDate(get(row, map, 'sem4_fee_deadline_date')),
      sem4_deadline_bucket: get(row, map, 'sem4_deadline_bucket') || '',
      sem5_fee: parseNumber(get(row, map, 'sem5_fee')), sem5_fee_paid: parseNumber(get(row, map, 'sem5_fee_paid')),
      sem5_fee_pending: parseNumber(get(row, map, 'sem5_fee_pending')),
      sem5_pending_bucket: get(row, map, 'sem5_fee_pending_bucket') || '',
      sem5_deadline_date: parseDate(get(row, map, 'sem5_fee_deadline_date')),
      sem5_deadline_bucket: get(row, map, 'sem5_deadline_bucket') || '',
      sem6_fee: parseNumber(get(row, map, 'sem6_fee')), sem6_fee_paid: parseNumber(get(row, map, 'sem6_fee_paid')),
      sem6_fee_pending: parseNumber(get(row, map, 'sem6_fee_pending')),
      sem6_pending_bucket: get(row, map, 'sem6_fee_pending_bucket') || '',
      sem6_deadline_date: parseDate(get(row, map, 'sem6_fee_deadline_date')),
      sem6_deadline_bucket: get(row, map, 'sem6_deadline_bucket') || '',
      synced_at: new Date().toISOString(),
    })
  }
  return { students, attendance, fees }
}

async function batchUpsert(db: any, table: string, rows: any[], conflictKey: string, chunkSize = 200) {
  let upserted = 0, failed = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await db.from(table).upsert(chunk, { onConflict: conflictKey })
    if (error) { console.error(`Upsert ${table} chunk ${i}:`, error.message); failed += chunk.length }
    else { upserted += chunk.length }
  }
  return { upserted, failed }
}

export async function GET(req: NextRequest) {
  return handleSync(req)
}

export async function POST(req: NextRequest) {
  return handleSync(req)
}

async function handleSync(req: NextRequest) {
  const supabase = createAdminClient()
  const SHEET_ID = process.env.GSHEET_ID!
  const GID = process.env.GSHEET_GID || '0'
  const SYNC_SECRET = process.env.SYNC_SECRET

  const authHeader = req.headers.get('authorization')
  if (SYNC_SECRET && authHeader !== `Bearer ${SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: logEntry } = await supabase
    .from('gsheet_sync_log')
    .insert({ sync_type: 'student_data', status: 'running' })
    .select('id').single()

  const logId = logEntry?.id

  try {
    const token = await getAccessToken()
    const rows = await fetchSheetData(token, SHEET_ID, GID)
    const totalRows = rows.length - 1
    const { students, attendance, fees } = processRows(rows)

    const studentResult = await batchUpsert(supabase, 'students', students, 'lead_id')
    const [attendanceResult, feesResult] = await Promise.all([
      batchUpsert(supabase, 'student_attendance', attendance, 'lead_id'),
      batchUpsert(supabase, 'student_fees', fees, 'lead_id'),
    ])

    const totalUpserted = studentResult.upserted + attendanceResult.upserted + feesResult.upserted
    const totalFailed = studentResult.failed + attendanceResult.failed + feesResult.failed

    if (logId) {
      await supabase.from('gsheet_sync_log').update({
        finished_at: new Date().toISOString(),
        rows_fetched: totalRows, rows_upserted: totalUpserted, rows_failed: totalFailed,
        status: totalFailed > 0 ? 'failed' : 'success',
        error_message: totalFailed > 0 ? `${totalFailed} rows failed across tables` : null,
      }).eq('id', logId)
    }

    return NextResponse.json({ ok: true, rows_fetched: totalRows, students: studentResult, attendance: attendanceResult, fees: feesResult })
  } catch (err: any) {
    console.error('Sync failed:', err)
    if (logId) {
      await supabase.from('gsheet_sync_log').update({
        finished_at: new Date().toISOString(), status: 'failed', error_message: err.message,
      }).eq('id', logId)
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
