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
const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default async function JournalRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string
    to?: string
    reference_type?: string
    voucher_type?: string
  }>
}) {
  const sp = await searchParams
  const from = sp.from ?? startOfMonth()
  const to = sp.to ?? today()
  const refType = sp.reference_type ?? ''
  const voucherType = sp.voucher_type ?? ''

  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  let query = supabase
    .from('journal_entries')
    .select(
      `
      id, entry_date, entry_number, reference_type, reference_id,
      description, voucher_type, event_type, is_reversal, is_locked,
      created_at,
      journal_lines (debit, credit)
    `,
    )
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (refType) query = query.eq('reference_type', refType)
  if (voucherType) query = query.eq('voucher_type', voucherType)

  const { data: entries, error } = await query

  if (error) {
    return (
      <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {error.message}
      </div>
    )
  }

  const enriched = (entries ?? []).map((e: any) => {
    const totalDebit = (e.journal_lines ?? []).reduce(
      (s: number, l: any) => s + Number(l.debit),
      0,
    )
    const totalCredit = (e.journal_lines ?? []).reduce(
      (s: number, l: any) => s + Number(l.credit),
      0,
    )
    return { ...e, totalDebit, totalCredit, lineCount: (e.journal_lines ?? []).length }
  })

  const grandDebit = enriched.reduce((s, e) => s + e.totalDebit, 0)
  const grandCredit = enriched.reduce((s, e) => s + e.totalCredit, 0)
  const unbalanced = enriched.filter(
    (e) => Math.abs(e.totalDebit - e.totalCredit) > 0.01,
  )

  // Distinct filter options
  const refTypes = Array.from(
    new Set((entries ?? []).map((e: any) => e.reference_type).filter(Boolean)),
  ) as string[]
  const voucherTypes = Array.from(
    new Set((entries ?? []).map((e: any) => e.voucher_type).filter(Boolean)),
  ) as string[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Journal Register</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every double-entry voucher in the period, with running totals per entry
        </p>
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
          <label className="block text-xs font-medium text-slate-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">
            Reference
          </label>
          <select
            name="reference_type"
            defaultValue={refType}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {refTypes.sort().map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">
            Voucher
          </label>
          <select
            name="voucher_type"
            defaultValue={voucherType}
            className="mt-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {voucherTypes.sort().map((t) => (
              <option key={t} value={t}>
                {humanize(t)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply
        </button>
      </form>

      {unbalanced.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <strong>{unbalanced.length} unbalanced {unbalanced.length === 1 ? 'entry' : 'entries'}</strong>{' '}
          — debits ≠ credits on {unbalanced.length === 1 ? 'this voucher' : 'these vouchers'}.
          Click each to see what's wrong.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Date
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Entry #
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Voucher
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Reference
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Description
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Lines
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Total
              </th>
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {enriched.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No journal entries for this filter.
                </td>
              </tr>
            )}
            {enriched.map((e) => {
              const bal = Math.abs(e.totalDebit - e.totalCredit) < 0.01
              return (
                <tr
                  key={e.id}
                  className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                    !bal ? 'bg-rose-50/30' : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                    {fmtDate(e.entry_date)}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link
                      href={`/accounting/journal/${e.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {e.entry_number ?? e.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                      {humanize(e.voucher_type ?? 'journal')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {e.reference_type
                      ? `${humanize(e.reference_type)}${
                          e.reference_id
                            ? ` · ${String(e.reference_id).slice(0, 8)}`
                            : ''
                        }`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {e.description ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular text-slate-500">
                    {e.lineCount}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold tabular">
                    {fmtMoney(e.totalDebit)}
                  </td>
                  <td className="px-2 py-2">
                    <Link
                      href={`/accounting/journal/${e.id}`}
                      className="text-xs text-brand-700 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
              <td colSpan={5} className="px-4 py-2 text-right text-xs uppercase text-slate-500">
                Grand totals · {enriched.length} entries
              </td>
              <td className="px-4 py-2 text-right tabular text-xs text-slate-500">
                {enriched.reduce((s, e) => s + e.lineCount, 0)} lines
              </td>
              <td className="px-4 py-2 text-right font-mono tabular">
                {fmtMoney(grandDebit)}
              </td>
              <td />
            </tr>
            {Math.abs(grandDebit - grandCredit) >= 0.01 && (
              <tr className="bg-rose-100 font-semibold text-rose-900">
                <td colSpan={6} className="px-4 py-2 text-right text-xs uppercase">
                  Unbalanced · Credits {fmtMoney(grandCredit)}
                </td>
                <td colSpan={2} className="px-4 py-2 text-right font-mono tabular">
                  Δ {fmtMoney(grandCredit - grandDebit)}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  )
}