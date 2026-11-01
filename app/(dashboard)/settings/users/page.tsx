import { requireRole } from '@/lib/guard'
import { UsersClient } from './users-client'

export const dynamic = 'force-dynamic'

export default async function UsersSettingsPage() {
  const { supabase } = await requireRole(['admin', 'manager'])

  const [{ data: profiles, error: profilesErr }, { data: craftsmen }, { data: invites }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, is_active, craftsman_id, last_sign_in_at, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('craftsmen')
        .select('id, code, name, is_active')
        .eq('is_active', true)
        .order('code'),
      supabase
        .from('user_invites')
        .select('id, email, full_name, phone, role, craftsman_id, status, invited_at, accepted_at, invited_by')
        .eq('status', 'pending')
        .order('invited_at', { ascending: false }),
    ])

  if (profilesErr) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        Failed to load users: {profilesErr.message}
      </div>
    )
  }

  return (
    <UsersClient
      initialProfiles={(profiles ?? []) as any}
      craftsmen={(craftsmen ?? []) as any}
      initialInvites={(invites ?? []) as any}
    />
  )
}