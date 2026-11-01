import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Role } from './roles'

export async function requireRole(allowed: Role[]) {
  const supabase = await createClient()

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (process.env.NODE_ENV !== 'production') {
    console.log('[requireRole]', {
      userId: user.id,
      email: user.email,
      profile,
      profileErr: profileErr?.message,
      allowed,
    })
  }

  if (profileErr || !profile || !profile.is_active) {
    redirect('/login?reason=no-profile')
  }

  if (!allowed.includes(profile.role as Role)) {
    redirect('/403')
  }

  return { supabase, role: profile.role as Role }
}