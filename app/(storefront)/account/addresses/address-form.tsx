'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  createAddress,
  updateAddress,
  type AddressInput,
} from '@/lib/storefront/account'

const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'United Arab Emirates',
  'Singapore',
  'Australia',
  'Canada',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
]

export function AddressForm({
  addressId,
  initial,
}: {
  addressId?: string
  initial?: Partial<AddressInput>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<AddressInput>({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    pincode: initial?.pincode ?? '',
    country: initial?.country ?? 'India',
    label: initial?.label ?? '',
    is_default: initial?.is_default ?? false,
  })

  function set<K extends keyof AddressInput>(k: K, v: AddressInput[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    startTransition(async () => {
      try {
        const res = addressId
          ? await updateAddress(addressId, form)
          : await createAddress(form)

        if (!res.ok) {
          toast.error(res.error)
          return
        }

        toast.success(addressId ? 'Address updated' : 'Address saved')
        router.push('/account/addresses')
        router.refresh()
      } catch (err) {
        console.error('[address-form] failed:', err)
        toast.error(err instanceof Error ? err.message : 'Could not save')
      }
    })
  }

  return (
    <div>
      <Link
        href="/account/addresses"
        className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
      >
        <ChevronLeft className="h-4 w-4" /> Back to addresses
      </Link>

      <h2 className="mt-4 text-xl font-semibold text-stone-900">
        {addressId ? 'Edit address' : 'Add new address'}
      </h2>

      <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              Full name *
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              Phone *
            </span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="col-span-2 block">
            <span className="text-xs font-medium text-stone-600">
              Address line 1 *
            </span>
            <input
              type="text"
              value={form.line1}
              onChange={(e) => set('line1', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="col-span-2 block">
            <span className="text-xs font-medium text-stone-600">
              Address line 2
            </span>
            <input
              type="text"
              value={form.line2 ?? ''}
              onChange={(e) => set('line2', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">City *</span>
            <input
              type="text"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">State *</span>
            <input
              type="text"
              value={form.state}
              onChange={(e) => set('state', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              Pincode *
            </span>
            <input
              type="text"
              value={form.pincode}
              onChange={(e) => set('pincode', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-stone-600">
              Country *
            </span>
            <select
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              {!COUNTRIES.includes(form.country) && (
                <option value={form.country}>{form.country}</option>
              )}
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="col-span-2 block">
            <span className="text-xs font-medium text-stone-600">
              Label (optional)
            </span>
            <input
              type="text"
              value={form.label ?? ''}
              onChange={(e) => set('label', e.target.value)}
              placeholder="Home, Office, Parents' place…"
              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.is_default}
              onChange={(e) => set('is_default', e.target.checked)}
            />
            <span className="text-sm text-stone-700">
              Set as default shipping address
            </span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending
              ? 'Saving…'
              : addressId
                ? 'Save changes'
                : 'Add address'}
          </button>
          <Link
            href="/account/addresses"
            className="inline-flex items-center rounded-full border border-stone-300 hover:border-stone-500 px-6 py-2.5 text-sm font-medium text-stone-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}