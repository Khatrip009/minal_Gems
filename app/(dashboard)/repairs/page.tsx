import { requireRole } from '@/lib/guard'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Wrench, Clock, CheckCircle2, Truck } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export default async function RepairsPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  const { data: jobs, error } = await supabase
    .from('craftsman_jobs')
    .select('*, customers(name, phone), craftsmen(name)')
    .eq('job_type', 'repair')
    .order('created_at', { ascending: false })

  if (error) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error.message}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Repairs & Services</h1>
          <p className="mt-1 text-sm text-slate-500">Manage customer repairs, craftsman assignments, and final billing.</p>
        </div>
        <Link href="/repairs/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Repair Intake
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Job #</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Customer</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Item Description</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Craftsman</th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {(jobs ?? []).map((j: any) => (
              <tr key={j.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono text-xs font-semibold">
                  <Link href={`/repairs/${j.id}`} className="text-brand-700 hover:underline">
                    {j.job_number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{j.customers?.name}</p>
                  <p className="text-xs text-slate-500">{j.customers?.phone}</p>
                </td>
                <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{j.item_description}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${
                    j.status === 'pending' ? 'bg-amber-50 text-amber-700 ring-amber-200' :
                    j.status === 'in_progress' ? 'bg-sky-50 text-sky-700 ring-sky-200' :
                    j.status === 'completed' ? 'bg-purple-50 text-purple-700 ring-purple-200' :
                    'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  }`}>
                    {j.status === 'pending' && <Clock className="h-3 w-3" />}
                    {j.status === 'in_progress' && <Wrench className="h-3 w-3" />}
                    {j.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                    {j.status === 'delivered' && <Truck className="h-3 w-3" />}
                    {humanize(j.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{j.craftsmen?.name ?? '—'}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtDate(j.due_date)}</td>
              </tr>
            ))}
            {jobs?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  <Wrench className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  No active repairs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}