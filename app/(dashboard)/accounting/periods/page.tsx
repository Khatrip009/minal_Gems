import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { CheckCircle2, Lock, FileLock2 } from 'lucide-react'

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

export default async function PeriodsPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [{ data: periods }, { data: entries, error }] = await Promise.all([
    supabase
      .from('accounting_periods')
      .select('period_year, period_month, status, locked_at, locked_by, notes')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false }),
    supabase
      .from('journal_entries')
      .select(
        'entry_date, journal_lines(debit, credit)',
      ),
  ])

  if (error) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error.message}
      </div>
    )
  }

  // Group entries by period
  const byPeriod = new Map<string, { debit: number; credit: number; count: number }>()
  for (const e of entries ?? []) {
    const [y, m] = (e.entry_date as string).split('-').slice(0, 2)
    const key = `${y}-${m}`
    const cur = byPeriod.get(key) ?? { debit: 0, credit: 0, count: 0 }
    for (const l of (e as any).journal_lines ?? []) {
      cur.debit += Number(l.debit)
      cur.credit += Number(l.credit)
    }
    cur.count += 1
    byPeriod.set(key, cur)
  }

  const now = new Date()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accounting Periods</h1>
        <p className="mt-1 text-sm text-slate-500">
          Monthly close / lock state · one row per month
        </p>
      </div>

      {(periods ?? []).length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">No periods seeded</p>
          <p className="mt-1 text-xs">
            Run the seed SQL from the setup message to populate
            <code className="mx-1 rounded bg-white px-1">accounting_periods</code>{' '}
            for all months that have journal activity, plus the current month
            and next 3.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Period
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Status
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Entries
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Total Debit
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Total Credit
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Balanced
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Locked
              </th>
            </tr>
          </thead>
          <tbody>
            {(periods ?? []).length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No periods found.
                </td>
              </tr>
            )}
            {(periods ?? []).map((p: any) => {
              const label = new Date(
                p.period_year,
                p.period_month - 1,
                1,
              ).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
              const key = `${p.period_year}-${String(p.period_month).padStart(2, '0')}`
              const agg = byPeriod.get(key) ?? { debit: 0, credit: 0, count: 0 }
              const diff = agg.debit - agg.credit
              const isCurrent =
                p.period_year === now.getFullYear() &&
                p.period_month === now.getMonth() + 1
              return (
                <tr
                  key={`${p.period_year}-${p.period_month}`}
                  className={`border-b border-slate-100 last:border-0 ${
                    isCurrent ? 'bg-brand-50/30' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-slate-800">
                    {label}
                    {isCurrent && (
                      <span className="ml-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
                        current
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2 text-right tabular">{agg.count}</td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtMoney(agg.debit)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtMoney(agg.credit)}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {agg.count === 0 ? (
                      <span className="text-slate-400">no data</span>
                    ) : Math.abs(diff) < 0.01 ? (
                      <span className="text-emerald-700">✓ balanced</span>
                    ) : (
                      <span className="text-rose-700">
                        Δ {fmtMoney(diff)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {p.locked_at ? (
                      <>
                        {fmtDate(p.locked_at)}
                        <Link
                          href={`/accounting/journal?from=${key}-01&to=${key}-31`}
                          className="ml-2 text-brand-700 hover:underline"
                        >
                          view
                        </Link>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Locking a period prevents new entries dated within that month from being
        posted by the RPCs (the check is inside each posting function). Lock and
        unlock actions will be added once the audit-log integration is ready.
      </p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'open') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Open
      </span>
    )
  }
  if (status === 'locked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
        <Lock className="h-3 w-3" /> Locked
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 ring-1 ring-inset ring-slate-200">
      <FileLock2 className="h-3 w-3" /> Closed
    </span>
  )
}