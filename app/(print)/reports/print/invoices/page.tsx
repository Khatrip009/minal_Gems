import { requireRole } from '@/lib/guard'
import { ReportPrintShell } from '@/components/primitives/report-print-shell'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
const fmtDate = (d: string | null | undefined) =>
  !d ? '—' : new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default async function InvoiceRegisterPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; payment_status?: string; channel?: string; q?: string }>
}) {
  const sp = await searchParams
  const from = sp.from ?? ''
  const to = sp.to ?? ''

  const { supabase } = await requireRole(['admin', 'manager', 'accountant', 'sales'])
  const { data: { user } } = await supabase.auth.getUser()

  let q = supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, status, payment_status, channel, subtotal, tax_amount, total, amount_paid, balance, customers(name, gstin)')
    .order('invoice_date', { ascending: false })

  if (from) q = q.gte('invoice_date', from)
  if (to) q = q.lte('invoice_date', to)
  if (sp.status) q = q.eq('status', sp.status)
  if (sp.payment_status) q = q.eq('payment_status', sp.payment_status)
  if (sp.channel) q = q.eq('channel', sp.channel)
  if (sp.q) q = q.ilike('invoice_number', `%${sp.q}%`)

  const [{ data: invoices }, prof] = await Promise.all([
    q,
    user ? supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const rows = ((invoices ?? []) as any[]).filter((i) => Number(i.total) > 0.005)

  const t = rows.reduce((a, r) => ({
    sub: a.sub + Number(r.subtotal ?? 0),
    tax: a.tax + Number(r.tax_amount ?? 0),
    total: a.total + Number(r.total ?? 0),
    paid: a.paid + Number(r.amount_paid ?? 0),
    balance: a.balance + Number(r.balance ?? 0),
  }), { sub: 0, tax: 0, total: 0, paid: 0, balance: 0 })

  const subtitle = from || to ? `${from ? fmtDate(from) : '…'} → ${to ? fmtDate(to) : '…'}` : 'All time'

  return (
    <ReportPrintShell
      title="Invoice Register"
      subtitle={subtitle}
      filename={`Invoices ${from}_${to}`}
      backHref="/reports/invoices"
      printedBy={prof.data?.full_name ?? null}
      footerInfo={`${rows.length} invoices`}
    >
      <div className="mb-3 grid grid-cols-5 gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs">
        <div><p className="text-[10px] uppercase text-slate-500">Gross</p><p className="font-semibold tabular">₹ {fmtMoney(t.sub)}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Tax</p><p className="font-semibold tabular">₹ {fmtMoney(t.tax)}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Total</p><p className="font-semibold tabular">₹ {fmtMoney(t.total)}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Paid</p><p className="font-semibold tabular text-emerald-700">₹ {fmtMoney(t.paid)}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Outstanding</p><p className={`font-semibold tabular ${t.balance > 0.01 ? 'text-rose-700' : 'text-emerald-700'}`}>₹ {fmtMoney(t.balance)}</p></div>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-left">
            <th className="py-1 font-semibold">Invoice #</th>
            <th className="py-1 font-semibold">Date</th>
            <th className="py-1 font-semibold">Customer</th>
            <th className="py-1 font-semibold">Channel</th>
            <th className="py-1 text-right font-semibold">Subtotal</th>
            <th className="py-1 text-right font-semibold">Tax</th>
            <th className="py-1 text-right font-semibold">Total</th>
            <th className="py-1 text-right font-semibold">Paid</th>
            <th className="py-1 text-right font-semibold">Balance</th>
            <th className="py-1 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={10} className="py-4 text-center italic text-slate-500">No invoices in range</td></tr>}
          {rows.map((i) => (
            <tr key={i.id} className="border-b border-slate-200">
              <td className="py-1 font-mono">{i.invoice_number}</td>
              <td className="py-1">{fmtDate(i.invoice_date)}</td>
              <td className="py-1">{i.customers?.name ?? 'Walk-in'}</td>
              <td className="py-1 capitalize">{humanize(i.channel ?? '—')}</td>
              <td className="py-1 text-right tabular">{fmtMoney(i.subtotal)}</td>
              <td className="py-1 text-right tabular">{fmtMoney(i.tax_amount)}</td>
              <td className="py-1 text-right tabular font-semibold">{fmtMoney(i.total)}</td>
              <td className="py-1 text-right tabular text-emerald-700">{Number(i.amount_paid) > 0 ? fmtMoney(i.amount_paid) : '—'}</td>
              <td className={`py-1 text-right tabular ${Number(i.balance) > 0.01 ? 'font-semibold text-rose-700' : 'text-slate-400'}`}>{Number(i.balance) > 0.01 ? fmtMoney(i.balance) : '—'}</td>
              <td className="py-1 capitalize text-[10px]">{humanize(i.payment_status ?? '')}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-semibold">
            <td colSpan={4} className="py-1">Total · {rows.length} invoices</td>
            <td className="py-1 text-right tabular">{fmtMoney(t.sub)}</td>
            <td className="py-1 text-right tabular">{fmtMoney(t.tax)}</td>
            <td className="py-1 text-right tabular">₹{fmtMoney(t.total)}</td>
            <td className="py-1 text-right tabular text-emerald-700">₹{fmtMoney(t.paid)}</td>
            <td className="py-1 text-right tabular text-rose-700">₹{fmtMoney(t.balance)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </ReportPrintShell>
  )
}