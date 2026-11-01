'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentCustomer } from './actions'

type SubmitOrderInput = {
  payment_method: 'cod' | 'bank_transfer' | 'upi' | 'cash_at_pickup'
  shipping_address: {
    name: string
    phone: string
    email?: string
    line1: string
    line2?: string
    city: string
    state: string
    pincode: string
    country?: string
  }
  customer_notes?: string
}

type SubmitOrderResult =
  | {
      ok: true
      access_token: string
      order_id: string
      order_number?: string
      invoice_number?: string
    }
  | { ok: false; error: string }

export async function submitOrder(
  input: SubmitOrderInput,
): Promise<SubmitOrderResult> {
  try {
    const supabase = await createClient()

    const auth = await getCurrentCustomer()
    if (!auth?.customer) {
      return { ok: false, error: 'Please sign in to place an order' }
    }

    // 1. Find active cart
    const { data: cartRow, error: cartErr } = await supabase
      .from('carts')
      .select('id')
      .eq('customer_id', auth.customer.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cartErr || !cartRow) {
      console.error('[submitOrder] cart lookup failed:', cartErr)
      return {
        ok: false,
        error: 'No active cart found. Refresh the page and try again.',
      }
    }

    // 2. Read cart items (fresh, with fields the RPC needs)
    const { data: cartItems, error: itemsErr } = await supabase
      .from('cart_items')
      .select(
        'id, inventory_item_id, design_id, variant_id, quantity, fulfillment_type',
      )
      .eq('cart_id', cartRow.id)
      .order('added_at', { ascending: true })

    if (itemsErr) {
      console.error('[submitOrder] cart items read failed:', itemsErr)
      return {
        ok: false,
        error: 'Could not read your cart. Please try again.',
      }
    }
    if (!cartItems || cartItems.length === 0) {
      return { ok: false, error: 'Your cart is empty' }
    }

    // 3. GST: 3% domestic, 0% export
    const country = (input.shipping_address.country ?? 'India')
      .trim()
      .toLowerCase()
    const taxRate = country === 'india' || country === 'in' ? 3 : 0

    const items = cartItems.map((ci) => ({
      fulfillment_type: ci.fulfillment_type,
      inventory_item_id: ci.inventory_item_id,
      design_id: ci.design_id,
      variant_id: ci.variant_id,
      quantity: ci.quantity,
      tax_rate: taxRate,
    }))

    // 4. Single-arg RPC call
    const payload = {
      cart_id: cartRow.id,
      payment_method: input.payment_method,
      shipping_address: input.shipping_address,
      customer_notes: input.customer_notes ?? null,
      items,
    }

    const { data, error } = await supabase.rpc('rpc_submit_order', {
      p_payload: payload,
    })

    if (error) {
      console.error('[submitOrder] RPC error:', error)
      return {
        ok: false,
        error: error.message || 'Order could not be placed',
      }
    }

    // 5. Normalise response
    const result = Array.isArray(data) ? data[0] : data
    if (!result || typeof result !== 'object') {
      console.error('[submitOrder] unexpected RPC payload:', result)
      return {
        ok: false,
        error:
          'Order was created but the response is malformed. Contact support.',
      }
    }

    const r = result as Record<string, any>
    const token = r.access_token
    const orderId = r.order_id ?? r.id

    if (!token || !orderId) {
      console.error('[submitOrder] missing token/order_id:', r)
      return {
        ok: false,
        error:
          'Order was created but confirmation data is missing. Contact support.',
      }
    }

    return {
      ok: true,
      access_token: String(token),
      order_id: String(orderId),
      order_number: r.order_number,
      invoice_number: r.invoice_number,
    }
  } catch (err) {
    console.error('[submitOrder] threw:', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not place order',
    }
  }
}