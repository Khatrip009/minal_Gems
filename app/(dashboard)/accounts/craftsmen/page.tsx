import { requireRole } from '@/lib/guard'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, User, Wallet, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

export default async function CraftsmenPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const { data: craftsmen, error } = await supabase
    .from('v_craftsman_ledger')
    .select('*')
    .order('craftsman_name')

  if (error) return <div className="text-red-500 p-4">{error.message}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Craftsmen</h1>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Craftsman</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Total Jobs</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Total Paid</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Balance Owed</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(craftsmen ?? []).map((c: any) => (
              <tr key={c.craftsman_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" /> {c.craftsman_name}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{c.total_jobs}</td>
                <td className="px-4 py-3 text-right tabular text-slate-900">Rs. {fmtMoney(c.total_paid)}</td>
                <td className="px-4 py-3 text-right tabular font-bold">
                  <span className={Number(c.balance_owed) > 0 ? 'text-rose-600' : 'text-slate-400'}>
                    Rs. {fmtMoney(c.balance_owed)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/craftsmen/${c.craftsman_id}`}>
                    <Button variant="ghost" size="sm" className="gap-1">View <ArrowRight className="h-3 w-3" /></Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}