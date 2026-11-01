'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentCustomer } from './actions'

// ── Profile ──────────────────────────────────────────────────────────

export async function updateProfile(input: {
  full_name: string
  phone: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getCurrentCustomer()
  if (!auth) return { ok: false, error: 'Not signed in' }

  const name = input.full_name.trim()
  const phone = input.phone.trim()

  if (!name) return { ok: false, error: 'Name is required' }
  if (phone && !/^[+0-9 ()-]{6,20}$/.test(phone)) {
    return { ok: false, error: 'Phone looks invalid' }
  }

  const supabase = await createClient()

  const { error: cErr } = await supabase
    .from('customers')
    .update({ name, phone })
    .eq('id', auth.customer.id)

  if (cErr) {
    console.error('[updateProfile] customers update failed:', cErr)
    return { ok: false, error: cErr.message }
  }

  // Mirror into profiles for consistency across the app
  await supabase
    .from('profiles')
    .update({ full_name: name, phone })
    .eq('id', auth.user.id)

  revalidatePath('/account', 'layout')
  revalidatePath('/account/profile')
  return { ok: true }
}

export async function updatePassword(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters' }
  }
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Addresses ────────────────────────────────────────────────────────

export type AddressInput = {
  name: string
  phone: string
  line1: string
  line2?: string | null
  city: string
  state: string
  pincode: string
  country: string
  label?: string | null
  is_default?: boolean
}

export async function createAddress(
  input: AddressInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await getCurrentCustomer()
  if (!auth) return { ok: false, error: 'Not signed in' }

  const err = validateAddress(input)
  if (err) return { ok: false, error: err }

  const supabase = await createClient()

  if (input.is_default) {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', auth.customer.id)
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .insert({
      customer_id: auth.customer.id,
      name: input.name.trim(),
      phone: input.phone.trim(),
      line1: input.line1.trim(),
      line2: input.line2?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim(),
      pincode: input.pincode.trim(),
      country: input.country.trim() || 'India',
      label: input.label?.trim() || null,
      is_default: !!input.is_default,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[createAddress] failed:', error)
    return { ok: false, error: error?.message ?? 'Could not save address' }
  }

  revalidatePath('/account/addresses')
  revalidatePath('/account')
  return { ok: true, id: data.id }
}

export async function updateAddress(
  id: string,
  input: AddressInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getCurrentCustomer()
  if (!auth) return { ok: false, error: 'Not signed in' }

  const err = validateAddress(input)
  if (err) return { ok: false, error: err }

  const supabase = await createClient()

  if (input.is_default) {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', auth.customer.id)
      .neq('id', id)
  }

  const { error } = await supabase
    .from('customer_addresses')
    .update({
      name: input.name.trim(),
      phone: input.phone.trim(),
      line1: input.line1.trim(),
      line2: input.line2?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim(),
      pincode: input.pincode.trim(),
      country: input.country.trim() || 'India',
      label: input.label?.trim() || null,
      is_default: !!input.is_default,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('customer_id', auth.customer.id)

  if (error) {
    console.error('[updateAddress] failed:', error)
    return { ok: false, error: error.message }
  }

  revalidatePath('/account/addresses')
  revalidatePath('/account')
  return { ok: true }
}

export async function deleteAddress(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getCurrentCustomer()
  if (!auth) return { ok: false, error: 'Not signed in' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', id)
    .eq('customer_id', auth.customer.id)

  if (error) {
    console.error('[deleteAddress] failed:', error)
    return { ok: false, error: error.message }
  }

  revalidatePath('/account/addresses')
  return { ok: true }
}

export async function setDefaultAddress(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getCurrentCustomer()
  if (!auth) return { ok: false, error: 'Not signed in' }

  const supabase = await createClient()

  await supabase
    .from('customer_addresses')
    .update({ is_default: false })
    .eq('customer_id', auth.customer.id)

  const { error } = await supabase
    .from('customer_addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('customer_id', auth.customer.id)

  if (error) {
    console.error('[setDefaultAddress] failed:', error)
    return { ok: false, error: error.message }
  }

  revalidatePath('/account/addresses')
  return { ok: true }
}

// ── Auth ─────────────────────────────────────────────────────────────

export async function logoutCustomer() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

// ── Helpers ──────────────────────────────────────────────────────────

function validateAddress(input: AddressInput): string | null {
  if (!input.name.trim()) return 'Name is required'
  if (!input.phone.trim()) return 'Phone is required'
  if (!input.line1.trim()) return 'Address line 1 is required'
  if (!input.city.trim()) return 'City is required'
  if (!input.state.trim()) return 'State is required'
  if (!input.pincode.trim()) return 'Pincode is required'
  if (!input.country.trim()) return 'Country is required'
  return null
}