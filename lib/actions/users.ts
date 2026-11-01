'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

const STAFF_ROLES = [
  'admin',
  'manager',
  'sales',
  'accountant',
  'viewer',
  'craftsman',
  'karigar',
] as const
type StaffRole = (typeof STAFF_ROLES)[number]

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) throw new Error('Account inactive')
  if (!['admin', 'manager'].includes(profile.role)) {
    throw new Error('Insufficient permissions')
  }
  return { user, role: profile.role as string }
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local to enable user invitations.',
    )
  }
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ────────────────────────────────────────────────────────────────
// inviteUser — sends Supabase auth invite email + creates profile
// ────────────────────────────────────────────────────────────────
export async function inviteUser(input: {
  email: string
  full_name: string
  phone?: string | null
  role: StaffRole
  craftsman_id?: string | null
  notes?: string | null
}): Promise<{ success?: true; error?: string }> {
  try {
    const { user: caller, role: callerRole } = await requireAdmin()

    const email = input.email.trim().toLowerCase()
    const fullName = input.full_name.trim()
    if (!email) return { error: 'Email is required' }
    if (!fullName) return { error: 'Full name is required' }
    if (!STAFF_ROLES.includes(input.role)) return { error: 'Invalid role' }

    // Only admins can create another admin
    if (input.role === 'admin' && callerRole !== 'admin') {
      return { error: 'Only admins can invite another admin' }
    }

    // Craftsman / karigar must have a craftsman record linked
    if (
      (input.role === 'craftsman' || input.role === 'karigar') &&
      !input.craftsman_id
    ) {
      return { error: 'Craftsman role requires a linked craftsman record' }
    }

    const admin = getAdminClient()

    // 1. Send the invite
    const { data: inviteData, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, role: input.role },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/settings/users`,
      })

    if (inviteErr) {
      console.error('[inviteUser] auth invite failed:', inviteErr)
      // Friendly messages for the two most common failures
      if (inviteErr.message.includes('already registered')) {
        return { error: 'This email is already registered. Use "Edit" on the existing user instead.' }
      }
      return { error: inviteErr.message }
    }

    const authUserId = inviteData.user.id

    // 2. Upsert the profile with the correct role + craftsman link
    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: authUserId,
        full_name: fullName,
        phone: input.phone?.trim() || null,
        email,
        role: input.role,
        is_active: true,
        craftsman_id:
          input.role === 'craftsman' || input.role === 'karigar'
            ? input.craftsman_id ?? null
            : null,
      },
      { onConflict: 'id' },
    )

    if (profileErr) {
      console.error('[inviteUser] profile upsert failed:', profileErr)
      return {
        error: `Invite sent but profile creation failed: ${profileErr.message}. The user may need manual setup.`,
      }
    }

    // 3. Record the invite for audit
    await admin.from('user_invites').insert({
      email,
      full_name: fullName,
      phone: input.phone?.trim() || null,
      role: input.role,
      craftsman_id: input.craftsman_id ?? null,
      auth_user_id: authUserId,
      status: 'pending',
      invited_by: caller.id,
      notes: input.notes?.trim() || null,
    })

    revalidatePath('/settings/users')
    return { success: true }
  } catch (err: any) {
    console.error('[inviteUser] failed:', err)
    return { error: err?.message ?? 'Something went wrong' }
  }
}

// ────────────────────────────────────────────────────────────────
// updateUser — change role, name, phone, active status, craftsman link
// ────────────────────────────────────────────────────────────────
export async function updateUser(input: {
  userId: string
  full_name: string
  phone?: string | null
  role: StaffRole
  is_active: boolean
  craftsman_id?: string | null
}): Promise<{ success?: true; error?: string }> {
  try {
    const { user: caller, role: callerRole } = await requireAdmin()

    if (!STAFF_ROLES.includes(input.role)) return { error: 'Invalid role' }

    const admin = getAdminClient()

    // Fetch target user's current role
    const { data: target } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', input.userId)
      .single()

    if (!target) return { error: 'User not found' }

    // Guardrail: only admins can promote/demote admins
    if (
      (target.role === 'admin' || input.role === 'admin') &&
      callerRole !== 'admin'
    ) {
      return { error: 'Only admins can change admin roles' }
    }

    // Guardrail: can't demote/deactivate yourself if you're the last admin
    if (target.role === 'admin' && (input.role !== 'admin' || !input.is_active)) {
      const { count } = await admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true)

      if ((count ?? 0) <= 1) {
        return { error: 'Cannot demote or deactivate the last active admin' }
      }
    }

    // Guardrail: can't deactivate yourself
    if (input.userId === caller.id && !input.is_active) {
      return { error: 'You cannot deactivate your own account' }
    }

    // Require craftsman link for craftsman roles
    if (
      (input.role === 'craftsman' || input.role === 'karigar') &&
      !input.craftsman_id
    ) {
      return { error: 'Craftsman role requires a linked craftsman record' }
    }

    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        full_name: input.full_name.trim(),
        phone: input.phone?.trim() || null,
        role: input.role,
        is_active: input.is_active,
        craftsman_id:
          input.role === 'craftsman' || input.role === 'karigar'
            ? input.craftsman_id ?? null
            : null,
      })
      .eq('id', input.userId)

    if (updateErr) return { error: updateErr.message }

    // If deactivating, revoke their auth session so they can't stay signed in
    if (!input.is_active) {
      try {
        await admin.auth.admin.signOut(input.userId, 'global')
      } catch {
        /* non-fatal */
      }
    }

    revalidatePath('/settings/users')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message ?? 'Something went wrong' }
  }
}

// ────────────────────────────────────────────────────────────────
// resendInvite — regenerates and re-sends the invite link
// ────────────────────────────────────────────────────────────────
export async function resendInvite(
  inviteId: string,
): Promise<{ success?: true; error?: string }> {
  try {
    await requireAdmin()
    const admin = getAdminClient()

    const { data: invite } = await admin
      .from('user_invites')
      .select('email, full_name, role, status')
      .eq('id', inviteId)
      .single()

    if (!invite) return { error: 'Invite not found' }
    if (invite.status === 'accepted') {
      return { error: 'Invite already accepted — user can use password reset instead' }
    }

    const { error } = await admin.auth.admin.inviteUserByEmail(invite.email, {
      data: { full_name: invite.full_name, role: invite.role },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/settings/users`,
    })

    if (error) {
      // If user already exists in auth but never completed signup,
      // generate a fresh invite-style link instead
      if (error.message.toLowerCase().includes('already')) {
        const { error: linkErr } = await admin.auth.admin.generateLink({
          type: 'invite',
          email: invite.email,
        })
        if (linkErr) return { error: linkErr.message }
        revalidatePath('/settings/users')
        return { success: true }
      }
      return { error: error.message }
    }

    await admin
      .from('user_invites')
      .update({ invited_at: new Date().toISOString(), status: 'pending' })
      .eq('id', inviteId)

    revalidatePath('/settings/users')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message ?? 'Something went wrong' }
  }
}

// ────────────────────────────────────────────────────────────────
// cancelInvite
// ────────────────────────────────────────────────────────────────
export async function cancelInvite(
  inviteId: string,
): Promise<{ success?: true; error?: string }> {
  try {
    await requireAdmin()
    const admin = getAdminClient()

    const { data: invite } = await admin
      .from('user_invites')
      .select('auth_user_id, status')
      .eq('id', inviteId)
      .single()

    if (!invite) return { error: 'Invite not found' }
    if (invite.status === 'accepted') {
      return { error: 'Cannot cancel an accepted invite' }
    }

    // Delete the pending auth user (never signed in yet)
    if (invite.auth_user_id) {
      try {
        await admin.auth.admin.deleteUser(invite.auth_user_id)
      } catch {
        /* non-fatal — profile may still need cleanup */
      }
      await admin.from('profiles').delete().eq('id', invite.auth_user_id)
    }

    await admin
      .from('user_invites')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', inviteId)

    revalidatePath('/settings/users')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message ?? 'Something went wrong' }
  }
}