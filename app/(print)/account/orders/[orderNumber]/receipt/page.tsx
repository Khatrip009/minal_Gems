import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { amountInWords } from '@/lib/number-to-words'
import { ArrowLeft, AlertCircle, MessageCircle } from 'lucide-react'
import { PrintButton } from '../invoice/print-button'

export const dynamic = 'force-dynamic'

const COMPANY = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Minal Gems',
  address:
    '33, Sant tukaram Society- 2, Nr. Ramji Temple, Palanpur Jakatnaka, Surat, Gujarat',
  phone: '+91 7096785900',
  gstin: '24XXXXX1234X1Z5',
  pan: 'XXXXX1234',
}

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '917096785900'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

const paymentMethodLabel = (m: string | null | undefined) => {
  switch (m) {
    case 'cash': return 'Cash'
    case 'upi': return 'UPI'
    case 'bank_transfer': return 'Bank Transfer'
    case 'card': return 'Card'
    case 'cheque': return 'Cheque'
    case 'gold_exchange':
    case 'gold_buyback': return 'Gold Exchange'
    case 'store_credit': return 'Store Credit'
    case 'exchange_credit': return 'Exchange Credit'
    case 'gold_scheme': return 'Gold Scheme'
    case 'adjustment': return 'Adjustment'
    case 'other': return 'Other'
    default: return m ?? '—'
  }
}

export default async function CustomerReceiptPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  const auth = await getCurrentCustomer()
  if (!auth) notFound()

  const supabase = await createClient()

  // Verify ownership
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, invoice_id, customer_id')
    .eq('order_number', orderNumber)
    .eq('customer_id', auth.customer.id)
    .maybeSingle()

  if (!order) notFound()
  if (!order.invoice_id) notFound()

  // Fetch invoice + payments via service client (RLS-safe — ownership proven)
  const service = createServiceClient()
  const [{ data: invoice }, { data: payments }] = await Promise.all([
    service
      .from('invoices')
      .select('*, customers(*)')
      .eq('id', order.invoice_id)
      .maybeSingle(),
    service
      .from('invoice_payments')
      .select('id, receipt_number, amount, payment_date, payment_method, reference, notes, voided_at, created_at')
      .eq('invoice_id', order.invoice_id)
      .order('created_at', { ascending: true }),
  ])

  if (!invoice) notFound()

  const activePayments = (payments ?? []).filter((p: any) => !p.voided_at)

  if (activePayments.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-xl">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-600" />
          <h1 className="text-lg font-semibold text-slate-900">
            No payment recorded yet
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            We'll generate a receipt as soon as your payment is confirmed.
          </p>
          <Link
            href={`/account/orders/${orderNumber}`}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to order
          </Link>
        </div>
      </div>
    )
  }

  const primary = activePayments[activePayments.length - 1]
  const totalReceived = activePayments.reduce(
    (s: number, p: any) => s + Number(p.amount),
    0,
  )
  const balance = Number(invoice.balance ?? 0)
  const customer = invoice.customers

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white font-sans">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `,
        }}
      />

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm print:hidden">
        <Link
          href={`/account/orders/${order.order_number}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to order
        </Link>
        <PrintButton />
      </div>

      <div className="relative mx-auto my-8 w-full max-w-[210mm] bg-white p-10 text-sm text-slate-900 shadow-xl print:my-0 print:w-full print:max-w-none print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-5">
          <div className="flex items-center gap-5">
            <Image
              src="/logo_minalgems.png"
              alt={COMPANY.name}
              width={200}
              height={200}
              className="w-24 h-24 object-contain"
              priority
            />
            <div>
              <p className="text-xl font-bold leading-tight text-slate-900">
                {COMPANY.name}
              </p>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                Jewellery Manufacturing
              </p>
              <p className="text-[10px] text-slate-600 mt-1">{COMPANY.address}</p>
              <p className="text-[10px] text-slate-600">{COMPANY.phone}</p>
              <p className="text-[10px] font-medium text-slate-600 mt-0.5">
                GSTIN: {COMPANY.gstin}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black tracking-wider text-emerald-700">
              PAYMENT RECEIPT
            </p>
            <p className="mt-1 font-mono text-base font-bold text-amber-600">
              {primary.receipt_number}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Date: {fmtDate(primary.payment_date)}
            </p>
          </div>
        </div>

        {/* Received from */}
        <div className="grid grid-cols-2 gap-6 border-b border-slate-300 py-4">
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Received with thanks from
            </p>
            {customer ? (
              <>
                <p className="text-sm font-bold text-slate-900">
                  {customer.name}
                </p>
                {customer.phone && (
                  <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                    {customer.phone}
                  </p>
                )}
                {customer.email && (
                  <p className="text-[11px] text-slate-600">
                    {customer.email}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm font-medium text-slate-500">—</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              For order / invoice
            </p>
            <p className="font-mono text-sm font-bold text-slate-900">
              {order.order_number}
            </p>
            <p className="font-mono text-[11px] text-slate-700 mt-0.5">
              Invoice {invoice.invoice_number}
            </p>
            <p className="text-[11px] text-slate-600">
              Dated {fmtDate(invoice.invoice_date)}
            </p>
          </div>
        </div>

        {/* Payment table */}
        <table className="mt-6 w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-50">
              <th className="py-2 px-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Receipt #
              </th>
              <th className="py-2 px-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Date
              </th>
              <th className="py-2 px-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Method
              </th>
              <th className="py-2 px-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Reference
              </th>
              <th className="py-2 px-2 text-right text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {activePayments.map((p: any) => (
              <tr key={p.id} className="border-b border-slate-200">
                <td className="py-2.5 px-2 font-mono text-[11px] text-slate-900">
                  {p.receipt_number}
                </td>
                <td className="py-2.5 px-2 text-[11px] text-slate-700">
                  {fmtDate(p.payment_date)}
                </td>
                <td className="py-2.5 px-2 text-[11px] text-slate-700">
                  {paymentMethodLabel(p.payment_method)}
                </td>
                <td className="py-2.5 px-2 font-mono text-[11px] text-slate-600">
                  {p.reference ?? '—'}
                </td>
                <td className="py-2.5 px-2 text-right tabular font-bold text-slate-900 whitespace-nowrap">
                  Rs. {fmtMoney(p.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-[320px] space-y-1.5 text-[12px]">
            <div className="flex justify-between py-1">
              <span className="text-slate-600 font-medium">
                Invoice total
              </span>
              <span className="tabular font-bold whitespace-nowrap">
                Rs. {fmtMoney(invoice.total)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-t border-slate-300 pt-1.5">
              <span className="text-slate-700 font-semibold">
                Total received
              </span>
              <span className="tabular font-bold text-emerald-700 whitespace-nowrap">
                Rs. {fmtMoney(totalReceived)}
              </span>
            </div>
            {balance > 0.01 && (
              <div className="flex justify-between py-1 border-t-2 border-slate-300 pt-1.5 text-base">
                <span className="text-amber-800 font-bold">Balance due</span>
                <span className="tabular font-bold text-amber-800 whitespace-nowrap">
                  Rs. {fmtMoney(balance)}
                </span>
              </div>
            )}
            {balance <= 0.01 && (
              <div className="flex justify-between py-1 border-t-2 border-slate-300 pt-1.5 text-base">
                <span className="text-emerald-800 font-bold">
                  Paid in full
                </span>
                <span className="text-emerald-800 font-bold">✓</span>
              </div>
            )}
          </div>
        </div>

        {/* Amount in words */}
        <p className="mt-6 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-medium italic text-slate-700">
          {amountInWords(totalReceived)}
        </p>

        {/* Thank you + support */}
        <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4 print:break-inside-avoid">
          <p className="text-sm font-semibold text-emerald-900">
            Thank you for your payment
          </p>
          <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
            Your order will be confirmed and prepared for delivery. We'll
            notify you when it ships.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
              `Hi, regarding order ${order.order_number} (${primary.receipt_number})`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-900 print:hidden"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat with us on WhatsApp
          </a>
        </div>

        {/* Signatures */}
        <div className="mt-16 grid grid-cols-2 gap-12 pt-8 print:break-inside-avoid">
          <div>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1.5 text-[10px] font-bold text-slate-600">
              Customer Signature
            </p>
          </div>
          <div className="text-right">
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1.5 text-xs font-bold text-slate-800">
              For {COMPANY.name}
            </p>
            <p className="text-[10px] font-medium text-slate-500">
              Authorised Signatory
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-2 text-center text-[9px] font-medium text-slate-400">
          This is a computer-generated receipt. No physical signature
          required.
        </div>
      </div>
    </div>
  )
}