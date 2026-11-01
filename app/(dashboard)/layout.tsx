// app/(dashboard)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard-shell'
import { Toaster } from '@/components/ui/sonner'
import type { Role } from '@/lib/roles'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware is the source of truth — this is just defence-in-depth.
  if (!user) redirect('/login')

  const [{ data: role }, { data: profile }] = await Promise.all([
    supabase.rpc('current_user_role'),
    supabase
      .from('profiles')
      .select('full_name, is_active')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  // Cannot clear cookies from a Server Component → hand off to a route handler.
  if (!profile) redirect('/auth/signout?reason=no-profile')
  if (!profile.is_active) redirect('/auth/signout?reason=inactive')

  return (
    <>
      <DashboardShell
        role={(role as Role) ?? null}
        email={user.email ?? ''}
        fullName={profile.full_name ?? ''}
      >
        {children}
      </DashboardShell>
      <Toaster position="top-right" richColors closeButton />
    </>
  )
}