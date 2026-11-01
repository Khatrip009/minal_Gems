import { requireRole } from '@/lib/guard'
import { Banknote, TrendingUp, AlertCircle, Wallet } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

export default async function AccountsOverviewPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  // Fetch overview data (using standard Supabase queries for aggregation)
  const { data: invoices } = await supabase.from('invoices').select('total, amount_paid, balance').neq('status', 'voided')
  const { data: jobs } = await supabase.from('craftsman_jobs').select('craftsman_cost_amount')
  const { data: inventory } = await supabase.from('inventory_items').select('cost_price, status')

  const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  const totalCollected = invoices?.reduce((sum, inv) => sum + Number(inv.amount_paid), 0) || 0
  const totalReceivable = invoices?.reduce((sum, inv) => sum + Number(inv.balance), 0) || 0

  const totalCraftsmanCost = jobs?.reduce((sum, job) => sum + Number(job.craftsman_cost_amount || 0), 0) || 0
  
  // COGS: Total cost of items that are sold/melted
  const totalCogs = inventory?.filter(i => ['sold', 'melted'].includes(i.status)).reduce((sum, item) => sum + Number(item.cost_price), 0) || 0

  const grossProfit = totalRevenue - totalCogs
  const netProfit = grossProfit - totalCraftsmanCost

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Financial Overview</h1>
        <p className="mt-1 text-sm text-slate-500">High-level view of your business performance.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2"><Banknote className="h-4 w-4" /> Total Revenue</div>
          <p className="text-2xl font-bold text-slate-900">Rs. {fmtMoney(totalRevenue)}</p>
          <p className="text-xs text-emerald-600 mt-1">Rs. {fmtMoney(totalCollected)} collected</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2"><AlertCircle className="h-4 w-4" /> Receivables (Owed to you)</div>
          <p className="text-2xl font-bold text-amber-600">Rs. {fmtMoney(totalReceivable)}</p>
          <p className="text-xs text-slate-500 mt-1">From unpaid/partial invoices</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2"><Wallet className="h-4 w-4" /> Total Expenses</div>
          <p className="text-2xl font-bold text-rose-600">Rs. {fmtMoney(totalCogs + totalCraftsmanCost)}</p>
          <p className="text-xs text-slate-500 mt-1">Inventory + Craftsman costs</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700 mb-2"><TrendingUp className="h-4 w-4" /> Net Profit</div>
          <p className="text-2xl font-bold text-emerald-700">Rs. {fmtMoney(netProfit)}</p>
          <p className="text-xs text-emerald-600 mt-1">Revenue - Expenses</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 mt-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-4">Profit & Loss Breakdown</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-600">Gross Revenue (Sales & Repairs)</span>
            <span className="font-semibold">Rs. {fmtMoney(totalRevenue)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2 text-rose-600">
            <span>Less: Cost of Goods Sold (Inventory)</span>
            <span className="font-semibold">- Rs. {fmtMoney(totalCogs)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200 pb-2 font-bold text-slate-900">
            <span>Gross Profit</span>
            <span>Rs. {fmtMoney(grossProfit)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2 text-rose-600">
            <span>Less: Craftsman Labor Costs</span>
            <span className="font-semibold">- Rs. {fmtMoney(totalCraftsmanCost)}</span>
          </div>
          <div className="flex justify-between pt-2 text-lg font-bold text-emerald-700">
            <span>Net Profit</span>
            <span>Rs. {fmtMoney(netProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}