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
const startOfYear = () => `${new Date().getFullYear()}-01-01`

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const accountId = sp.account ?? ''
  const from = sp.from ?? startOfYear()
  const to = sp.to ?? today()

  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const { data: accounts } = await supabase
    .from('gl_accounts')
    .select('id, code, name, type, opening_balance, is_cash, is_bank')
    .eq('is_active', true)
    .order('code')

  const currentAccount = accountId
    ? (accounts ?? []).find((a: any) => a.id === accountId)
    : null

  // Prior opening (before `from`)
  let priorOpening = 0
  if (accountId) {
    const { data: prior } = await supabase
      .from('journal_lines')
      .select('debit, credit, journal_entries!inner(entry_date)')
      .eq('account_id', accountId)
      .lt('journal_entries.entry_date', from)
    for (const l of prior ?? []) {
      priorOpening += Number(l.debit) - Number(l.credit)
    }
    priorOpening += Number(currentAccount?.opening_balance ?? 0)
  }

  type Line = {
    id: string
    entry_id: string
    entry_number: string | null
    entry_date: string
    entry_created_at: string | null
    reference_type: string | null
    reference_id: string | null
    description: string | null
    entry_description: string | null
    party_type: string | null
    party_id: string | null
    debit: number
    credit: number
  }

  let lines: Line[] = []
  let queryError: string | null = null

  if (accountId) {
    const { data, error } = await supabase
      .from('journal_lines')
      .select(
        `
        id, debit, credit, party_type, party_id, description,
        journal_entries!inner(
          id, entry_number, entry_date, reference_type, reference_id,
          description, created_at
        )
      `,
      )
      .eq('account_id', accountId)
      .gte('journal_entries.entry_date', from)
      .lte('journal_entries.entry_date', to)

    if (error) {
      console.error('[ledger] query failed:', error)
      queryError = error.message
    } else {
      lines = (data ?? [])
        .map((row: any) => {
          const je = row.journal_entries
          if (!je) return null
          return {
            id: row.id as string,
            entry_id: je.id as string,
            entry_number: je.entry_number as string | null,
            entry_date: je.entry_date as string,
            entry_created_at: je.created_at as string | null,
            reference_type: je.reference_type as string | null,
            reference_id: je.reference_id as string | null,
            description: row.description as string | null,
            entry_description: je.description as string | null,
            party_type: row.party_type as string | null,
            party_id: row.party_id as string | null,
            debit: Number(row.debit),
            credit: Number(row.credit),
          }
        })
        .filter((x): x is Line => x !== null)
        .sort((a, b) => {
          const d = a.entry_date.localeCompare(b.entry_date)
          if (d !== 0) return d
          const ca = a.entry_created_at ?? ''
          const cb = b.entry_created_at ?? ''
          const c = ca.localeCompare(cb)
          if (c !== 0) return c
          return a.id.localeCompare(b.id)
        })
    }
  }

  // Running balance
  let running = priorOpening
  const withRunning = lines.map((l) => {
    running += l.debit - l.credit
    return { ...l, running }
  })

  const periodDebit = lines.reduce((s, l) => s + l.debit, 0)
  const periodCredit = lines.reduce((s, l) => s + l.credit, 0)
  const closing = priorOpening + periodDebit - periodCredit

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Account Ledger</h1>
        <p className="mt-1 text-sm text-slate-500">
          Running balance for a single GL account across a date range
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-500">
            Account
          </label>
          <select
            name="account"
            defaultValue={accountId}
            className="mt-1 w-80 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">— Select account —</option>
            {(accounts ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </div>
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
          View
        </button>
      </form>

      {queryError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <strong>Query failed:</strong> {queryError}
        </div>
      )}

      {!currentAccount && !queryError && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Select an account above to see its ledger.
        </div>
      )}

      {currentAccount && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Account
              </p>
              <p className="mt-1 font-mono text-sm">{currentAccount.code}</p>
              <p className="text-sm text-slate-700">{currentAccount.name}</p>
              <p className="text-[10px] uppercase text-slate-400">
                {currentAccount.type}
                {currentAccount.is_cash ? ' · cash' : ''}
                {currentAccount.is_bank ? ' · bank' : ''}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Opening
              </p>
              <p className="mt-1 text-xl font-semibold tabular">
                {fmtMoney(priorOpening)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Period movement
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Dr {fmtMoney(periodDebit)}
              </p>
              <p className="text-xs text-slate-600">
                Cr {fmtMoney(periodCredit)}
              </p>
              <p className="mt-1 text-xl font-semibold tabular">
                {fmtMoney(periodDebit - periodCredit)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Closing
              </p>
              <p className="mt-1 text-xl font-semibold tabular text-brand-700">
                {fmtMoney(closing)}
              </p>
            </div>
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
                    Reference / Narrative
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Debit
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Credit
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <td
                    colSpan={5}
                    className="px-4 py-1.5 text-xs uppercase text-slate-500"
                  >
                    Opening balance
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono font-semibold tabular">
                    {fmtMoney(priorOpening)}
                  </td>
                </tr>
                {withRunning.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No postings for this account in the selected range.
                    </td>
                  </tr>
                )}
                {withRunning.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                      {fmtDate(l.entry_date)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link
                        href={`/accounting/journal/${l.entry_id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {l.entry_number ?? l.entry_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      <p className="text-xs">{l.entry_description ?? '—'}</p>
                      {l.description && (
                        <p className="text-[10px] text-slate-500">
                          {l.description}
                        </p>
                      )}
                      {l.party_type && (
                        <p className="text-[10px] text-slate-400">
                          Party: {l.party_type} ·{' '}
                          {l.party_id ? String(l.party_id).slice(0, 8) : '—'}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular">
                      {l.debit === 0 ? '—' : fmtMoney(l.debit)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular">
                      {l.credit === 0 ? '—' : fmtMoney(l.credit)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold tabular">
                      {fmtMoney(l.running)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td
                    colSpan={3}
                    className="px-4 py-2 text-right text-xs uppercase text-slate-500"
                  >
                    Period totals
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtMoney(periodDebit)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtMoney(periodCredit)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular text-brand-700">
                    {fmtMoney(closing)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}