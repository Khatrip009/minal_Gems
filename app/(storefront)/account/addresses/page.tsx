import Link from 'next/link'
import { MapPin, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { AddressList } from './address-list'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Addresses · Minal Gems' }

export default async function AddressesPage() {
  const auth = await getCurrentCustomer()
  if (!auth) return null

  const supabase = await createClient()
  const { data: addresses } = await supabase
    .from('customer_addresses')
    .select(
      'id, label, name, phone, line1, line2, city, state, pincode, country, is_default',
    )
    .eq('customer_id', auth.customer.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  const rows = addresses ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-stone-900">
          Saved addresses
        </h2>
        <Link
          href="/account/addresses/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Add address
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-12 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-stone-300" />
          <p className="text-base font-medium text-stone-900">
            No saved addresses
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Add one now or save one during checkout.
          </p>
        </div>
      ) : (
        <AddressList addresses={rows} />
      )}
    </div>
  )
}