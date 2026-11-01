import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { FinalizeReturnButton } from './finalize-button'
import { ArrowLeft, CheckCircle2, Scale, AlertTriangle, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

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

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, role } = await requireRole([
    'admin',
    'manager',
    'sales',
    'accountant',
  ])

  const { data: returnRecord, error } = await supabase
    .from('returns')
    .select(
      `
        *,
        customers ( id, name, phone ),
        invoices!invoice_id ( id, invoice_number ),
        return_items (
          id, condition, refund_amount, inventory_item_id, invoice_item_id,
          invoice_items!invoice_item_id ( item_description ),
          inventory_items ( inventory_tag, net_metal_weight_g, stone_carat_total )
        )
      `,
    )
    .eq('id', id)
    .single()

  // Surface the real error instead of a bare 404
  if (error) {
    if (error.code === 'PGRST116') notFound()  // row not found
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">Could not load return</p>
        <p className="mt-1 font-mono text-xs">{error.message}</p>
        <p className="mt-1 font-mono text-[10px] text-red-500">
          code: {error.code} · details: {error.details ?? '—'} · hint: {error.hint ?? '—'}
        </p>
      </div>
    )
  }
  if (!returnRecord) notFound()

  const isPending = returnRecord.status === 'pending'
  const isCompleted = returnRecord.status === 'completed'
  const canApprove = ['admin', 'manager'].includes(role)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/returns"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to returns
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">
              {returnRecord.return_number}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                isCompleted
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-amber-50 text-amber-700 ring-amber-200'
              }`}
            >
              {returnRecord.status.toUpperCase()}
            </span>
          </div>

          {isPending && canApprove && (
            <FinalizeReturnButton
              returnId={returnRecord.id}
              returnType={returnRecord.return_type}
            />
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Initiated on {fmtDate(returnRecord.created_at)}
        </p>
      </div>

      {isPending && !canApprove && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Pending Admin Approval
            </p>
            <p className="text-sm text-amber-700 mt-0.5">
              This return requires an admin or manager to review and finalize
              the refund/inventory changes.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Customer
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {returnRecord.customers?.name}
          </p>
          <p className="text-xs text-slate-500">
            {returnRecord.customers?.phone}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Original Invoice
          </p>
          <Link
            href={`/invoices/${returnRecord.invoice_id}`}
            className="mt-1 font-mono text-sm font-semibold text-brand-700 hover:underline block"
          >
            {returnRecord.invoices?.invoice_number}
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Return Type
          </p>
          <p className="mt-1 font-semibold capitalize text-slate-900">
            {returnRecord.return_type.replace('_', ' ')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total Refund Value
          </p>
          <p className="mt-1 text-xl font-bold text-rose-600">
            Rs. {fmtMoney(returnRecord.total_refund_amount)}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Items Being Returned
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-white border-b border-slate-200">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium text-slate-600">
                Item
              </th>
              <th className="px-5 py-2.5 text-left font-medium text-slate-600">
                Tag
              </th>
              <th className="px-5 py-2.5 text-left font-medium text-slate-600">
                Condition
              </th>
              <th className="px-5 py-2.5 text-right font-medium text-slate-600">
                Refund Amt
              </th>
            </tr>
          </thead>
          <tbody>
            {(returnRecord.return_items ?? []).map((item: any) => (
              <tr
                key={item.id}
                className="border-b border-slate-100 last:border-0"
              >
                <td className="px-5 py-3">
                  <p className="font-semibold text-slate-900">
                    {item.invoice_items?.item_description}
                  </p>
                  <p className="text-xs text-slate-500">
                    Net Wt:{' '}
                    {Number(item.inventory_items?.net_metal_weight_g || 0).toFixed(
                      3,
                    )}
                    g ·{' '}
                    {Number(item.inventory_items?.stone_carat_total || 0).toFixed(
                      3,
                    )}
                    ct
                  </p>
                </td>
                <td className="px-5 py-3 font-mono text-xs">
                  {item.inventory_items?.inventory_tag}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium ${
                      item.condition === 'good'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {item.condition === 'good' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {item.condition === 'good'
                      ? 'Restock to Inventory'
                      : 'Send to Melting'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right tabular font-semibold">
                  Rs. {fmtMoney(item.refund_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {returnRecord.return_type === 'exchange' &&
        Number(returnRecord.gold_given_weight_g) > 0 && (
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4" /> Gold Issued to Customer
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-amber-700 font-medium">Weight</p>
                <p className="text-lg font-bold text-amber-900">
                  {Number(returnRecord.gold_given_weight_g).toFixed(3)} g
                </p>
              </div>
              <div>
                <p className="text-xs text-amber-700 font-medium">Value</p>
                <p className="text-lg font-bold text-amber-900">
                  Rs. {fmtMoney(returnRecord.gold_given_value)}
                </p>
              </div>
              <div>
                <p className="text-xs text-amber-700 font-medium">Status</p>
                <p className="text-sm font-bold text-amber-900 mt-1">
                  {isCompleted ? 'Deducted from Vault' : 'Pending Deduction'}
                </p>
              </div>
            </div>
          </div>
        )}

      {returnRecord.notes && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Notes</p>
          <p className="mt-1 text-sm text-slate-700">{returnRecord.notes}</p>
        </div>
      )}

      {isCompleted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <p className="text-sm text-emerald-800">
            <strong>Approved & Finalized</strong> on{' '}
            {fmtDate(returnRecord.approved_at)}. Inventory and financials have
            been updated.
          </p>
        </div>
      )}
    </div>
  )
}