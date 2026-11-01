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

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const sp = await searchParams
  const from = sp.from ?? startOfMonth()
  const to = sp.to ?? today()

  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [{ data: accounts }, { data: lines, error }] = await Promise.all([
    supabase
      .from('gl_accounts')
      .select('id, code, name, type, is_cash, is_bank'),
    supabase
      .from('journal_lines')
      .select(
        `
        id, account_id, debit, credit,
        journal_entries!inner(entry_date, entry_number, description, id)
      `,
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

  const accountById = new Map(
    (accounts ?? []).map((a: any) => [a.id, a]),
  )

  // Group postings by journal_entry_id — for each cash-affecting entry, find
  // the counterpart accounts (the non-cash lines in the same entry)
  const byEntry = new Map<string, any[]>()
  for (const l of lines ?? []) {
    const id = (l.journal_entries as any)?.id
    if (!id) continue
    const arr = byEntry.get(id) ?? []
    arr.push(l)
    byEntry.set(id, arr)
  }

  type CashLine = {
    date: string
    entry_number: string | null
    entry_id: string
    description: string | null
    cashAccount: string
    counterpart: string
    amount: number // +in, −out
  }

  const cashLines: CashLine[] = []
  let openingCash = 0
  let periodIn = 0
  let periodOut = 0

  for (const entryLines of byEntry.values()) {
    const cashRows = entryLines.filter((l: any) => {
      const acc = accountById.get(l.account_id) as any
      return acc?.is_cash || acc?.is_bank
    })
    if (cashRows.length === 0) continue

    const nonCashRows = entryLines.filter((l: any) => {
      const acc = accountById.get(l.account_id) as any
      return !acc?.is_cash && !acc?.is_bank
    })

    for (const cashRow of cashRows) {
      const acc = accountById.get(cashRow.account_id) as any
      const delta = Number(cashRow.debit) - Number(cashRow.credit)
      const counterparts =
        nonCashRows
          .map((l: any) => {
            const a = accountById.get(l.account_id) as any
            return a ? `${a.code} ${a.name}` : l.account_id
          })
          .join(', ') || '—'

      cashLines.push({
        date: (cashRow.journal_entries as any)?.entry_date,
        entry_number: (cashRow.journal_entries as any)?.entry_number,
        entry_id: (cashRow.journal_entries as any)?.id,
        description: (cashRow.journal_entries as any)?.description,
        cashAccount: `${acc.code} ${acc.name}`,
        counterpart: counterparts,
        amount: delta,
      })

      if (delta > 0) periodIn += delta
      else periodOut += Math.abs(delta)
    }
  }

  // Opening balance = all cash/bank postings before `from`
  const { data: priorLines } = await supabase
    .from('journal_lines')
    .select(
      'account_id, debit, credit, journal_entries!inner(entry_date)',
    )
    .lt('journal_entries.entry_date', from)
  for (const l of priorLines ?? []) {
    const acc = accountById.get(l.account_id) as any
    if (!acc?.is_cash && !acc?.is_bank) continue
    openingCash += Number(l.debit) - Number(l.credit)
  }

  cashLines.sort((a, b) => a.date.localeCompare(b.date))

  const netMovement = periodIn - periodOut
  const closingCash = openingCash + netMovement

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cash Flow</h1>
        <p className="mt-1 text-sm text-slate-500">
          Movement on cash and bank accounts · {fmtDate(from)} → {fmtDate(to)}
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Opening" value={openingCash} />
        <Stat label="Inflow" value={periodIn} tone="emerald" />
        <Stat label="Outflow" value={periodOut} tone="rose" />
        <Stat label="Closing" value={closingCash} bold />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Date
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Entry
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Cash account
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Counterpart
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Description
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {cashLines.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No cash movements in this period.
                </td>
              </tr>
            )}
            {cashLines.map((l, i) => (
              <tr
                key={`${l.entry_id}-${i}`}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
              >
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                  {fmtDate(l.date)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  <Link
                    href={`/accounting/journal/${l.entry_id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {l.entry_number ?? l.entry_id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-700">{l.cashAccount}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {l.counterpart}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {l.description ?? '—'}
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono tabular ${
                    l.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {l.amount >= 0 ? '+' : '−'} {fmtMoney(Math.abs(l.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Simple cash book — every entry touching a cash or bank account, showing
        its counterpart accounts. GAAP cash flow categorization (operating vs
        investing vs financing) will come in a later pass once
        <code className="mx-1 rounded bg-slate-100 px-1 text-[10px]">
          gl_accounts
        </code>
        gains a cash-flow category column.
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
  tone?: 'emerald' | 'rose'
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