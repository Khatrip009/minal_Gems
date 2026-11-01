import { requireRole } from '@/lib/guard'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, ArrowLeftRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

export default async function ReturnsPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  const { data: returns, error } = await supabase
  .from('returns')
  .select('*, customers(name), invoices!invoice_id(invoice_number)')  // ← !invoice_id added
  .order('created_at', { ascending: false })

  if (error) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error.message}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Returns & Exchanges</h1>
          <p className="mt-1 text-sm text-slate-500">Manage customer returns, refunds, and melted gold.</p>
        </div>
        <Link href="/returns/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Return
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Return #</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Date</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Customer</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Original Invoice</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Type</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">Refund Value</th>
            </tr>
          </thead>
          <tbody>
            {(returns ?? []).map((r: any) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono text-xs font-semibold">
                  <Link href={`/returns/${r.id}`} className="text-brand-700 hover:underline">
                    {r.return_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{fmtDate(r.return_date)}</td>
                <td className="px-4 py-3 text-slate-900">{r.customers?.name ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/invoices/${r.invoice_id}`} className="text-slate-500 hover:underline">
                    {r.invoices?.invoice_number ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${
                    r.return_type === 'refund' ? 'bg-rose-50 text-rose-700 ring-rose-200' :
                    r.return_type === 'store_credit' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                    'bg-sky-50 text-sky-700 ring-sky-200'
                  }`}>
                    {r.return_type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${
                    r.status === 'completed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 
                    'bg-amber-50 text-amber-700 ring-amber-200'
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular font-semibold">Rs. {fmtMoney(r.total_refund_amount)}</td>
              </tr>
            ))}
            {returns?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  <ArrowLeftRight className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  No returns recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}