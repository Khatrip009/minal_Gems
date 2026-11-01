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

const NATURAL_DEBIT = new Set(['asset', 'expense'])

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ as_of?: string }>
}) {
  const sp = await searchParams
  const asOf = sp.as_of ?? today()

  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [{ data: accounts }, { data: lines, error }] = await Promise.all([
    supabase
      .from('gl_accounts')
      .select('id, code, name, type, opening_balance')
      .eq('is_active', true)
      .in('type', ['asset', 'liability', 'equity', 'revenue', 'expense'])
      .order('code'),
    supabase
      .from('journal_lines')
      .select('account_id, debit, credit, journal_entries!inner(entry_date)')
      .lte('journal_entries.entry_date', asOf),
  ])

  if (error) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error.message}
      </div>
    )
  }

  const byAccount = new Map<string, { debit: number; credit: number }>()
  for (const l of lines ?? []) {
    const cur = byAccount.get(l.account_id) ?? { debit: 0, credit: 0 }
    cur.debit += Number(l.debit)
    cur.credit += Number(l.credit)
    byAccount.set(l.account_id, cur)
  }

  type BalanceRow = {
    code: string
    name: string
    type: string
    balance: number // signed: Dr positive, Cr negative
  }

  const rows: BalanceRow[] = (accounts ?? []).map((a: any) => {
    const agg = byAccount.get(a.id) ?? { debit: 0, credit: 0 }
    const glOpening = Number(a.opening_balance ?? 0)
    const balance = glOpening + agg.debit - agg.credit
    return { code: a.code, name: a.name, type: a.type, balance }
  })

  const assets = rows
    .filter((r) => r.type === 'asset' && Math.abs(r.balance) > 0.005)
    .sort((a, b) => a.code.localeCompare(b.code))
  const liabilities = rows
    .filter((r) => r.type === 'liability' && Math.abs(r.balance) > 0.005)
    .sort((a, b) => a.code.localeCompare(b.code))
  const equity = rows
    .filter((r) => r.type === 'equity' && Math.abs(r.balance) > 0.005)
    .sort((a, b) => a.code.localeCompare(b.code))

  // Revenue − Expense = Current Year P&L → goes into equity
  const revenue = rows
    .filter((r) => r.type === 'revenue')
    .reduce((s, r) => s + -r.balance, 0) // revenue is credit, so -balance = positive revenue
  const expense = rows
    .filter((r) => r.type === 'expense')
    .reduce((s, r) => s + r.balance, 0)
  const currentYearPL = revenue - expense

  const totalAssets = assets.reduce((s, r) => s + r.balance, 0)
  const totalLiabilities = -liabilities.reduce((s, r) => s + r.balance, 0)
  const totalEquity = -equity.reduce((s, r) => s + r.balance, 0) + currentYearPL
  const totalLiabEquity = totalLiabilities + totalEquity

  const balanced = Math.abs(totalAssets - totalLiabEquity) < 0.01

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Balance Sheet</h1>
        <p className="mt-1 text-sm text-slate-500">As of {fmtDate(asOf)}</p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-500">As of</label>
          <input
            type="date"
            name="as_of"
            defaultValue={asOf}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply
        </button>
      </form>

      {balanced ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <strong>Balanced.</strong> Assets = Liabilities + Equity = ₹{' '}
          {fmtMoney(totalAssets)}.
        </div>
      ) : (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <strong>Does not balance.</strong> Assets: ₹ {fmtMoney(totalAssets)} ·
          Liab+Equity: ₹ {fmtMoney(totalLiabEquity)} · Diff: ₹{' '}
          {fmtMoney(Math.abs(totalAssets - totalLiabEquity))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white">
          <SectionHeader label="Assets" total={totalAssets} />
          {assets.length === 0 ? (
            <p className="px-4 py-6 text-sm italic text-slate-400">No assets</p>
          ) : (
            assets.map((r) => (
              <Row
                key={r.code}
                code={r.code}
                name={r.name}
                amount={r.balance}
                negative={r.balance < 0}
              />
            ))
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <SectionHeader label="Liabilities" total={totalLiabilities} />
          {liabilities.length === 0 ? (
            <p className="px-4 py-6 text-sm italic text-slate-400">
              No liabilities
            </p>
          ) : (
            liabilities.map((r) => (
              <Row
                key={r.code}
                code={r.code}
                name={r.name}
                amount={-r.balance}
                negative={-r.balance < 0}
              />
            ))
          )}

          <SectionHeader label="Equity" total={totalEquity} />
          {equity.length === 0 && Math.abs(currentYearPL) < 0.005 ? (
            <p className="px-4 py-6 text-sm italic text-slate-400">
              No equity accounts
            </p>
          ) : (
            <>
              {equity.map((r) => (
                <Row
                  key={r.code}
                  code={r.code}
                  name={r.name}
                  amount={-r.balance}
                  negative={-r.balance < 0}
                />
              ))}
              {Math.abs(currentYearPL) > 0.005 && (
                <Row
                  code="P&L"
                  name="Current Year Profit/Loss (computed)"
                  amount={currentYearPL}
                  negative={currentYearPL < 0}
                />
              )}
            </>
          )}

          <div className="flex justify-between border-t-2 border-slate-300 bg-slate-100 px-4 py-3">
            <span className="text-sm font-bold uppercase tracking-wide text-slate-800">
              Total Liabilities + Equity
            </span>
            <span className="font-mono text-base font-bold tabular">
              ₹ {fmtMoney(totalLiabEquity)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Current Year Profit/Loss = (Revenue − Expenses) for all periods up to{' '}
        {fmtDate(asOf)}. If this report does not balance, the Trial Balance will
        also be off — check for unbalanced journal entries first.
      </p>
    </div>
  )
}

function SectionHeader({ label, total }: { label: string; total: number }) {
  return (
    <div className="flex justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-700">
        {label}
      </span>
      <span className="font-mono text-sm font-semibold tabular">
        ₹ {fmtMoney(total)}
      </span>
    </div>
  )
}

function Row({
  code,
  name,
  amount,
  negative,
}: {
  code: string
  name: string
  amount: number
  negative: boolean
}) {
  return (
    <div className="flex justify-between border-b border-slate-50 px-4 py-1.5 last:border-0 hover:bg-slate-50/50">
      <div className="flex items-center gap-2">
        <span className="w-12 font-mono text-xs text-slate-500">{code}</span>
        <span className="text-sm text-slate-800">{name}</span>
      </div>
      <span
        className={`font-mono text-sm tabular ${
          negative ? 'text-rose-600' : 'text-slate-900'
        }`}
      >
        {negative ? `(${fmtMoney(Math.abs(amount))})` : fmtMoney(amount)}
      </span>
    </div>
  )
}