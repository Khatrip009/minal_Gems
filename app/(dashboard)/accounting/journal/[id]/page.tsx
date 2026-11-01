import Link from 'next/link'
import { notFound } from 'next/navigation'
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
const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default async function JournalEntryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [{ data: entry, error }, { data: profiles }] = await Promise.all([
    supabase
      .from('journal_entries')
      .select(
        `
        id, entry_date, entry_number, reference_type, reference_id,
        description, voucher_type, event_type, is_reversal, reversal_of,
        reversed_by, is_locked, total_amount, created_at, created_by,
        journal_lines (
          id, account_id, debit, credit, party_type, party_id, description,
          gl_accounts ( code, name, type, is_cash, is_bank )
        )
      `,
      )
      .eq('id', id)
      .single(),
    supabase.from('profiles').select('id, full_name'),
  ])

  if (error || !entry) notFound()

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [p.id, p.full_name]),
  )

  const lines = (entry.journal_lines ?? []) as any[]
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0)
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/accounting/journal"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Back to Journal
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">
            {entry.entry_number ?? entry.id.slice(0, 8)}
          </h1>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-600">
            {humanize(entry.voucher_type ?? 'journal')}
          </span>
          {entry.is_reversal && (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              Reversal
            </span>
          )}
          {entry.is_locked && (
            <span className="rounded bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
              Locked
            </span>
          )}
          {!balanced && (
            <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
              Unbalanced
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {fmtDate(entry.entry_date)} · {entry.description ?? '—'}
        </p>
        <p className="text-xs text-slate-400">
          Created {fmtDateTime(entry.created_at)}
          {entry.created_by && <> by {profileMap.get(entry.created_by) ?? entry.created_by}</>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase text-slate-500">Reference</p>
          <p className="mt-0.5 text-sm font-medium">
            {entry.reference_type ? humanize(entry.reference_type) : '—'}
          </p>
          {entry.reference_id && (
            <p className="text-[10px] font-mono text-slate-500">
              {String(entry.reference_id).slice(0, 18)}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase text-slate-500">Event</p>
          <p className="mt-0.5 text-sm font-medium">
            {entry.event_type ? humanize(entry.event_type) : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase text-slate-500">Total Debit</p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular">
            ₹ {fmtMoney(totalDebit)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] uppercase text-slate-500">Total Credit</p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular">
            ₹ {fmtMoney(totalCredit)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Account
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                Party / Narrative
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Debit
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                Credit
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const acc = l.gl_accounts ?? {}
              return (
                <tr
                  key={l.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/accounting/ledger?account=${l.account_id}`}
                      className="text-brand-700 hover:underline"
                    >
                      <span className="font-mono text-xs">{acc.code ?? '—'}</span>{' '}
                      <span className="text-sm">{acc.name ?? l.account_id}</span>
                    </Link>
                    {acc.is_cash && (
                      <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        CASH
                      </span>
                    )}
                    {acc.is_bank && (
                      <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                        BANK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {l.party_type && (
                      <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        {l.party_type}
                      </span>
                    )}
                    {l.description ?? '—'}
                    {l.party_id && (
                      <span className="ml-2 font-mono text-[10px] text-slate-400">
                        {String(l.party_id).slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {Number(l.debit) === 0 ? '—' : fmtMoney(l.debit)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {Number(l.credit) === 0 ? '—' : fmtMoney(l.credit)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr
              className={`border-t-2 font-semibold ${
                balanced
                  ? 'border-slate-300 bg-slate-50'
                  : 'border-rose-300 bg-rose-50 text-rose-900'
              }`}
            >
              <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase">
                Total
              </td>
              <td className="px-4 py-2 text-right font-mono text-base tabular">
                {fmtMoney(totalDebit)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-base tabular">
                {fmtMoney(totalCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {entry.reversal_of && (
        <p className="text-sm text-amber-700">
          This entry reverses{' '}
          <Link
            href={`/accounting/journal/${entry.reversal_of}`}
            className="underline"
          >
            {String(entry.reversal_of).slice(0, 8)}
          </Link>
          .
        </p>
      )}
      {entry.reversed_by && (
        <p className="text-sm text-amber-700">
          This entry was reversed by{' '}
          <Link
            href={`/accounting/journal/${entry.reversed_by}`}
            className="underline"
          >
            {String(entry.reversed_by).slice(0, 8)}
          </Link>
          .
        </p>
      )}
    </div>
  )
}