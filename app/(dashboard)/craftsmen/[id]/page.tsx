import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { KycForm } from './kyc-form'
import { RecordPaymentDialog } from './record-payment-dialog'
import { PaymentsTable } from './payments-table'
import { User, Wallet, ListChecks, AlertTriangle } from 'lucide-react'

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

export default async function CraftsmanDetailPage({
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

  const [
    { data: craftsman, error },
    { data: balance, error: balanceError },
    { data: jobs, error: jobsError },
    { data: payments, error: paymentsError },
    { data: designs },
  ] = await Promise.all([
    supabase.from('craftsmen').select('*').eq('id', id).single(),
    supabase
      .from('v_craftsman_balances')
      .select('*')
      .eq('craftsman_id', id)
      .maybeSingle(),
    supabase
      .from('v_craftsman_job_balances')
      .select('*')
      .eq('craftsman_id', id)
      .order('completed_at', { ascending: false }),
    supabase
      .from('craftsman_job_payments')
      .select('*')
      .eq('craftsman_id', id)
      .order('payment_date', { ascending: false }),
    supabase.from('product_designs').select('id, name, design_code'),
  ])

  if (error || !craftsman) notFound()

  // ── Guard: if any view or payments query failed, surface it clearly
  // instead of silently rendering ₹0.00 across the page.
  const queryErrors = [
    { name: 'v_craftsman_balances', error: balanceError },
    { name: 'v_craftsman_job_balances', error: jobsError },
    { name: 'craftsman_job_payments', error: paymentsError },
  ].filter((x): x is { name: string; error: NonNullable<typeof x.error> } =>
    Boolean(x.error),
  )

  if (queryErrors.length > 0) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-900">
                Craftsman ledger could not be loaded
              </p>
              <p className="mt-1 text-sm text-rose-800">
                One or more database queries failed. This is usually a missing
                view or column — run the payments setup SQL (views + schema)
                again, then reload.
              </p>
              <ul className="mt-3 space-y-1.5">
                {queryErrors.map((qe) => (
                  <li
                    key={qe.name}
                    className="rounded bg-white/70 px-2 py-1.5 text-xs"
                  >
                    <span className="font-mono font-semibold text-rose-900">
                      {qe.name}
                    </span>
                    <span className="ml-2 text-rose-800">
                      {qe.error.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <Link
          href="/craftsmen"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to craftsmen
        </Link>
      </div>
    )
  }

  // For payment history job links
  const jobNumberById: Record<string, string> = Object.fromEntries(
    (jobs ?? []).map((j) => [j.job_id, j.job_number]),
  )

  // For jobs table design names — fetch designs to show the design for each job
  const designMap: Record<string, { name: string; code: string }> =
    Object.fromEntries(
      (designs ?? []).map((d) => [d.id, { name: d.name, code: d.design_code }]),
    )

  // Fetch full job rows to know which design each completed job is for
  const { data: jobRows } = await supabase
    .from('craftsman_jobs')
    .select('id, design_id')
    .eq('craftsman_id', id)

  const jobDesignMap: Record<string, string | null> = Object.fromEntries(
    (jobRows ?? []).map((j) => [j.id, j.design_id]),
  )

  const totalEarnings = Number(balance?.total_earnings ?? 0)
  const totalPaid = Number(balance?.total_paid ?? 0)
  const outstanding = Number(balance?.balance ?? 0)
  const settled = Math.abs(outstanding) < 0.01

  const jobOptions = (jobs ?? [])
    .filter((j) => Number(j.balance) > 0.01)
    .map((j) => ({
      id: j.job_id as string,
      job_number: String(j.job_number),
      balance: Number(j.balance),
    }))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/craftsmen" className="text-sm text-slate-500 hover:underline">
          ← Back to craftsmen
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{craftsman.name}</h1>
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">
              {craftsman.code}
            </span>
            {craftsman.is_inhouse && (
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                In-house
              </span>
            )}
            {!craftsman.is_active && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
                Inactive
              </span>
            )}
          </div>
          {!settled && jobOptions.length > 0 && (
            <RecordPaymentDialog
              craftsmanId={craftsman.id}
              craftsmanName={craftsman.name}
              jobs={jobOptions}
            />
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {craftsman.phone ?? '—'}
          {craftsman.skill_type && ` · ${craftsman.skill_type}`}
        </p>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total earned
          </p>
          <p className="mt-1 tabular text-2xl font-semibold text-slate-900">
            ₹ {fmtMoney(totalEarnings)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            from {balance?.completed_jobs ?? 0} completed job
            {Number(balance?.completed_jobs ?? 0) === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total paid
          </p>
          <p className="mt-1 tabular text-2xl font-semibold text-emerald-700">
            ₹ {fmtMoney(totalPaid)}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            on jobs ₹{fmtMoney(balance?.total_paid_on_jobs ?? 0)} · advances ₹
            {fmtMoney(balance?.total_advances ?? 0)}
          </p>
        </div>
        <div
          className={`rounded-xl border p-5 ${
            settled
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          }`}
        >
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              settled ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {settled ? 'All settled' : 'Outstanding balance'}
          </p>
          <p
            className={`mt-1 tabular text-2xl font-semibold ${
              settled ? 'text-emerald-900' : 'text-amber-900'
            }`}
          >
            ₹ {fmtMoney(outstanding)}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              settled ? 'text-emerald-700' : 'text-amber-700'
            }`}
          >
            {settled
              ? '✓ No pending amount'
              : `${jobOptions.length} job${jobOptions.length === 1 ? '' : 's'} pending payment`}
          </p>
        </div>
      </div>

      {/* Jobs — per-job payment status */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Jobs</h2>
          <span className="text-xs text-slate-500">
            · {(jobs ?? []).length} completed
          </span>
        </div>
        {(jobs ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No completed jobs yet. Complete a job to create an earning.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Job
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Design
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Completed
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Earned
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Paid
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Balance
                  </th>
                  <th className="w-1 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {(jobs ?? []).map((j) => {
                  const jBalance = Number(j.balance)
                  const settledRow = Math.abs(jBalance) < 0.01
                  const designId = jobDesignMap[j.job_id]
                  const design = designId ? designMap[designId] : null
                  return (
                    <tr
                      key={j.job_id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">
                        <Link
                          href={`/jobs/${j.job_id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {j.job_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        {design ? (
                          <div>
                            <div className="text-slate-900">{design.name}</div>
                            <div className="font-mono text-xs text-slate-500">
                              {design.code}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {fmtDate(j.completed_at)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        ₹ {fmtMoney(j.earnings)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular text-emerald-700">
                        ₹ {fmtMoney(j.total_paid)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular font-semibold ${
                          settledRow ? 'text-slate-400' : 'text-amber-700'
                        }`}
                      >
                        {settledRow ? '✓ settled' : `₹ ${fmtMoney(jBalance)}`}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {!settledRow && (
                          <RecordPaymentDialog
                            craftsmanId={craftsman.id}
                            craftsmanName={craftsman.name}
                            jobs={jobOptions}
                            presetJobId={j.job_id as string}
                            presetAmount={jBalance}
                            variant="outline"
                            size="sm"
                            label="Pay"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments history */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Payments</h2>
          <span className="text-xs text-slate-500">
            · {(payments ?? []).length} entr
            {(payments ?? []).length === 1 ? 'y' : 'ies'}
          </span>
        </div>
        <PaymentsTable
          payments={(payments ?? []).map((p) => ({
            id: p.id,
            amount: p.amount,
            payment_date: p.payment_date,
            payment_method: p.payment_method,
            reference: p.reference,
            notes: p.notes,
            job_id: p.job_id,
            voided_at: p.voided_at,
            void_reason: p.void_reason,
            created_at: p.created_at,
          }))}
          jobNumberById={jobNumberById}
        />
      </div>

      {/* KYC (existing) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <User className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">KYC</h2>
        </div>
        <KycForm
          craftsmanId={craftsman.id}
          initial={(craftsman.kyc as Record<string, unknown>) ?? {}}
        />
      </div>
    </div>
  )
}