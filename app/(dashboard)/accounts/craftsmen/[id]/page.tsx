import { requireRole } from '@/lib/guard'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Phone, Wrench, Wallet } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

export default async function CraftsmanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const { data: craftsman, error } = await supabase.from('craftsmen').select('*').eq('id', id).single()
  if (error || !craftsman) notFound()

  const [{ data: jobs }, { data: payments }] = await Promise.all([
    supabase.from('craftsman_jobs').select('id, job_number, item_description, status, craftsman_cost_amount, created_at').eq('craftsman_id', id).order('created_at', { ascending: false }),
    supabase.from('craftsman_job_payments').select('id, amount, payment_method, payment_date').eq('craftsman_id', id).order('payment_date', { ascending: false })
  ])

  const totalEarned = jobs?.reduce((sum, j) => sum + Number(j.craftsman_cost_amount || 0), 0) || 0
  const totalPaid = payments?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0
  const balance = totalEarned - totalPaid

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/craftsmen" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to Craftsmen
      </Link>

      {/* Profile Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 flex items-start gap-6 shadow-sm">
        <div className="h-16 w-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
          <User className="h-8 w-8" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{craftsman.name}</h1>
          <p className="text-sm text-slate-600 mt-1 flex items-center gap-1"><Phone className="h-4 w-4" /> {craftsman.phone || 'No phone'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Balance Owed</p>
          <p className={`text-2xl font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            Rs. {fmtMoney(balance)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Jobs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Wrench className="h-4 w-4" /> Assigned Jobs</h2>
          <div className="space-y-3">
            {jobs?.map(job => (
              <Link href={`/repairs/${job.id}`} key={job.id} className="block p-3 border border-slate-100 rounded-lg hover:border-brand-300 transition">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm font-semibold text-brand-700">{job.job_number}</span>
                  <span className="text-sm font-bold">Rs. {Number(job.craftsman_cost_amount).toFixed(2)}</span>
                </div>
                <p className="text-sm text-slate-700 mt-1">{job.item_description}</p>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{new Date(job.created_at).toLocaleDateString()}</span>
                  <span className="uppercase font-medium text-amber-600">{job.status}</span>
                </div>
              </Link>
            ))}
            {jobs?.length === 0 && <p className="text-sm text-slate-500">No jobs assigned yet.</p>}
          </div>
        </div>

        {/* Payments */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Wallet className="h-4 w-4" /> Payment History</h2>
          <div className="space-y-3">
            {payments?.map(pay => (
              <div key={pay.id} className="block p-3 border border-slate-100 rounded-lg bg-slate-50">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-900 capitalize">{pay.payment_method}</span>
                  <span className="text-sm font-bold text-emerald-700">Rs. {Number(pay.amount).toFixed(2)}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{new Date(pay.payment_date).toLocaleDateString()}</p>
              </div>
            ))}
            {payments?.length === 0 && <p className="text-sm text-slate-500">No payments made yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}