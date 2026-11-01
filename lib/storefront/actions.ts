'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getSessionInfo(): Promise<{
  user: { id: string; email?: string }
  profile: {
    id: string
    full_name: string
    role: string
    customer_id: string | null
  }
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, customer_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return null

  return {
    user: { id: user.id, email: user.email ?? undefined },
    profile,
  }
}
// ── Get current customer from auth ────────────────────────────────────
export async function getCurrentCustomer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, customer_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.customer_id) return null

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, phone, email, address, city, state, pincode, gstin')
    .eq('id', profile.customer_id)
    .maybeSingle()

  if (!customer) return null
  return { user, profile, customer }
}

// ── Cart count for header ─────────────────────────────────────────────
export async function getCartCount(): Promise<number> {
  const auth = await getCurrentCustomer()
  if (!auth) return 0

  const supabase = await createClient()
  const { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('customer_id', auth.customer.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!cart) return 0

  const { count } = await supabase
    .from('cart_items')
    .select('*', { count: 'exact', head: true })
    .eq('cart_id', cart.id)

  return count ?? 0
}

// ── Add to cart ────────────────────────────────────────────────────────
// Inside lib/storefront/actions.ts — replace the existing addToCart function

export async function addToCart(input: {
  fulfillment_type: 'in_stock' | 'made_to_order'
  inventory_item_id: string | null
  design_id: string
  variant_id: string | null
  unit_price: number
}): Promise<{ ok: true; cart_item_id: string } | { ok: false; error: string }> {
  const supabase = await createClient()

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('customer_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.customer_id) {
    return { ok: false, error: 'No customer linked to this account' }
  }

  // 2. Validate input per fulfilment type
  if (input.fulfillment_type === 'in_stock') {
    if (!input.inventory_item_id) {
      return { ok: false, error: 'Missing inventory item for in-stock cart' }
    }
  } else {
    if (!input.design_id) {
      return { ok: false, error: 'Missing design for made-to-order cart' }
    }
    if (!input.unit_price || input.unit_price <= 0) {
      return { ok: false, error: 'This piece has no price set' }
    }
  }

  // 3. Get or create the customer's active cart
  let cartId: string | null = null
  {
    const { data: existing } = await supabase
      .from('carts')
      .select('id')
      .eq('customer_id', profile.customer_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      cartId = existing.id
    } else {
      const { data: created, error: createErr } = await supabase
        .from('carts')
        .insert({ customer_id: profile.customer_id, status: 'active' })
        .select('id')
        .single()

      if (createErr || !created) {
        return { ok: false, error: createErr?.message ?? 'Could not create cart' }
      }
      cartId = created.id
    }
  }
  if (!cartId) return { ok: false, error: 'Cart unavailable' }

  // 4. Find an existing matching line (by fulfilment type + identifiers)
  let existingQuery = supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cartId)
    .eq('fulfillment_type', input.fulfillment_type)

  if (input.fulfillment_type === 'in_stock') {
    existingQuery = existingQuery.eq('inventory_item_id', input.inventory_item_id!)
  } else {
    existingQuery = existingQuery
      .eq('design_id', input.design_id)
      .is('inventory_item_id', null)
    if (input.variant_id) {
      existingQuery = existingQuery.eq('variant_id', input.variant_id)
    } else {
      existingQuery = existingQuery.is('variant_id', null)
    }
  }

  const { data: existingLine } = await existingQuery.maybeSingle()

  // 5. Update if exists, insert otherwise
  if (existingLine) {
    const { error: updErr } = await supabase
      .from('cart_items')
      .update({ quantity: existingLine.quantity + 1 })
      .eq('id', existingLine.id)

    if (updErr) return { ok: false, error: updErr.message }
    return { ok: true, cart_item_id: existingLine.id }
  }

  const { data: inserted, error: insErr } = await supabase
    .from('cart_items')
    .insert({
      cart_id: cartId,
      fulfillment_type: input.fulfillment_type,
      inventory_item_id: input.inventory_item_id,
      design_id: input.design_id,
      variant_id: input.variant_id,
      unit_price_snapshot: input.unit_price,
      quantity: 1,
    })
    .select('id')
    .single()

  if (insErr || !inserted) {
    return { ok: false, error: insErr?.message ?? 'Could not add to cart' }
  }

  return { ok: true, cart_item_id: inserted.id }
}