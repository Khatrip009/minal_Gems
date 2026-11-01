'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentCustomer } from './actions'
import { resolveAssetUrl } from '@/lib/storage-client'

export type CartLine = {
  id: string
  fulfillment_type: 'in_stock' | 'made_to_order'
  quantity: number
  unit_price: number
  unit_price_snapshot: number
  price_changed: boolean
  is_available: boolean

  title: string
  subtitle: string | null
  image_url: string | null
  href: string

  inventory_item_id: string | null
  design_id: string | null
  variant_id: string | null
  metal_purity_code: string | null
}

export type Cart = {
  cart_id: string | null
  lines: CartLine[]
  subtotal: number
  tax_total: number
  total: number
  item_count: number
  has_unavailable: boolean
  has_price_changes: boolean
}

const EMPTY_CART: Cart = {
  cart_id: null, lines: [], subtotal: 0, tax_total: 0, total: 0,
  item_count: 0, has_unavailable: false, has_price_changes: false,
}

export async function getCart(): Promise<Cart> {
  const auth = await getCurrentCustomer()
  if (!auth) return EMPTY_CART

  const supabase = await createClient()

  const { data: cart } = await supabase
    .from('carts')
    .select('id')
    .eq('customer_id', auth.customer.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!cart) return EMPTY_CART

  const { data: items } = await supabase
    .from('cart_items')
    .select(`
      id, quantity, unit_price_snapshot, fulfillment_type,
      inventory_item_id, design_id, variant_id, added_at,
      inventory_items!inventory_item_id (
        id, inventory_tag, floor_price, status,
        net_metal_weight_g, stone_carat_total, stone_pcs_total,
        metal_purities(code),
        product_variants(design_id, product_designs(id, name, slug, categories(slug),
          product_assets(url, is_primary, sort_order, asset_type)))
      ),
      product_designs!design_id (
        id, name, slug, design_code,
        categories(slug),
        product_assets(url, is_primary, sort_order, asset_type)
      ),
      product_variants!variant_id (
        id, sku, size_code, default_price,
        metal_purities(code)
      )
    `)
    .eq('cart_id', cart.id)
    .order('added_at', { ascending: true })

  const lines: CartLine[] = []
  let subtotal = 0
  let tax_total = 0
  let has_unavailable = false
  let has_price_changes = false

  for (const it of (items ?? []) as any[]) {
    if (it.fulfillment_type === 'in_stock' && it.inventory_items) {
      const inv = it.inventory_items
      const current_price = Number(inv.floor_price ?? 0)
      const is_available = inv.status === 'available' && current_price > 0
      const price_changed =
        Number(it.unit_price_snapshot) > 0 &&
        Math.abs(Number(it.unit_price_snapshot) - current_price) > 0.01

      if (!is_available) has_unavailable = true
      if (price_changed) has_price_changes = true

      const design = inv.product_variants?.product_designs
      const assets = (design?.product_assets ?? [])
        .filter((a: any) => a.asset_type === 'image')
        .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      const catSlug = design?.categories?.slug ?? 'all'

      const line_total = current_price * it.quantity
      const line_tax = ROUND(line_total * 0.03, 2)
      if (is_available) {
        subtotal += line_total
        tax_total += line_tax
      }

      lines.push({
        id: it.id,
        fulfillment_type: 'in_stock',
        quantity: it.quantity,
        unit_price: current_price,
        unit_price_snapshot: Number(it.unit_price_snapshot ?? 0),
        price_changed,
        is_available,
        title: design?.name ?? inv.inventory_tag,
        subtitle: [inv.metal_purities?.code, inv.inventory_tag]
          .filter(Boolean).join(' · '),
        image_url: assets[0] ? resolveAssetUrl(assets[0].url) : null,
        href: design?.slug
          ? `/shop/${catSlug}/${design.slug}`
          : `/shop`,
        inventory_item_id: inv.id,
        design_id: design?.id ?? null,
        variant_id: inv.product_variants?.design_id ? null : null,
        metal_purity_code: inv.metal_purities?.code ?? null,
      })
    } else if (it.fulfillment_type === 'made_to_order' && it.product_designs) {
      const design = it.product_designs
      const variant = it.product_variants
      const current_price = Number(variant?.default_price ?? 0)
      const is_available = current_price > 0
      const price_changed =
        Number(it.unit_price_snapshot) > 0 &&
        Math.abs(Number(it.unit_price_snapshot) - current_price) > 0.01

      if (!is_available) has_unavailable = true
      if (price_changed) has_price_changes = true

      const assets = (design.product_assets ?? [])
        .filter((a: any) => a.asset_type === 'image')
        .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      const catSlug = design.categories?.slug ?? 'all'

      const line_total = current_price * it.quantity
      const line_tax = ROUND(line_total * 0.03, 2)
      if (is_available) {
        subtotal += line_total
        tax_total += line_tax
      }

      lines.push({
        id: it.id,
        fulfillment_type: 'made_to_order',
        quantity: it.quantity,
        unit_price: current_price,
        unit_price_snapshot: Number(it.unit_price_snapshot ?? 0),
        price_changed,
        is_available,
        title: design.name,
        subtitle: [
          variant?.metal_purities?.code,
          variant?.size_code ? `Size ${variant.size_code}` : null,
          'Made to order',
        ].filter(Boolean).join(' · '),
        image_url: assets[0] ? resolveAssetUrl(assets[0].url) : null,
        href: `/shop/${catSlug}/${design.slug}`,
        inventory_item_id: null,
        design_id: design.id,
        variant_id: variant?.id ?? null,
        metal_purity_code: variant?.metal_purities?.code ?? null,
      })
    }
  }

  const total = subtotal + tax_total
  const item_count = lines.reduce((n, l) => n + l.quantity, 0)

  return {
    cart_id: cart.id,
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    tax_total: Math.round(tax_total * 100) / 100,
    total: Math.round(total * 100) / 100,
    item_count,
    has_unavailable,
    has_price_changes,
  }
}

// Helper kept local — keep it inline so the server file is self-contained
function ROUND(n: number, d: number): number {
  const f = Math.pow(10, d)
  return Math.round(n * f) / f
}

// ── Mutation actions ───────────────────────────────────────────────────
export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number
): Promise<{ ok: boolean; error?: string }> {
  const auth = await getCurrentCustomer()
  if (!auth) return { ok: false, error: 'Please sign in' }
  if (quantity < 1 || quantity > 10) return { ok: false, error: 'Invalid quantity' }

  const supabase = await createClient()

  // Verify the cart item belongs to this customer (belt and suspenders — RLS
  // should block anyway, but explicit check gives cleaner error messages)
  const { data: item } = await supabase
    .from('cart_items')
    .select('id, cart_id, carts!inner(customer_id)')
    .eq('id', cartItemId)
    .maybeSingle()

  if (!item || (item as any).carts.customer_id !== auth.customer.id) {
    return { ok: false, error: 'Cart item not found' }
  }

  const { error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', cartItemId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function removeCartItem(
  cartItemId: string
): Promise<{ ok: boolean; error?: string }> {
  const auth = await getCurrentCustomer()
  if (!auth) return { ok: false, error: 'Please sign in' }

  const supabase = await createClient()

  const { data: item } = await supabase
    .from('cart_items')
    .select('id, cart_id, carts!inner(customer_id)')
    .eq('id', cartItemId)
    .maybeSingle()

  if (!item || (item as any).carts.customer_id !== auth.customer.id) {
    return { ok: false, error: 'Cart item not found' }
  }

  const { error } = await supabase.from('cart_items').delete().eq('id', cartItemId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}