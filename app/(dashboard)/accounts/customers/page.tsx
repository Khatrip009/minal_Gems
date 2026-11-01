import { requireRole } from '@/lib/guard'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, User, Phone, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

export default async function CustomersPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  const { data: customers, error } = await supabase
    .from('v_customer_ledger') // Using the view we created earlier
    .select('*')
    .order('customer_name')

  if (error) return <div className="text-red-500 p-4">{error.message}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Customer</Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-left font-medium text-slate-600">Customer Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Phone</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Total Invoices</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Total Spent</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Balance Due</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c: any) => (
              <tr key={c.customer_id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" /> {c.customer_name}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone || '—'}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{c.total_invoices}</td>
                <td className="px-4 py-3 text-right tabular text-slate-900">Rs. {fmtMoney(c.total_invoiced)}</td>
                <td className="px-4 py-3 text-right tabular font-bold">
                  <span className={Number(c.balance_due) > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    Rs. {fmtMoney(c.balance_due)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/customers/${c.customer_id}`}>
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