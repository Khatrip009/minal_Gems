import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, ArrowRight } from 'lucide-react'
import { getCart } from '@/lib/storefront/cart'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { createClient } from '@/lib/supabase/server'
import { calculateCartPricing } from '@/lib/storefront/tax'
import { CartClient } from './cart-client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Cart · Minal Gems' }

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>
}) {
  const auth = await getCurrentCustomer()
  if (!auth) redirect('/login')

  const cart = await getCart()
  const params = await searchParams

  // Resolve shipping country, in order of precedence:
  //   1. ?country=… on the URL (explicit customer choice / testing)
  //   2. Customer's default address
  //   3. Fallback 'India'
  let defaultCountry: string | null = null
  if (auth.customer?.id) {
    const supabase = await createClient()
    const { data: addr } = await supabase
      .from('customer_addresses')
      .select('country')
      .eq('customer_id', auth.customer.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    defaultCountry = addr?.country ?? null
  }

  const shippingCountry =
    (params.country && params.country.trim()) || defaultCountry || 'India'

  // Pre-tax subtotal comes from cart; recompute GST + total for the
  // resolved country so international orders show zero GST.
  const pricing = calculateCartPricing(cart.subtotal, shippingCountry)

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-stone-300" />
        <h1 className="text-2xl font-semibold text-stone-900">
          Your cart is empty
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Browse our collections to find something special.
        </p>
        <Link
          href="/shop"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 text-sm font-semibold"
        >
          Browse Collections <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
        Your cart
      </h1>
      <p className="mt-1 text-sm text-stone-600">
        {cart.item_count} item{cart.item_count !== 1 ? 's' : ''}
      </p>
      <div className="mt-10">
        <CartClient cart={cart} pricing={pricing} />
      </div>
    </div>
  )
}