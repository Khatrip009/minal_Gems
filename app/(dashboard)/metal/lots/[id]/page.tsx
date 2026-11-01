import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { AddTransactionButton } from './add-transaction-button'

const fmtG = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '—'
}
const fmtSigned = (v: unknown) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${Math.abs(n).toFixed(3)} g`
}
const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
}
const typeLabel = (t: string) =>
  t
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

export default async function MetalLotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [{ data: lot, error }, { data: txns }, { data: locations }] = await Promise.all([
    supabase.from('v_metal_lot_balances').select('*').eq('metal_lot_id', id).single(),
    supabase
      .from('metal_transactions')
      .select('*')
      .eq('metal_lot_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('locations').select('id, name'),
  ])

  if (error || !lot) notFound()

  const locationMap: Record<string, string> = Object.fromEntries(
    (locations ?? []).map((l) => [l.id, l.name]),
  )
  const bookValue = Number(lot.balance_fine_g) * Number(lot.rate_per_gram)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/metal/lots" className="text-sm text-slate-500 hover:underline">
          ← Back to metal lots
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">{lot.lot_number}</h1>
          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {lot.purity_code ?? '—'}
          </span>
          {lot.purity_percent != null && (
            <span className="text-sm text-slate-500">
              {Number(lot.purity_percent).toFixed(2)}% pure
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Location: {lot.location_id ? (locationMap[lot.location_id] ?? '—') : '—'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Opening</p>
          <p className="mt-1 text-2xl font-semibold tabular">
            {fmtG(lot.opening_fine_weight_g)}
            <span className="ml-1 text-sm font-normal text-slate-500">g</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Movements
          </p>
          <p
            className={`mt-1 text-2xl font-semibold tabular ${
              Number(lot.txn_fine_g) < 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {fmtSigned(lot.txn_fine_g)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Balance</p>
          <p className="mt-1 text-2xl font-semibold tabular text-brand-700">
            {fmtG(lot.balance_fine_g)}
            <span className="ml-1 text-sm font-normal text-slate-500">g</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Book value
          </p>
          <p className="mt-1 text-2xl font-semibold tabular">
            ₹ {Number.isFinite(bookValue) ? fmtMoney(bookValue) : '—'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">@ ₹ {fmtMoney(lot.rate_per_gram)}/g</p>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Ledger</h2>
          <AddTransactionButton lotId={lot.metal_lot_id} defaultLocationId={lot.location_id} />
        </div>

        {(txns ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No transactions yet. Add the first one above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Type</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Fine change (g)
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Location</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Notes</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Reference</th>
                </tr>
              </thead>
              <tbody>
                {(txns ?? []).map((t) => {
                  const n = Number(t.fine_weight_change_g)
                  const positive = n > 0
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {new Date(t.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {typeLabel(t.txn_type)}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular ${
                          positive ? 'text-emerald-700' : n < 0 ? 'text-rose-700' : 'text-slate-500'
                        }`}
                      >
                        {fmtSigned(t.fine_weight_change_g)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {t.location_id ? (locationMap[t.location_id] ?? '—') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{t.notes ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {t.reference_type
                          ? `${typeLabel(t.reference_type)}${
                              t.reference_id ? ` · ${String(t.reference_id).slice(0, 8)}` : ''
                            }`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}