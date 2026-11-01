// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Only these prefixes require an authenticated session.
 *
 * Everything else — the storefront, product pages, /cart, /signup, /login,
 * /order/[token] (token-based guest access), /policies, /contact — is PUBLIC.
 *
 * API routes (if any) must do their own auth — they are not in this list.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/account', '/checkout']

const isProtectedPath = (path: string) =>
  PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Redirect helper that carries over refreshed session cookies.
  // Without this, any refresh that happens during getUser() is discarded
  // on the redirect response, and the browser keeps the stale cookie —
  // leading to an infinite /login ↔ / redirect loop.
  const redirectWithCookies = (url: URL) => {
    const r = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => {
      r.cookies.set(cookie)
    })
    return r
  }

  // 1. Not authenticated + trying to reach a protected route → /login?next=
  if (!user && isProtectedPath(path)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', path)
    return redirectWithCookies(url)
  }

  // 2. Already authenticated + on /signup → send home.
  //    (The signup page's server component redirects customers, but not
  //     staff. Middleware catches both.)
  if (user && path === '/signup') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return redirectWithCookies(url)
  }

  // 3. Authenticated + on /login → let the page's server component
  //    handle role-based redirect (staff → /dashboard, customer → /shop).
  //    No middleware redirect needed.

  return response
}