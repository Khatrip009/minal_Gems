'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const STAFF_ROLES = ['admin', 'manager', 'sales', 'accountant']

async function getStaffClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.is_active || !STAFF_ROLES.includes(profile.role)) {
    throw new Error('Not authorised')
  }
  return supabase
}

type Result<T = void> =
  | ({ ok: true } & (T extends void ? {} : T))
  | { ok: false; error: string }

// ── Confirm payment ────────────────────────────────────────────────
export async function confirmOnlinePayment(input: {
  order_id: string
  payment_method:
    | 'cash'
    | 'upi'
    | 'bank_transfer'
    | 'card'
    | 'cheque'
    | 'adjustment'
    | 'other'
  reference?: string
  notes?: string
}): Promise<
  Result<{ order_number: string; invoice_id: string | null }>
> {
  try {
    const supabase = await getStaffClient()
    const { data, error } = await supabase.rpc('rpc_confirm_online_payment', {
      p_order_id: input.order_id,
      p_payment_method: input.payment_method,
      p_reference: input.reference ?? null,
      p_notes: input.notes ?? null,
    })
    if (error) {
      console.error('[confirmOnlinePayment] RPC failed:', error)
      return { ok: false, error: error.message }
    }
    revalidatePath('/orders')
    revalidatePath(`/orders/${input.order_id}`)
    return {
      ok: true,
      order_number: (data as any)?.order_number ?? '',
      invoice_id: (data as any)?.invoice_id ?? null,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not confirm payment',
    }
  }
}

// ── Ship ───────────────────────────────────────────────────────────
export async function markOrderShipped(input: {
  order_id: string
  tracking_info?: string
}): Promise<Result> {
  try {
    const supabase = await getStaffClient()
    const { error } = await supabase.rpc('rpc_mark_order_shipped', {
      p_order_id: input.order_id,
      p_tracking_info: input.tracking_info ?? null,
    })
    if (error) {
      console.error('[markOrderShipped] RPC failed:', error)
      return { ok: false, error: error.message }
    }
    revalidatePath('/orders')
    revalidatePath(`/orders/${input.order_id}`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not mark as shipped',
    }
  }
}

// ── Deliver ────────────────────────────────────────────────────────
export async function markOrderDelivered(input: {
  order_id: string
}): Promise<Result> {
  try {
    const supabase = await getStaffClient()
    const { error } = await supabase.rpc('rpc_mark_order_delivered', {
      p_order_id: input.order_id,
    })
    if (error) {
      console.error('[markOrderDelivered] RPC failed:', error)
      return { ok: false, error: error.message }
    }
    revalidatePath('/orders')
    revalidatePath(`/orders/${input.order_id}`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not mark as delivered',
    }
  }
}

// ── Cancel ─────────────────────────────────────────────────────────
export async function cancelOnlineOrder(input: {
  order_id: string
  reason: string
  release_inventory?: boolean
}): Promise<Result> {
  try {
    if (!input.reason.trim()) {
      return { ok: false, error: 'Cancellation reason is required' }
    }
    const supabase = await getStaffClient()
    const { error } = await supabase.rpc('rpc_cancel_online_order', {
      p_order_id: input.order_id,
      p_reason: input.reason.trim(),
      p_release_inventory: input.release_inventory ?? true,
    })
    if (error) {
      console.error('[cancelOnlineOrder] RPC failed:', error)
      return { ok: false, error: error.message }
    }
    revalidatePath('/orders')
    revalidatePath(`/orders/${input.order_id}`)
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not cancel order',
    }
  }
}