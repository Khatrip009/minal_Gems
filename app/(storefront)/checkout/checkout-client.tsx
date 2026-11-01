'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { fmtINR } from '@/lib/storefront/format'
import type { Cart } from '@/lib/storefront/cart'
import { submitOrder } from '@/lib/storefront/checkout'
import { calculateCartPricing } from '@/lib/storefront/tax'

type SavedAddress = {
  id: string
  label: string | null
  name: string
  phone: string
  line1: string
  line2: string | null
  city: string
  state: string
  pincode: string
  country: string
  is_default: boolean
}

const COMMON_COUNTRIES = [
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

const PAYMENT_OPTIONS = [
  {
    value: 'cod',
    label: 'Cash on Delivery',
    hint: 'Available for orders up to ₹50,000',
  },
  {
    value: 'bank_transfer',
    label: 'Bank Transfer',
    hint: 'Our team shares account details after order',
  },
  {
    value: 'upi',
    label: 'UPI',
    hint: 'Pay via UPI — details shared after order',
  },
  {
    value: 'cash_at_pickup',
    label: 'Pay at Showroom',
    hint: 'Collect and pay at our Surat showroom',
  },
] as const

type PaymentMethod = (typeof PAYMENT_OPTIONS)[number]['value']

export function CheckoutClient({
  cart,
  customer,
  savedAddresses,
}: {
  cart: Cart
  customer: {
    name: string
    phone: string
    email: string
    address: string
    city: string
    state: string
    pincode: string
  }
  savedAddresses: SavedAddress[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [selectedAddressId, setSelectedAddressId] = useState<string | 'new'>(
    savedAddresses.find((a) => a.is_default)?.id ??
      savedAddresses[0]?.id ??
      'new',
  )

  const initialAddress =
    selectedAddressId !== 'new'
      ? savedAddresses.find((a) => a.id === selectedAddressId)
      : null

  const [form, setForm] = useState({
    name: initialAddress?.name ?? customer.name,
    phone: initialAddress?.phone ?? customer.phone,
    email: customer.email,
    line1: initialAddress?.line1 ?? customer.address,
    line2: initialAddress?.line2 ?? '',
    city: initialAddress?.city ?? customer.city,
    state: initialAddress?.state ?? customer.state,
    pincode: initialAddress?.pincode ?? customer.pincode,
    country: initialAddress?.country ?? 'India',
    notes: '',
    payment_method: 'cod' as PaymentMethod,
  })

  // Live GST + total based on the country the customer will ship to
  const pricing = calculateCartPricing(cart.subtotal, form.country)

  function applySavedAddress(id: string) {
    setSelectedAddressId(id)
    if (id === 'new') return
    const a = savedAddresses.find((x) => x.id === id)
    if (!a) return
    setForm((f) => ({
      ...f,
      name: a.name,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 ?? '',
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      country: a.country || 'India',
    }))
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (
      !form.name.trim() ||
      !form.phone.trim() ||
      !form.line1.trim() ||
      !form.city.trim() ||
      !form.state.trim() ||
      !form.pincode.trim()
    ) {
      const msg = 'Please fill in all required address fields'
      toast.error(msg)
      setSubmitError(msg)
      return
    }

    startTransition(async () => {
      try {
        const res = await submitOrder({
          payment_method: form.payment_method,
          shipping_address: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim() || undefined,
            line1: form.line1.trim(),
            line2: form.line2.trim() || undefined,
            city: form.city.trim(),
            state: form.state.trim(),
            pincode: form.pincode.trim(),
            country: form.country,
          },
          customer_notes: form.notes.trim() || undefined,
        })

        if (!res.ok) {
          console.error('[checkout] submitOrder returned error:', res.error)
          toast.error(res.error)
          setSubmitError(res.error)
          return
        }

        toast.success('Order placed!')
        router.push(`/order/${res.access_token}`)
        router.refresh()
      } catch (err) {
        // Shouldn't happen — action catches its own errors — but be safe
        console.error('[checkout] submitOrder threw:', err)
        const msg =
          err instanceof Error ? err.message : 'Could not place order'
        toast.error(msg)
        setSubmitError(msg)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 lg:grid-cols-3 gap-10"
    >
      <div className="lg:col-span-2 space-y-8">
        {/* Address */}
        <section className="rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="text-sm uppercase tracking-widest text-stone-500 font-semibold">
            Shipping address
          </h2>

          {savedAddresses.length > 0 && (
            <div className="mt-4 space-y-2">
              {savedAddresses.map((a) => (
                <label
                  key={a.id}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                    selectedAddressId === a.id
                      ? 'border-stone-900 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={selectedAddressId === a.id}
                    onChange={() => applySavedAddress(a.id)}
                    className="mt-1"
                  />
                  <div className="text-sm">
                    <p className="font-medium text-stone-900">
                      {a.name}{' '}
                      {a.label && (
                        <span className="text-xs uppercase tracking-wider text-stone-500 ml-2">
                          {a.label}
                        </span>
                      )}
                    </p>
                    <p className="text-stone-600">
                      {a.line1}, {a.city}, {a.state} — {a.pincode}
                    </p>
                    <p className="text-stone-500 text-xs mt-0.5">
                      {a.phone} · {a.country}
                    </p>
                  </div>
                </label>
              ))}
              <label
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                  selectedAddressId === 'new'
                    ? 'border-stone-900 bg-stone-50'
                    : 'border-stone-200 hover:border-stone-400'
                }`}
              >
                <input
                  type="radio"
                  name="address"
                  checked={selectedAddressId === 'new'}
                  onChange={() => applySavedAddress('new')}
                  className="mt-1"
                />
                <span className="text-sm font-medium text-stone-900">
                  Use a different address
                </span>
              </label>
            </div>
          )}

          {selectedAddressId === 'new' && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field
                label="Full name *"
                value={form.name}
                onChange={(v) => set('name', v)}
              />
              <Field
                label="Phone *"
                value={form.phone}
                onChange={(v) => set('phone', v)}
              />
              <div className="col-span-2">
                <Field
                  label="Email"
                  value={form.email}
                  onChange={(v) => set('email', v)}
                  type="email"
                />
              </div>
              <div className="col-span-2">
                <Field
                  label="Address line 1 *"
                  value={form.line1}
                  onChange={(v) => set('line1', v)}
                />
              </div>
              <div className="col-span-2">
                <Field
                  label="Address line 2"
                  value={form.line2}
                  onChange={(v) => set('line2', v)}
                />
              </div>
              <Field
                label="City *"
                value={form.city}
                onChange={(v) => set('city', v)}
              />
              <Field
                label="State *"
                value={form.state}
                onChange={(v) => set('state', v)}
              />
              <Field
                label="Pincode *"
                value={form.pincode}
                onChange={(v) => set('pincode', v)}
              />
              <label className="block">
                <span className="text-xs font-medium text-stone-600">
                  Country *
                </span>
                <select
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                >
                  {!COMMON_COUNTRIES.includes(form.country) && (
                    <option value={form.country}>{form.country}</option>
                  )}
                  {COMMON_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>

        {/* Payment */}
        <section className="rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="text-sm uppercase tracking-widest text-stone-500 font-semibold">
            Payment method
          </h2>
          <div className="mt-4 space-y-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                  form.payment_method === opt.value
                    ? 'border-stone-900 bg-stone-50'
                    : 'border-stone-200 hover:border-stone-400'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={form.payment_method === opt.value}
                  onChange={() => set('payment_method', opt.value)}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {opt.label}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {opt.hint}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Notes */}
        <section className="rounded-lg border border-stone-200 bg-white p-6">
          <h2 className="text-sm uppercase tracking-widest text-stone-500 font-semibold">
            Order notes (optional)
          </h2>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="Gift message, delivery instructions, or special requests…"
            className="mt-3 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          />
        </section>
      </div>

      {/* Summary */}
      <aside className="rounded-lg border border-stone-200 bg-white p-6 h-fit lg:sticky lg:top-24">
        <h2 className="text-sm uppercase tracking-widest text-stone-500 font-semibold">
          Order summary
        </h2>
        <ul className="mt-4 space-y-3 text-sm border-b border-stone-200 pb-4">
          {cart.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-2">
              <span className="text-stone-700 truncate">
                {l.title}{' '}
                <span className="text-stone-400">× {l.quantity}</span>
              </span>
              <span className="tabular-nums text-stone-900 shrink-0">
                {fmtINR(l.unit_price * l.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-600">Subtotal</dt>
            <dd className="tabular-nums">{fmtINR(pricing.subtotal)}</dd>
          </div>
          {pricing.gst.applicable ? (
            <div className="flex justify-between">
              <dt className="text-stone-600">
                GST ({pricing.gst.ratePercent}%)
              </dt>
              <dd className="tabular-nums">
                {fmtINR(pricing.gst.amount)}
              </dd>
            </div>
          ) : (
            <div className="flex justify-between">
              <dt className="text-stone-600">GST</dt>
              <dd className="text-xs text-stone-500 italic self-center">
                Not applicable · export
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-stone-200 pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{fmtINR(pricing.total)}</dd>
          </div>
        </dl>

        {submitError && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <p className="font-medium">Could not place order</p>
            <p className="mt-1 break-words">{submitError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Placing order…
            </>
          ) : (
            'Place Order'
          )}
        </button>

        <p className="mt-3 text-[11px] text-stone-500 leading-relaxed flex items-start gap-1.5">
          <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
          By placing this order you agree to our terms. Order will be
          confirmed once payment is received.
        </p>
      </aside>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
      />
    </label>
  )
}