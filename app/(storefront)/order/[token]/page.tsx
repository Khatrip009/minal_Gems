import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  Package,
  Truck,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { fmtINR, fmtDate } from '@/lib/storefront/format'

export const dynamic = 'force-dynamic'

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const auth = await getCurrentCustomer()
  if (!auth) redirect('/login')

  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound()

  const supabase = await createClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `
      id, order_number, status, payment_method,
      customer_name, customer_phone, customer_email,
      shipping_address, subtotal, tax_amount, total,
      customer_notes, placed_at, confirmed_at,
      invoice_id,
      invoices!invoice_id(invoice_number, status, total),
      order_items(
        id, item_description,
        inventory_item_id, design_id, variant_id,
        quantity, unit_price, line_total, spec_snapshot
      )
    `,
    )
    .eq('access_token', token)
    .maybeSingle()

  if (error) {
    console.error('[order-confirmation] query failed:', error)
    notFound()
  }
  if (!order) {
    console.error('[order-confirmation] no order for token:', token)
    notFound()
  }

  const invoice = Array.isArray(order.invoices)
    ? order.invoices[0]
    : order.invoices
  const items = order.order_items ?? []
  const shipping = (order.shipping_address ?? {}) as Record<string, any>
  const firstName =
    (order.customer_name ?? '').split(' ')[0] || 'there'

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      {/* Success banner */}
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-4 text-3xl font-semibold text-stone-900">
          Thank you, {firstName}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Your order has been placed. Our team will contact you shortly to
          confirm payment and delivery.
        </p>
      </div>

      {/* Order number */}
      <div className="mt-10 rounded-lg border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
              Order Number
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-stone-900">
              {order.order_number}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Placed on {fmtDate(order.placed_at)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
              Total
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
              {fmtINR(Number(order.total))}
            </p>
          </div>
        </div>

        {invoice && (
          <p className="mt-3 text-xs text-stone-500">
            Invoice:{' '}
            <span className="font-mono text-stone-900">
              {invoice.invoice_number}
            </span>
          </p>
        )}

        <div className="mt-6 flex items-center gap-2 text-xs text-stone-600">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> Awaiting payment confirmation
          </span>
        </div>
      </div>

      {/* Status timeline */}
      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-4">
          What happens next
        </p>
        <ol className="space-y-4">
          <Step
            icon={<Clock className="h-4 w-4" />}
            title="Payment confirmation"
            body={
              order.payment_method === 'cod'
                ? 'Pay in cash when your order arrives.'
                : order.payment_method === 'cash_at_pickup'
                  ? 'Visit our Surat showroom to collect and pay.'
                  : order.payment_method === 'bank_transfer'
                    ? 'Our team will share bank details shortly. Order ships once payment is received.'
                    : order.payment_method === 'upi'
                      ? 'Our team will share UPI details shortly. Order ships once payment is received.'
                      : 'Our team will contact you with payment details.'
            }
            active
          />
          <Step
            icon={<Package className="h-4 w-4" />}
            title="Preparing your piece"
            body="Each order is inspected and packed with care by our team."
          />
          <Step
            icon={<Truck className="h-4 w-4" />}
            title="Delivery"
            body="Insured shipping, signature required on delivery."
            isLast
          />
        </ol>
      </div>

      {/* Items */}
      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-4">
          Items
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-stone-500">No items on this order.</p>
        ) : (
          <ul className="divide-y divide-stone-200">
            {items.map((it) => {
              // Derive made-to-order: no physical inventory row was reserved
              // for this line, and it references a design (not an ad-hoc item).
              const specMadeToOrder =
                it.spec_snapshot &&
                (it.spec_snapshot as any).fulfillment_type ===
                  'made_to_order'
              const isMadeToOrder =
                specMadeToOrder ||
                (!it.inventory_item_id && !!it.design_id)

              return (
                <li
                  key={it.id}
                  className="py-3 flex justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-stone-900">
                      {it.item_description}
                    </p>
                    <p className="text-xs text-stone-500">
                      {isMadeToOrder ? 'Made to order · ' : ''}
                      Qty {it.quantity}
                    </p>
                  </div>
                  <p className="tabular-nums text-stone-900 font-medium shrink-0">
                    {fmtINR(Number(it.line_total))}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
        <dl className="mt-4 pt-4 border-t border-stone-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-600">Subtotal</dt>
            <dd className="tabular-nums">
              {fmtINR(Number(order.subtotal))}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-stone-600">
              {Number(order.tax_amount) > 0 ? 'GST (3%)' : 'GST'}
            </dt>
            <dd className="tabular-nums">
              {Number(order.tax_amount) > 0 ? (
                fmtINR(Number(order.tax_amount))
              ) : (
                <span className="text-stone-500 italic text-xs">
                  Not applicable · export
                </span>
              )}
            </dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{fmtINR(Number(order.total))}</dd>
          </div>
        </dl>
      </div>

      {/* Shipping address */}
      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-3">
          Shipping to
        </p>
        <p className="text-sm font-medium text-stone-900">
          {shipping.name ?? order.customer_name ?? '—'}
        </p>
        {shipping.line1 && (
          <p className="text-sm text-stone-600 mt-1">
            {shipping.line1}
            {shipping.line2 ? `, ${shipping.line2}` : ''}
          </p>
        )}
        {shipping.city && (
          <p className="text-sm text-stone-600">
            {shipping.city}
            {shipping.state ? `, ${shipping.state}` : ''}
            {shipping.pincode ? ` — ${shipping.pincode}` : ''}
          </p>
        )}
        {shipping.country && shipping.country !== 'India' && (
          <p className="text-sm text-stone-600">{shipping.country}</p>
        )}
        {(shipping.phone ?? order.customer_phone) && (
          <p className="text-sm text-stone-600 mt-1">
            {shipping.phone ?? order.customer_phone}
          </p>
        )}
      </div>

      {/* CTAs */}
      <div className="mt-10 flex flex-wrap gap-3 justify-center">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 text-sm font-semibold"
        >
          Continue Shopping <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 rounded-full border border-stone-300 hover:border-stone-500 px-6 py-3 text-sm font-medium text-stone-700"
        >
          View All Orders
        </Link>
      </div>

      <p className="mt-8 text-center text-xs text-stone-500">
        Need help?{' '}
        <a
          href="https://wa.me/917096785900"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-700 hover:text-amber-800 font-medium"
        >
          Chat with us on WhatsApp
        </a>
      </p>
    </div>
  )
}

function Step({
  icon,
  title,
  body,
  active,
  isLast,
}: {
  icon: React.ReactNode
  title: string
  body: string
  active?: boolean
  isLast?: boolean
}) {
  return (
    <li className="flex gap-4">
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
          active ? 'bg-amber-600 text-white' : 'bg-stone-200 text-stone-500'
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p
          className={`text-sm font-medium ${active ? 'text-stone-900' : 'text-stone-700'}`}
        >
          {title}
        </p>
        <p className="text-xs text-stone-500 mt-0.5">{body}</p>
        {!isLast && <div className="mt-3 ml-4 h-6 w-px bg-stone-200" />}
      </div>
    </li>
  )
}