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
const startOfYear = () => `${new Date().getFullYear()}-01-01`
const today = () => new Date().toISOString().slice(0, 10)

export default async function PnLPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const from = sp.from ?? startOfYear()
  const to = sp.to ?? today()

  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [{ data: accounts }, { data: lines, error }] = await Promise.all([
    supabase
      .from('gl_accounts')
      .select('id, code, name, type')
      .in('type', ['revenue', 'expense'])
      .eq('is_active', true)
      .order('code'),
    supabase
      .from('journal_lines')
      .select(
        'account_id, debit, credit, journal_entries!inner(entry_date)',
      )
      .gte('journal_entries.entry_date', from)
      .lte('journal_entries.entry_date', to),
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

  type Row = { code: string; name: string; type: string; amount: number }
  const rows: Row[] = (accounts ?? []).map((a: any) => {
    const agg = byAccount.get(a.id) ?? { debit: 0, credit: 0 }
    // Revenue = credits − debits · Expense = debits − credits
    const amount =
      a.type === 'revenue' ? agg.credit - agg.debit : agg.debit - agg.credit
    return { code: a.code, name: a.name, type: a.type, amount }
  })

  const revenueRows = rows
    .filter((r) => r.type === 'revenue' && Math.abs(r.amount) > 0.005)
    .sort((a, b) => b.amount - a.amount)
  const expenseRows = rows
    .filter((r) => r.type === 'expense' && Math.abs(r.amount) > 0.005)
    .sort((a, b) => b.amount - a.amount)

  const totalRevenue = revenueRows.reduce((s, r) => s + r.amount, 0)
  const totalExpense = expenseRows.reduce((s, r) => s + r.amount, 0)
  const netProfit = totalRevenue - totalExpense
  const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profit &amp; Loss</h1>
        <p className="mt-1 text-sm text-slate-500">
          Period: {fmtDate(from)} → {fmtDate(to)}
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-500">From</label>
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
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply
        </button>
      </form>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Revenue" value={totalRevenue} tone="emerald" />
        <Stat label="Expenses" value={totalExpense} tone="rose" />
        <Stat
          label="Net Profit"
          value={netProfit}
          tone={netProfit >= 0 ? 'emerald' : 'rose'}
          sub={`${margin.toFixed(1)}% margin`}
          bold
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Section title="Revenue">
          {revenueRows.length === 0 ? (
            <EmptyRow />
          ) : (
            revenueRows.map((r) => (
              <RowLine
                key={r.code}
                code={r.code}
                name={r.name}
                amount={r.amount}
              />
            ))
          )}
          <TotalLine label="Total Revenue" amount={totalRevenue} />
        </Section>

        <Section title="Expenses">
          {expenseRows.length === 0 ? (
            <EmptyRow />
          ) : (
            expenseRows.map((r) => (
              <RowLine
                key={r.code}
                code={r.code}
                name={r.name}
                amount={r.amount}
              />
            ))
          )}
          <TotalLine label="Total Expenses" amount={totalExpense} />
        </Section>

        <div
          className={`flex items-center justify-between px-4 py-3 ${
            netProfit >= 0
              ? 'bg-emerald-50 text-emerald-900'
              : 'bg-rose-50 text-rose-900'
          }`}
        >
          <p className="text-sm font-bold uppercase tracking-wide">
            Net {netProfit >= 0 ? 'Profit' : 'Loss'}
          </p>
          <p className="font-mono text-xl font-bold tabular">
            ₹ {fmtMoney(Math.abs(netProfit))}
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Revenue is credits − debits on revenue accounts (contra-revenue like Sales
        Returns and Discounts appear as negatives). Expense is debits − credits on
        expense accounts.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
  sub,
  bold,
}: {
  label: string
  value: number
  tone: 'emerald' | 'rose'
  sub?: string
  bold?: boolean
}) {
  const cls =
    tone === 'emerald'
      ? 'text-emerald-700'
      : 'text-rose-700'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 tabular ${bold ? 'text-2xl font-bold' : 'text-xl font-semibold'} ${cls}`}>
        ₹ {fmtMoney(value)}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200 last:border-0">
      <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700">
        {title}
      </p>
      <div>{children}</div>
    </div>
  )
}

function RowLine({ code, name, amount }: { code: string; name: string; amount: number }) {
  const negative = amount < 0
  return (
    <div className="flex items-center justify-between border-b border-slate-50 px-4 py-1.5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-slate-500">{code}</span>
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

function TotalLine({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between bg-slate-50/70 px-4 py-2 font-semibold">
      <span className="text-sm text-slate-800">{label}</span>
      <span className="font-mono text-sm tabular">₹ {fmtMoney(amount)}</span>
    </div>
  )
}

function EmptyRow() {
  return (
    <p className="px-4 py-3 text-xs italic text-slate-400">
      No accounts with movement in this period.
    </p>
  )
}