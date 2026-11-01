import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCart } from '@/lib/storefront/cart'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { createClient } from '@/lib/supabase/server'
import { CheckoutClient } from './checkout-client'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Checkout · Minal Gems' }

export default async function CheckoutPage() {
  const auth = await getCurrentCustomer()
  if (!auth) redirect('/login')

  const cart = await getCart()
  if (cart.lines.length === 0) redirect('/cart')
  if (cart.has_unavailable) redirect('/cart')

  const supabase = await createClient()
  const { data: savedAddresses } = await supabase
    .from('customer_addresses')
    .select('id, label, name, phone, line1, line2, city, state, pincode, country, is_default')
    .eq('customer_id', auth.customer.id)
    .order('is_default', { ascending: false })

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link
        href="/cart"
        className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
      >
        <ChevronLeft className="h-4 w-4" /> Back to cart
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
        Checkout
      </h1>

      <div className="mt-10">
        <CheckoutClient
          cart={cart}
          customer={{
            name: auth.customer.name,
            phone: auth.customer.phone ?? '',
            email: auth.customer.email ?? '',
            address: auth.customer.address ?? '',
            city: auth.customer.city ?? '',
            state: auth.customer.state ?? '',
            pincode: auth.customer.pincode ?? '',
          }}
          savedAddresses={(savedAddresses ?? []) as any[]}
        />
      </div>
    </div>
  )
}