import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/', '/practice', '/projects', '/admin/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths — no auth needed
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next()
  }

  // Public profile pages (/:slug) — no auth
  // But exclude /admin, /portal, /api paths
  if (
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/portal') &&
    !pathname.startsWith('/api')
  ) {
    return NextResponse.next()
  }

  // API routes handle their own auth
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Admin routes — check for admin session cookie
  if (pathname.startsWith('/admin')) {
    // Skip login page
    if (pathname === '/admin/login') {
      return NextResponse.next()
    }

    const session = request.cookies.get('alta_session')
    if (!session?.value) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'alta_jwt_secret_2026_change_in_production')
      const { payload } = await jwtVerify(session.value, secret)

      // Check role
      const role = payload.role as string
      if (!['admin', 'master', 'faculty'].includes(role)) {
        return NextResponse.redirect(new URL('/admin/login', request.url))
      }

      // Check expiry
      const expiresAt = payload.expiresAt as number
      if (expiresAt && Date.now() > expiresAt) {
        const response = NextResponse.redirect(new URL('/admin/login', request.url))
        response.cookies.delete('alta_session')
        return response
      }

      // Attach user info to headers for downstream use
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-user-id', payload.id as string)
      requestHeaders.set('x-user-role', role)
      if (payload.campus) {
        requestHeaders.set('x-user-campus', payload.campus as string)
      }

      return NextResponse.next({ request: { headers: requestHeaders } })
    } catch {
      // Invalid JWT
      const response = NextResponse.redirect(new URL('/admin/login', request.url))
      response.cookies.delete('alta_session')
      return response
    }
  }

  // Portal routes — check for student session
  if (pathname.startsWith('/portal')) {
    const session = request.cookies.get('alta_student_session')
    if (!session?.value) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    // Student session validation similar to admin
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.png|alta-.*\\.png|.*\\.svg$).*)',
  ],
}
