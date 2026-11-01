import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { AddressForm } from '../../address-form'

export const dynamic = 'force-dynamic'

export default async function EditAddressPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const auth = await getCurrentCustomer()
  if (!auth) return null

  const supabase = await createClient()
  const { data: address } = await supabase
    .from('customer_addresses')
    .select(
      'id, name, phone, line1, line2, city, state, pincode, country, label, is_default',
    )
    .eq('id', id)
    .eq('customer_id', auth.customer.id)
    .maybeSingle()

  if (!address) notFound()

  return (
    <AddressForm
      addressId={address.id}
      initial={{
        name: address.name,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country,
        label: address.label,
        is_default: address.is_default,
      }}
    />
  )
}