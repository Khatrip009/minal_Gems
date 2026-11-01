import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { FileText, Download } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'
}
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
const today = () => new Date().toISOString().slice(0, 10)
const startOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const CHANNELS = ['pos', 'online', 'phone', 'whatsapp', 'walk_in']

export default async function InvoiceRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string
    to?: string
    status?: string
    payment_status?: string
    channel?: string
    q?: string
    show_zero?: string
  }>
}) {
  const sp = await searchParams
  const from = sp.from ?? startOfMonth()
  const to = sp.to ?? today()
  const status = sp.status ?? ''
  const paymentStatus = sp.payment_status ?? ''
  const channel = sp.channel ?? ''
  const q = sp.q ?? ''
  const showZero = sp.show_zero === '1'

  const { supabase } = await requireRole([
    'admin',
    'manager',
    'accountant',
    'sales',
  ])

  let query = supabase
    .from('invoices')
    .select(
      `
      id, invoice_number, invoice_date, status, payment_status, channel,
      subtotal, discount, tax_amount, total, amount_paid, balance,
      voided_at,
      customers(id, name, phone, gstin)
    `,
    )
    .gte('invoice_date', from)
    .lte('invoice_date', to)
    .order('invoice_date', { ascending: false })
    .order('invoice_number', { ascending: false })

  if (status) query = query.eq('status', status)
  if (paymentStatus) query = query.eq('payment_status', paymentStatus)
  if (channel) query = query.eq('channel', channel)
  if (q) query = query.ilike('invoice_number', `%${q}%`)

  const { data: invoices, error } = await query

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        {error.message}
      </div>
    )
  }

  const all = (invoices ?? []) as any[]

  const filtered = showZero
    ? all
    : all.filter((i) => Number(i.total) > 0.005)

  let totalSubtotal = 0
  let totalDiscount = 0
  let totalTax = 0
  let totalTotal = 0
  let totalPaid = 0
  let totalBalance = 0
  for (const i of filtered) {
    totalSubtotal += Number(i.subtotal ?? 0)
    totalDiscount += Number(i.discount ?? 0)
    totalTax += Number(i.tax_amount ?? 0)
    totalTotal += Number(i.total ?? 0)
    totalPaid += Number(i.amount_paid ?? 0)
    totalBalance += Number(i.balance ?? 0)
  }

  const byChannel = new Map<
    string,
    { count: number; total: number; paid: number; balance: number }
  >()
  for (const i of filtered) {
    const c = i.channel ?? 'unknown'
    const cur = byChannel.get(c) ?? { count: 0, total: 0, paid: 0, balance: 0 }
    cur.count++
    cur.total += Number(i.total ?? 0)
    cur.paid += Number(i.amount_paid ?? 0)
    cur.balance += Number(i.balance ?? 0)
    byChannel.set(c, cur)
  }

  const zeroCount = all.length - filtered.length

  // PDF URL — carries all current filters
  const pdfParams = new URLSearchParams()
  if (from) pdfParams.set('from', from)
  if (to) pdfParams.set('to', to)
  if (status) pdfParams.set('status', status)
  if (paymentStatus) pdfParams.set('payment_status', paymentStatus)
  if (channel) pdfParams.set('channel', channel)
  if (q) pdfParams.set('q', q)
  const pdfUrl = `/reports/print/invoices${
    pdfParams.toString() ? `?${pdfParams.toString()}` : ''
  }`

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          ← Reports
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Invoice Register</h1>
            <p className="mt-1 text-sm text-slate-500">
              Period: {fmtDate(from)} → {fmtDate(to)} · {filtered.length} invoice
              {filtered.length === 1 ? '' : 's'}
              {zeroCount > 0 && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                  {zeroCount} zero-value hidden
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              <FileText className="h-3.5 w-3.5" /> Export PDF
            </a>
          </div>
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-500">
            From
          </label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">
            Status
          </label>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="issued">Issued</option>
            <option value="draft">Draft</option>
            <option value="voided">Voided</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">
            Payment
          </label>
          <select
            name="payment_status"
            defaultValue={paymentStatus}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">
            Channel
          </label>
          <select
            name="channel"
            defaultValue={channel}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {humanize(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="block text-xs font-medium text-slate-500">
            Invoice # search
          </label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="INV-2026-…"
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            name="show_zero"
            value="1"
            defaultChecked={showZero}
            className="rounded border-slate-300"
          />
          Show zero-value
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply
        </button>
        <Link
          href="/reports/invoices"
          className="text-sm text-slate-500 hover:underline"
        >
          Reset
        </Link>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Gross sales" value={totalSubtotal} />
        <Stat label="Tax collected" value={totalTax} />
        <Stat label="Invoiced total" value={totalTotal} bold />
        <Stat
          label="Outstanding"
          value={totalBalance}
          tone={totalBalance > 0.01 ? 'rose' : 'emerald'}
        />
      </div>

      {byChannel.size > 1 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from(byChannel.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([c, v]) => (
              <div
                key={c}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {humanize(c)}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular">
                  ₹ {fmtMoney(v.total)}
                </p>
                <p className="text-[10px] text-slate-500">
                  {v.count} ·{' '}
                  {v.balance > 0.01
                    ? `₹${fmtMoney(v.balance)} due`
                    : 'settled'}
                </p>
              </div>
            ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Invoice #
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Date
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Customer
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Channel
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Subtotal
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Tax
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Total
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Paid
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Balance
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No invoices match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((i) => {
              const isVoid = i.status === 'voided'
              return (
                <tr
                  key={i.id}
                  className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                    isVoid ? 'bg-slate-50/40 text-slate-400' : ''
                  }`}
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link
                      href={`/invoices/${i.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {i.invoice_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {fmtDate(i.invoice_date)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {i.customers?.name ?? 'Walk-in'}
                    {i.customers?.gstin && (
                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        B2B
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {humanize(i.channel ?? '—')}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtMoney(i.subtotal)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtMoney(i.tax_amount)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold tabular">
                    ₹ {fmtMoney(i.total)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular text-emerald-700">
                    {Number(i.amount_paid) > 0 ? fmtMoney(i.amount_paid) : '—'}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono tabular ${
                      Number(i.balance) > 0.01
                        ? 'text-rose-700 font-semibold'
                        : 'text-slate-400'
                    }`}
                  >
                    {Number(i.balance) > 0.01 ? fmtMoney(i.balance) : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <PaymentBadge status={i.payment_status} voided={isVoid} />
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
              <td
                colSpan={4}
                className="px-4 py-2 text-right text-xs uppercase text-slate-500"
              >
                Totals · {filtered.length} invoices
              </td>
              <td className="px-4 py-2 text-right font-mono tabular">
                {fmtMoney(totalSubtotal)}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular">
                {fmtMoney(totalTax)}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular text-brand-700">
                ₹ {fmtMoney(totalTotal)}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular text-emerald-700">
                {fmtMoney(totalPaid)}
              </td>
              <td className="px-4 py-2 text-right font-mono tabular text-rose-700">
                {fmtMoney(totalBalance)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Zero-value invoices (headers with total = ₹0.00 but valid journal
        entries) are hidden by default. Check <strong>Show zero-value</strong> to
        see them — they&apos;re a data-quality flag, not a report error.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
  bold,
}: {
  label: string
  value: number
  tone?: 'rose' | 'emerald'
  bold?: boolean
}) {
  const cls =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'rose'
        ? 'text-rose-700'
        : 'text-slate-900'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 tabular ${
          bold ? 'text-2xl font-bold' : 'text-xl font-semibold'
        } ${cls}`}
      >
        ₹ {fmtMoney(value)}
      </p>
    </div>
  )
}

function PaymentBadge({
  status,
  voided,
}: {
  status: string
  voided: boolean
}) {
  if (voided) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
        Voided
      </span>
    )
  }
  if (status === 'paid') {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-700 ring-1 ring-inset ring-emerald-200">
        Paid
      </span>
    )
  }
  if (status === 'partially_paid') {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700 ring-1 ring-inset ring-amber-200">
        Partial
      </span>
    )
  }
  if (status === 'refunded') {
    return (
      <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium uppercase text-sky-700 ring-1 ring-inset ring-sky-200">
        Refunded
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium uppercase text-rose-700 ring-1 ring-inset ring-rose-200">
      Unpaid
    </span>
  )
}