import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { RepairActions } from './repair-actions'
import { ArrowLeft, User, Wrench, Receipt, ExternalLink } from 'lucide-react'

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

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole([
    'admin',
    'manager',
    'sales',
    'accountant',
  ])

  const { data: job, error } = await supabase
    .from('craftsman_jobs')
    .select(
      '*, customers(name, phone), craftsmen(name), invoices(id, invoice_number, status, total, amount_paid, balance)',
    )
    .eq('id', id)
    .single()

  if (error || !job) {
    console.error('Repair Job fetch error:', error)
    notFound()
  }

  const [{ data: allCraftsmen }, { data: paymentsData }] = await Promise.all([
    supabase
      .from('craftsmen')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('craftsman_job_payments')
      .select('*')
      .eq('job_id', id)
      .is('voided_at', null)
      .order('payment_date', { ascending: false }),
  ])

  const payments = paymentsData ?? []
  const alreadyPaid = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
  const revenue = Number(job.making_charge_amount || 0)
  const expense = Number(job.craftsman_cost_amount || 0)
  const profit = revenue - expense
  const invoice = Array.isArray(job.invoices) ? job.invoices[0] : job.invoices

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/repairs"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to repairs
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="font-mono text-2xl font-semibold flex items-center gap-3">
              {job.job_number}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ring-1 ring-inset ${
                  job.status === 'pending'
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : job.status === 'in_progress'
                      ? 'bg-sky-50 text-sky-700 ring-sky-200'
                      : job.status === 'completed'
                        ? 'bg-purple-50 text-purple-700 ring-purple-200'
                        : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                }`}
              >
                {job.status.replace('_', ' ')}
              </span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Intake Date: {fmtDate(job.created_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User className="h-4 w-4" /> Customer & Item
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Customer</p>
                <p className="font-semibold text-slate-900">
                  {job.customers?.name}
                </p>
                <p className="text-xs text-slate-600">{job.customers?.phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Item Description</p>
                <p className="font-medium text-slate-900">
                  {job.item_description}
                </p>
                {job.inventory_item_id && (
                  <Link
                    href={`/inventory/${job.inventory_item_id}`}
                    className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    View Original Piece <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Intake Weight</p>
                <p className="font-medium text-slate-900">
                  {Number(job.intake_weight_g).toFixed(3)} g
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Intake Stones</p>
                <p className="font-medium text-slate-900">
                  {job.intake_stone_pcs} pcs ·{' '}
                  {Number(job.intake_stone_carat).toFixed(3)} ct
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Due Date</p>
                <p className="font-medium text-slate-900">
                  {fmtDate(job.due_date)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Job Progress & Financials
            </h2>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Assigned Craftsman</span>
                <span className="font-medium text-slate-900">
                  {job.craftsmen?.name ?? 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Final Weight Returned</span>
                <span className="font-medium text-slate-900">
                  {job.returned_fine_g
                    ? `${Number(job.returned_fine_g).toFixed(3)} g`
                    : '—'}
                </span>
              </div>

              <div className="bg-slate-50 rounded-lg p-3 space-y-2 mt-2">
                <div className="flex justify-between text-slate-600">
                  <span>Customer Charge (Revenue)</span>
                  <span className="font-semibold">Rs. {fmtMoney(revenue)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Craftsman Cost (Expense)</span>
                  <span className="font-semibold text-rose-600">
                    - Rs. {fmtMoney(expense)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                  <span>Profit Margin</span>
                  <span className="text-emerald-600">Rs. {fmtMoney(profit)}</span>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Craftsman Paid</span>
                <span className="font-medium">
                  Rs. {fmtMoney(alreadyPaid)} of Rs. {fmtMoney(expense)}
                  {alreadyPaid >= expense - 0.01 && expense > 0 && (
                    <span className="ml-2 text-emerald-600 font-semibold">
                      ✓ Fully paid
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {invoice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">
                    Invoice Generated
                  </p>
                  <p className="text-xs text-emerald-700">
                    {invoice.invoice_number} · Rs.{' '}
                    {fmtMoney(invoice.total)} ·{' '}
                    {invoice.status === 'voided'
                      ? 'Voided'
                      : Number(invoice.balance) < 0.01
                        ? 'Paid'
                        : 'Unpaid'}
                  </p>
                </div>
              </div>
              <Link href={`/invoices/${invoice.id}`}>
                <button className="text-sm font-semibold text-emerald-700 hover:underline">
                  View Invoice →
                </button>
              </Link>
            </div>
          )}
        </div>

        <div>
          <RepairActions
            job={job}
            allCraftsmen={allCraftsmen ?? []}
            alreadyPaid={alreadyPaid}
          />
        </div>
      </div>
    </div>
  )
} 