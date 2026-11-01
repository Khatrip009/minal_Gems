import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Printer,
  CheckCircle2,
  Clock,
  FileText,
  MessageCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { fmtINR, fmtDate } from '@/lib/storefront/format'
import { getOrderStatusConfig } from '@/lib/storefront/order-status'

export const dynamic = 'force-dynamic'

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  const auth = await getCurrentCustomer()
  if (!auth) return null

  const supabase = await createClient()
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `
      id, order_number, status, payment_method,
      customer_name, customer_phone, customer_email,
      shipping_address, subtotal, tax_amount, total,
      customer_notes, placed_at, confirmed_at, paid_at,
      shipped_at, delivered_at, cancelled_at, cancelled_reason,
      invoices!invoice_id(invoice_number, status, total),
      order_items(
        id, item_description, fulfillment_type,
        quantity, unit_price, line_total, metal_purity_code
      )
    `,
    )
    .eq('order_number', orderNumber)
    .eq('customer_id', auth.customer.id)
    .maybeSingle()

  if (error) {
    console.error('[account/orders/[orderNumber]] query failed:', error)
  }
  if (!order) notFound()

  const cfg = getOrderStatusConfig(order.status)
  const invoice = Array.isArray(order.invoices)
    ? order.invoices[0]
    : order.invoices
  const invoiceHref = invoice
    ? `/account/orders/${order.order_number}/invoice`
    : null
  const items = order.order_items ?? []
  const shipping = (order.shipping_address ?? {}) as Record<string, any>

  const timeline = [
    { key: 'placed_at', label: 'Order placed', value: order.placed_at },
    { key: 'confirmed_at', label: 'Confirmed', value: order.confirmed_at },
    { key: 'paid_at', label: 'Paid', value: order.paid_at },
    { key: 'shipped_at', label: 'Shipped', value: order.shipped_at },
    {
      key: 'delivered_at',
      label: 'Delivered',
      value: order.delivered_at,
    },
  ] as const

  return (
    <div className="space-y-6">
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900"
      >
        <ChevronLeft className="h-4 w-4" /> Back to orders
      </Link>

      {/* ── Header card ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
              Order
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-stone-900">
              {order.order_number}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Placed on {fmtDate(order.placed_at)}
            </p>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${cfg.tone}`}
            >
              {cfg.label}
            </span>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900">
              {fmtINR(Number(order.total))}
            </p>
          </div>
        </div>

        {order.cancelled_at && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <p className="font-medium">Order cancelled</p>
            {order.cancelled_reason && (
              <p className="mt-1">{order.cancelled_reason}</p>
            )}
          </div>
        )}

        {/* ★ Invoice row — number + Print button */}
        {invoice && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-center gap-2 text-xs text-stone-600">
              <FileText className="h-4 w-4 text-stone-500" />
              <span>
                Invoice{' '}
                <span className="font-mono font-medium text-stone-900">
                  {invoice.invoice_number}
                </span>
              </span>
            </div>
            <div className="flex gap-2">
              {invoiceHref && (
                <a
                  href={invoiceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 hover:border-stone-500 px-4 py-2 text-xs font-semibold text-stone-700 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Invoice
                </a>
              )}
              {['paid', 'shipped', 'delivered'].includes(order.status) && (
                <a
                  href={`/account/orders/${order.order_number}/receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Receipt
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Progress ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-4">
          Progress
        </p>
        <ol className="space-y-3">
          {timeline.map((step, i) => {
            const done = !!step.value
            const isLast = i === timeline.length - 1
            return (
              <li key={step.key} className="flex gap-3">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                    done
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-500'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex-1 pb-3">
                  <p
                    className={`text-sm font-medium ${done ? 'text-stone-900' : 'text-stone-500'}`}
                  >
                    {step.label}
                  </p>
                  {step.value && (
                    <p className="text-xs text-stone-500 mt-0.5">
                      {fmtDate(step.value)}
                    </p>
                  )}
                  {!isLast && !done && (
                    <div className="mt-2 ml-3 h-6 w-px bg-stone-200" />
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* ── Items ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-4">
          Items
        </p>
        <ul className="divide-y divide-stone-200">
          {items.map((it: any) => (
            <li
              key={it.id}
              className="py-3 flex justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium text-stone-900">
                  {it.item_description}
                </p>
                <p className="text-xs text-stone-500">
                  {it.fulfillment_type === 'made_to_order'
                    ? 'Made to order · '
                    : ''}
                  Qty {it.quantity}
                  {it.metal_purity_code
                    ? ` · ${it.metal_purity_code}`
                    : ''}
                </p>
              </div>
              <p className="tabular-nums text-stone-900 font-medium shrink-0">
                {fmtINR(Number(it.line_total))}
              </p>
            </li>
          ))}
        </ul>
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

      {/* ── Shipping + Payment ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-stone-200 bg-white p-6">
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

        <div className="rounded-lg border border-stone-200 bg-white p-6">
          <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-3">
            Payment
          </p>
          <p className="text-sm font-medium text-stone-900 capitalize">
            {order.payment_method === 'cash_at_pickup'
              ? 'Pay at Showroom'
              : order.payment_method === 'cod'
                ? 'Cash on Delivery'
                : order.payment_method === 'bank_transfer'
                  ? 'Bank Transfer'
                  : order.payment_method === 'upi'
                    ? 'UPI'
                    : (order.payment_method ?? '—')}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {Number(order.tax_amount) > 0
              ? 'Inclusive of 3% GST'
              : 'GST zero-rated (export)'}
          </p>
        </div>
      </div>

      {/* ── Notes ────────────────────────────────────────────────── */}
      {order.customer_notes && (
        <div className="rounded-lg border border-stone-200 bg-white p-6">
          <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-3">
            Your notes
          </p>
          <p className="text-sm text-stone-700 whitespace-pre-line">
            {order.customer_notes}
          </p>
        </div>
      )}

      {/* ── Help ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-3">
          Need help?
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`https://wa.me/917096785900?text=${encodeURIComponent(
              `Hi, I'd like help with order ${order.order_number}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 hover:border-stone-500 px-4 py-2 text-xs font-medium text-stone-700 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat on WhatsApp
          </a>
          {invoiceHref && (
            <a
              href={invoiceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 hover:border-stone-500 px-4 py-2 text-xs font-medium text-stone-700 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print invoice
            </a>
          )}
        </div>
      </div>
    </div>
  )
}