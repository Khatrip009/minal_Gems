import { requireRole } from '@/lib/guard'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

export default async function GeneralLedgerPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const { data: ledger } = await supabase
    .from('v_general_ledger')
    .select('*')
    .limit(100) // Paginate this in production

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">General Ledger</h1>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Trace ID (Source)</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Account</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Description</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Debit</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Credit</th>
            </tr>
          </thead>
          <tbody>
            {(ledger ?? []).map((row: any, idx: number) => (
              <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3 text-slate-600">{new Date(row.entry_date).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{row.reference_type}</span>
                  <p className="text-[10px] text-slate-400 mt-1">{row.reference_id}</p>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {row.account_code} - {row.account_name}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.description}</td>
                <td className="px-4 py-3 text-right tabular text-slate-900">
                  {Number(row.debit) > 0 ? `Rs. ${fmtMoney(row.debit)}` : '—'}
                </td>
                <td className="px-4 py-3 text-right tabular text-slate-900">
                  {Number(row.credit) > 0 ? `Rs. ${fmtMoney(row.credit)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}