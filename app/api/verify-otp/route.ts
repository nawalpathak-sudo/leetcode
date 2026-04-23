import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SignJWT } from 'jose'

const MAX_VERIFY_ATTEMPTS = 5

async function createSessionCookie(payload: Record<string, any>) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'alta_jwt_secret_2026_change_in_production')
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15d')
    .sign(secret)
  return token
}

export async function POST(req: NextRequest) {
  const { phone, code, userType = 'admin' } = await req.json()

  if (!phone || !code) {
    return NextResponse.json({ error: 'phone and code are required' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()

    // Dev bypass: master admin with hardcoded OTP (remove in production)
    if (phone === '918770857928' && code === '060226' && userType === 'admin') {
      const { data: masterUser } = await supabase
        .from('admin_users')
        .select('id, name, phone, role, campus, active')
        .eq('phone', '918770857928')
        .eq('active', true)
        .single()

      if (masterUser) {
        const sessionPayload = {
          id: masterUser.id,
          role: masterUser.role,
          campus: masterUser.campus,
          name: masterUser.name,
          expiresAt: Date.now() + 15 * 24 * 60 * 60 * 1000,
        }
        const token = await createSessionCookie(sessionPayload)
        const response = NextResponse.json({ success: true, message: 'OTP verified', user: sessionPayload })
        response.cookies.set('alta_session', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 15 * 24 * 60 * 60,
          path: '/',
        })
        return response
      }
    }

    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (fetchError || !otpRecord) {
      return NextResponse.json({ success: false, error: 'Invalid or expired OTP' }, { status: 401 })
    }

    if ((otpRecord.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      await supabase.from('otp_codes').delete().eq('phone', phone)
      return NextResponse.json({ success: false, error: 'Too many failed attempts. Please request a new OTP.' }, { status: 429 })
    }

    if (otpRecord.code !== code) {
      await supabase
        .from('otp_codes')
        .update({ attempts: (otpRecord.attempts || 0) + 1 })
        .eq('phone', phone)

      const remaining = MAX_VERIFY_ATTEMPTS - (otpRecord.attempts || 0) - 1
      return NextResponse.json({
        success: false,
        error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      }, { status: 401 })
    }

    // Correct code — mark verified
    await supabase.from('otp_codes').update({ verified: true }).eq('phone', phone)

    // Look up user based on type
    let sessionPayload: Record<string, any> = {}

    if (userType === 'admin') {
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id, name, phone, role, campus, active')
        .eq('phone', phone)
        .eq('active', true)
        .single()

      if (!adminUser) {
        return NextResponse.json({ success: false, error: 'No active admin account found for this phone.' }, { status: 403 })
      }

      sessionPayload = {
        id: adminUser.id,
        role: adminUser.role,
        campus: adminUser.campus,
        name: adminUser.name,
        expiresAt: Date.now() + 15 * 24 * 60 * 60 * 1000,
      }
    } else {
      // Student login
      const { data: student } = await supabase
        .from('students')
        .select('lead_id, student_name, phone, college, batch')
        .eq('phone', phone)
        .single()

      if (!student) {
        return NextResponse.json({ success: false, error: 'No student account found for this phone.' }, { status: 403 })
      }

      sessionPayload = {
        id: student.lead_id,
        role: 'student',
        name: student.student_name,
        expiresAt: Date.now() + 15 * 24 * 60 * 60 * 1000,
      }
    }

    // Create JWT and set as HTTP-only cookie
    const token = await createSessionCookie(sessionPayload)
    const cookieName = userType === 'admin' ? 'alta_session' : 'alta_student_session'

    const response = NextResponse.json({
      success: true,
      message: 'OTP verified',
      user: sessionPayload,
    })

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 24 * 60 * 60, // 15 days
      path: '/',
    })

    return response
  } catch (err: any) {
    console.error('verify-otp error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
