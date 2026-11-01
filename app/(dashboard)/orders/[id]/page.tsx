import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft,
  Clock,
  CheckCircle2,
  Package,
  Printer,
  FileText,
  MessageCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtINR } from '@/lib/storefront/format'
import { getOrderStatusConfig } from '@/lib/storefront/order-status'
import { OrderActions } from './order-actions'

export const dynamic = 'force-dynamic'

export default async function DashboardOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `
      id, order_number, status, payment_method,
      customer_id, customer_name, customer_phone, customer_email,
      shipping_address, subtotal, tax_amount, shipping_amount,
      discount_amount, total, customer_notes, internal_notes,
      placed_at, confirmed_at, paid_at, shipped_at, delivered_at,
      cancelled_at, cancelled_reason, invoice_id,
      invoices!invoice_id(invoice_number, status, payment_status, amount_paid, balance),
      order_items(
        id, item_description, fulfillment_type,
        quantity, unit_price, line_total, metal_purity_code,
        inventory_item_id, design_id, variant_id
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) console.error('[orders/detail] query failed:', error)
  if (!order) notFound()

  const cfg = getOrderStatusConfig(order.status)
  const invoice = Array.isArray(order.invoices)
    ? order.invoices[0]
    : order.invoices
  const items = order.order_items ?? []
  const shipping = (order.shipping_address ?? {}) as Record<string, any>

  // Receipt only makes sense once payment has been recorded
  const hasPayment = ['paid', 'shipped', 'delivered'].includes(order.status)
  const invoiceId = order.invoice_id
  const receiptHref =
    invoiceId && hasPayment ? `/invoice-print/${invoiceId}/receipt` : null

  const timeline = [
    { key: 'placed_at', label: 'Order placed', value: order.placed_at },
    { key: 'paid_at', label: 'Paid', value: order.paid_at },
    { key: 'shipped_at', label: 'Shipped', value: order.shipped_at },
    { key: 'delivered_at', label: 'Delivered', value: order.delivered_at },
  ] as const

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" /> Back to orders
      </Link>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
              Order
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-slate-900">
              {order.order_number}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Placed on {fmtDate(order.placed_at)}
            </p>
          </div>
          <div className="text-right">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${cfg.tone}`}
            >
              {cfg.label}
            </span>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
              {fmtINR(Number(order.total))}
            </p>
          </div>
        </div>

        {order.cancelled_at && (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <p className="font-medium">Cancelled</p>
            {order.cancelled_reason && (
              <p className="mt-1">{order.cancelled_reason}</p>
            )}
            <p className="mt-1 text-rose-700">
              on {fmtDate(order.cancelled_at)}
            </p>
          </div>
        )}

        {invoice && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex items-center gap-2 text-slate-600">
              <FileText className="h-4 w-4" />
              Invoice{' '}
              <span className="font-mono font-medium text-slate-900">
                {invoice.invoice_number}
              </span>
              <span className="text-slate-400">·</span>
              <span className="capitalize">{invoice.payment_status}</span>
            </div>
            <div className="flex gap-2">
              <a
                href={`/invoice-print/${invoiceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 hover:border-slate-500 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Invoice
              </a>
              {receiptHref && (
                <a
                  href={receiptHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Receipt
                </a>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <OrderActions
          orderId={order.id}
          orderNumber={order.order_number}
          status={order.status}
        />
      </div>

      {/* ── Timeline ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4">
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
                      : 'bg-slate-200 text-slate-500'
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
                    className={`text-sm font-medium ${
                      done ? 'text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.value && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {fmtDate(step.value)}
                    </p>
                  )}
                  {!isLast && !done && (
                    <div className="mt-2 ml-3 h-6 w-px bg-slate-200" />
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* ── Customer + Shipping ──────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
            Customer
          </p>
          <p className="text-sm font-medium text-slate-900">
            {order.customer_name}
          </p>
          {order.customer_phone && (
            <p className="text-sm text-slate-600 mt-0.5">
              {order.customer_phone}
            </p>
          )}
          {order.customer_email && (
            <p className="text-sm text-slate-600">{order.customer_email}</p>
          )}
          {order.customer_phone && (
            <a
              href={`https://wa.me/${String(order.customer_phone).replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                `Hi ${order.customer_name}, regarding your order ${order.order_number}…`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:text-amber-800"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp customer
            </a>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
            Shipping address
          </p>
          <p className="text-sm font-medium text-slate-900">
            {shipping.name ?? '—'}
          </p>
          {shipping.line1 && (
            <p className="text-sm text-slate-600 mt-1">
              {shipping.line1}
              {shipping.line2 ? `, ${shipping.line2}` : ''}
            </p>
          )}
          {shipping.city && (
            <p className="text-sm text-slate-600">
              {shipping.city}
              {shipping.state ? `, ${shipping.state}` : ''}
              {shipping.pincode ? ` — ${shipping.pincode}` : ''}
            </p>
          )}
          {shipping.country && (
            <p className="text-sm text-slate-600">{shipping.country}</p>
          )}
          {shipping.phone && (
            <p className="text-sm text-slate-600 mt-1">{shipping.phone}</p>
          )}
        </div>
      </div>

      {/* ── Items ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-4">
          Items
        </p>
        <ul className="divide-y divide-slate-100">
          {items.map((it: any) => (
            <li
              key={it.id}
              className="py-3 flex justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {it.item_description}
                </p>
                <p className="text-xs text-slate-500">
                  {it.fulfillment_type === 'made_to_order'
                    ? 'Made to order · '
                    : 'In stock · '}
                  Qty {it.quantity}
                  {it.metal_purity_code ? ` · ${it.metal_purity_code}` : ''}
                </p>
              </div>
              <p className="tabular-nums font-medium text-slate-900 shrink-0">
                {fmtINR(Number(it.line_total))}
              </p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="tabular-nums">
              {fmtINR(Number(order.subtotal))}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Tax</dt>
            <dd className="tabular-nums">
              {fmtINR(Number(order.tax_amount))}
            </dd>
          </div>
          {Number(order.shipping_amount) > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-600">Shipping</dt>
              <dd className="tabular-nums">
                {fmtINR(Number(order.shipping_amount))}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{fmtINR(Number(order.total))}</dd>
          </div>
        </dl>
      </div>

      {/* ── Notes ────────────────────────────────────────────────── */}
      {(order.customer_notes || order.internal_notes) && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          {order.customer_notes && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
                Customer notes
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-line">
                {order.customer_notes}
              </p>
            </div>
          )}
          {order.internal_notes && (
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
                Internal notes
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-line">
                {order.internal_notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}