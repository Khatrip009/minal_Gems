import { Fragment } from 'react'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'

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

const TYPE_ORDER: Record<string, number> = {
  asset: 1,
  liability: 2,
  equity: 3,
  revenue: 4,
  expense: 5,
}
const TYPE_LABEL: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
}
const NATURAL_DEBIT = new Set(['asset', 'expense'])

type Agg = { debit: number; credit: number }

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string
    to?: string
    type?: string
    show_zero?: string
  }>
}) {
  const sp = await searchParams
  const from = sp.from ?? startOfMonth()
  const to = sp.to ?? today()
  const typeFilter = sp.type ?? ''
  const showZero = sp.show_zero === '1'

  const { supabase } = await requireRole([
    'admin',
    'manager',
    'accountant',
  ])

  const { data: accounts, error: accErr } = await supabase
    .from('gl_accounts')
    .select('id, code, name, type, opening_balance, parent_id, is_active')
    .eq('is_active', true)
    .order('code')

  if (accErr) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        gl_accounts load failed: {accErr.message}
      </div>
    )
  }

  const { data: priorLines } = await supabase
    .from('journal_lines')
    .select('account_id, debit, credit, journal_entries!inner(entry_date)')
    .lt('journal_entries.entry_date', from)

  const { data: rangeLines } = await supabase
    .from('journal_lines')
    .select('account_id, debit, credit, journal_entries!inner(entry_date)')
    .gte('journal_entries.entry_date', from)
    .lte('journal_entries.entry_date', to)

  const priorByAccount = new Map<string, Agg>()
  for (const l of priorLines ?? []) {
    const cur = priorByAccount.get(l.account_id) ?? { debit: 0, credit: 0 }
    cur.debit += Number(l.debit)
    cur.credit += Number(l.credit)
    priorByAccount.set(l.account_id, cur)
  }

  const rangeByAccount = new Map<string, Agg>()
  for (const l of rangeLines ?? []) {
    const cur = rangeByAccount.get(l.account_id) ?? { debit: 0, credit: 0 }
    cur.debit += Number(l.debit)
    cur.credit += Number(l.credit)
    rangeByAccount.set(l.account_id, cur)
  }

  type Row = {
    id: string
    code: string
    name: string
    type: string
    opening: number
    debit: number
    credit: number
    closing: number
  }

  const rows: Row[] = (accounts ?? []).map((a: any) => {
    const prior = priorByAccount.get(a.id) ?? { debit: 0, credit: 0 }
    const range = rangeByAccount.get(a.id) ?? { debit: 0, credit: 0 }
    const glOpening = Number(a.opening_balance ?? 0)
    const opening = glOpening + prior.debit - prior.credit
    const closing = opening + range.debit - range.credit
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      opening,
      debit: range.debit,
      credit: range.credit,
      closing,
    }
  })

  const filtered = rows.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false
    if (
      !showZero &&
      Math.abs(r.opening) < 0.005 &&
      r.debit === 0 &&
      r.credit === 0
    ) {
      return false
    }
    return true
  })

  const byType = new Map<string, Row[]>()
  for (const r of filtered) {
    const arr = byType.get(r.type) ?? []
    arr.push(r)
    byType.set(r.type, arr)
  }
  const orderedTypes = Array.from(byType.keys()).sort(
    (a, b) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99),
  )

  let totalDebit = 0
  let totalCredit = 0
  let totalClosing = 0
  for (const r of filtered) {
    totalDebit += r.debit
    totalCredit += r.credit
    totalClosing += r.closing
  }

  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Trial Balance</h1>
          <p className="mt-1 text-sm text-slate-500">
            Period: {fmtDate(from)} → {fmtDate(to)} · Opening = GL opening + all
            postings before start date
          </p>
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
          <label className="block text-xs font-medium text-slate-500">
            To
          </label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">
            Type
          </label>
          <select
            name="type"
            defaultValue={typeFilter}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="asset">Assets</option>
            <option value="liability">Liabilities</option>
            <option value="equity">Equity</option>
            <option value="revenue">Revenue</option>
            <option value="expense">Expenses</option>
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            name="show_zero"
            value="1"
            defaultChecked={showZero}
            className="rounded border-slate-300"
          />
          Show zero-balance accounts
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply
        </button>
        <Link
          href="/accounting/trial-balance"
          className="text-sm text-slate-500 hover:underline"
        >
          Reset
        </Link>
      </form>

      {balanced ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <strong>Books are balanced.</strong> Total debits = total credits = ₹{' '}
          {fmtMoney(totalDebit)}.
        </div>
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <strong>Books DO NOT balance.</strong> Debits: ₹ {fmtMoney(totalDebit)}{' '}
          · Credits: ₹ {fmtMoney(totalCredit)} · Difference: ₹{' '}
          {fmtMoney(Math.abs(totalDebit - totalCredit))}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Code
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Account
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Opening
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Debit
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Credit
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Closing
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No accounts match your filters.
                </td>
              </tr>
            )}

            {orderedTypes.map((type) => {
              const groupRows = byType.get(type) ?? []
              const groupDebit = groupRows.reduce((s, r) => s + r.debit, 0)
              const groupCredit = groupRows.reduce((s, r) => s + r.credit, 0)
              return (
                <Fragment key={type}>
                  <tr className="bg-slate-100/70">
                    <td
                      colSpan={6}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700"
                    >
                      {TYPE_LABEL[type] ?? type}
                    </td>
                  </tr>
                  {groupRows.map((r) => {
                    const naturalDebit = NATURAL_DEBIT.has(r.type)
                    const closingStr =
                      Math.abs(r.closing) < 0.005
                        ? '—'
                        : `${fmtMoney(Math.abs(r.closing))} ${
                            r.closing > 0
                              ? naturalDebit
                                ? 'Dr'
                                : 'Dr'
                              : naturalDebit
                                ? 'Cr'
                                : 'Cr'
                          }`
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-2 font-mono text-xs text-slate-600">
                          <Link
                            href={`/accounting/ledger?account=${r.id}&from=${from}&to=${to}`}
                            className="hover:text-brand-700 hover:underline"
                          >
                            {r.code}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-slate-800">{r.name}</td>
                        <td className="px-4 py-2 text-right font-mono tabular">
                          {Math.abs(r.opening) < 0.005
                            ? '—'
                            : `${fmtMoney(Math.abs(r.opening))} ${
                                r.opening > 0 ? 'Dr' : 'Cr'
                              }`}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular">
                          {r.debit === 0 ? '—' : fmtMoney(r.debit)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular">
                          {r.credit === 0 ? '—' : fmtMoney(r.credit)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold tabular">
                          {closingStr}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-b-2 border-slate-300 bg-slate-50/80 font-semibold">
                    <td
                      colSpan={3}
                      className="px-4 py-1.5 text-right text-xs uppercase text-slate-500"
                    >
                      Subtotal · {TYPE_LABEL[type]}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular">
                      {fmtMoney(groupDebit)}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular">
                      {fmtMoney(groupCredit)}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular">
                      {fmtMoney(groupDebit - groupCredit)}
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white">
              <td
                colSpan={3}
                className="px-4 py-3 text-right text-xs uppercase tracking-wide"
              >
                Grand Total
              </td>
              <td className="px-4 py-3 text-right font-mono text-base font-bold tabular">
                {fmtMoney(totalDebit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-base font-bold tabular">
                {fmtMoney(totalCredit)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-base font-bold tabular">
                {fmtMoney(totalClosing)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Debits on the left, credits on the right. Closing balances marked Dr for
        debit-natural accounts (assets, expenses) and Cr for credit-natural
        (liabilities, equity, revenue). Click any code to open its ledger.
      </p>
    </div>
  )
}