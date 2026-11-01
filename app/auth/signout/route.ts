// app/auth/signout/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Route handlers CAN set/delete cookies, so signOut() actually works here.
// The path is under /auth, which lib/supabase/middleware.ts treats as public.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const reason = request.nextUrl.searchParams.get('reason') ?? 'signed-out'
  return NextResponse.redirect(new URL(`/login?reason=${encodeURIComponent(reason)}`, request.url))
}