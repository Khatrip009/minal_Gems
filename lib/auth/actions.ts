'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signupAction(input: {
  full_name: string
  email: string
  phone: string
  password: string
}): Promise<
  { ok: true; needsConfirmation: boolean } | { ok: false; error: string }
> {
  if (!input.email.includes('@')) return { ok: false, error: 'Invalid email' }
  if (input.password.length < 6)
    return { ok: false, error: 'Password must be at least 6 characters' }
  if (!input.full_name.trim()) return { ok: false, error: 'Enter your name' }
  if (!input.phone.trim()) return { ok: false, error: 'Enter your phone' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.full_name.trim(),
        phone: input.phone.trim(),
      },
    },
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, needsConfirmation: !data.session }
}

export async function loginAction(input: {
  email: string
  password: string
}): Promise<{ ok: true; role: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  })

  if (error) return { ok: false, error: error.message }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) {
    await supabase.auth.signOut()
    return {
      ok: false,
      error: 'Account missing profile. Please contact support.',
    }
  }

  return { ok: true, role: profile.role }
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}