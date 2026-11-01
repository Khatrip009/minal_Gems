'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Minus, Plus, X, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { fmtINR } from '@/lib/storefront/format'
import {
  removeCartItem,
  updateCartItemQuantity,
  type Cart,
} from '@/lib/storefront/cart'
import type { CartPricing } from '@/lib/storefront/tax'

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

export function CartClient({
  cart,
  pricing,
}: {
  cart: Cart
  pricing: CartPricing
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  function changeQty(itemId: string, qty: number) {
    if (qty < 1) return
    setBusyId(itemId)
    startTransition(async () => {
      const res = await updateCartItemQuantity(itemId, qty)
      setBusyId(null)
      if (!res.ok) toast.error(res.error ?? 'Update failed')
      else router.refresh()
    })
  }

  function remove(itemId: string) {
    setBusyId(itemId)
    startTransition(async () => {
      const res = await removeCartItem(itemId)
      setBusyId(null)
      if (!res.ok) toast.error(res.error ?? 'Remove failed')
      else {
        toast.success('Removed')
        router.refresh()
      }
    })
  }

  function changeCountry(next: string) {
    if (next === pricing.shippingCountry) return
    router.push(`/cart?country=${encodeURIComponent(next)}`)
  }

  // Whether the currently selected country appears in the preset list.
  // If not (e.g. a customer's default address is 'Germany' but Germany
  // isn't in COMMON_COUNTRIES), we render an extra option so the select
  // displays the current value instead of silently jumping to 'India'.
  const countryInList = COMMON_COUNTRIES.includes(pricing.shippingCountry)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      <div className="lg:col-span-2 divide-y divide-stone-200 border-t border-stone-200">
        {cart.lines.map((line) => (
          <div key={line.id} className="py-6 flex gap-4">
            <Link href={line.href} className="shrink-0">
              <div className="h-24 w-24 rounded-md overflow-hidden bg-stone-100">
                {line.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.image_url}
                    alt={line.title}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between gap-3">
                <div>
                  <Link
                    href={line.href}
                    className="text-sm font-medium text-stone-900 hover:text-amber-700"
                  >
                    {line.title}
                  </Link>
                  <p className="mt-1 text-xs text-stone-500">
                    {line.subtitle}
                  </p>
                </div>
                <button
                  onClick={() => remove(line.id)}
                  disabled={busyId === line.id}
                  className="text-stone-400 hover:text-stone-700 p-1"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!line.is_available && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-rose-700">
                  <AlertCircle className="h-3 w-3" /> Unavailable
                </p>
              )}
              {line.price_changed && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700">
                  <AlertCircle className="h-3 w-3" /> Price updated from{' '}
                  {fmtINR(line.unit_price_snapshot)} to{' '}
                  {fmtINR(line.unit_price)}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between">
                <div className="inline-flex items-center rounded-full border border-stone-300">
                  <button
                    onClick={() => changeQty(line.id, line.quantity - 1)}
                    disabled={line.quantity <= 1 || busyId === line.id}
                    className="h-8 w-8 flex items-center justify-center text-stone-600 disabled:opacity-30"
                    aria-label="Decrease"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums">
                    {busyId === line.id ? (
                      <Loader2 className="h-3 w-3 animate-spin mx-auto" />
                    ) : (
                      line.quantity
                    )}
                  </span>
                  <button
                    onClick={() => changeQty(line.id, line.quantity + 1)}
                    disabled={line.quantity >= 10 || busyId === line.id}
                    className="h-8 w-8 flex items-center justify-center text-stone-600 disabled:opacity-30"
                    aria-label="Increase"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-stone-900 tabular-nums">
                  {fmtINR(line.unit_price * line.quantity)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <aside className="rounded-lg border border-stone-200 bg-white p-6 h-fit lg:sticky lg:top-24">
        <h2 className="text-sm uppercase tracking-widest text-stone-500 font-semibold">
          Order summary
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-600">Subtotal</dt>
            <dd className="tabular-nums">{fmtINR(pricing.subtotal)}</dd>
          </div>

          {pricing.gst.applicable ? (
            <div className="flex justify-between">
              <dt className="text-stone-600">
                GST ({pricing.gst.ratePercent}%)
              </dt>
              <dd className="tabular-nums">{fmtINR(pricing.gst.amount)}</dd>
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

        {/* Shipping country preview */}
        <div className="mt-5 pt-5 border-t border-stone-200">
          <label
            htmlFor="ship-country"
            className="text-xs font-medium text-stone-600 block mb-1.5"
          >
            Shipping to
          </label>
          <select
            id="ship-country"
            value={pricing.shippingCountry}
            onChange={(e) => changeCountry(e.target.value)}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
          >
            {!countryInList && (
              <option value={pricing.shippingCountry}>
                {pricing.shippingCountry}
              </option>
            )}
            {COMMON_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-stone-500 leading-relaxed">
            {pricing.gst.applicable
              ? 'GST is applicable for deliveries within India.'
              : 'GST is zero-rated for international shipments. Your local customs may charge import duty at delivery.'}
          </p>
        </div>

        {cart.has_unavailable && (
          <p className="mt-4 text-xs text-rose-700">
            Remove unavailable items to continue.
          </p>
        )}

        <Link
          href={cart.has_unavailable ? '#' : '/checkout'}
          className={`mt-6 block w-full text-center rounded-full px-6 py-3 text-sm font-semibold transition-colors ${
            cart.has_unavailable
              ? 'bg-stone-200 text-stone-400 cursor-not-allowed pointer-events-none'
              : 'bg-stone-900 hover:bg-stone-800 text-white'
          }`}
        >
          {pending ? 'Updating…' : 'Proceed to Checkout'}
        </Link>

        <Link
          href="/shop"
          className="mt-3 block text-center text-xs text-stone-500 hover:text-stone-700"
        >
          or continue shopping
        </Link>
      </aside>
    </div>
  )
}