import { requireRole } from '@/lib/guard'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Phone, MapPin, Receipt, RotateCcw, Wrench } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  const { data: customer, error } = await supabase.from('customers').select('*').eq('id', id).single()
  if (error || !customer) notFound()

  const [{ data: invoices }, { data: returns }, { data: repairs }] = await Promise.all([
    supabase.from('invoices').select('id, invoice_number, total, status, payment_status, invoice_date').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('returns').select('id, return_number, total_refund_amount, status, return_type, return_date').eq('customer_id', id).order('created_at', { ascending: false }),
    supabase.from('craftsman_jobs').select('id, job_number, item_description, status, due_date').eq('customer_id', id).order('created_at', { ascending: false })
  ])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </Link>

      {/* Profile Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 flex items-start gap-6 shadow-sm">
        <div className="h-16 w-16 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
          <User className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
          <div className="flex gap-4 mt-2 text-sm text-slate-600">
            <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {customer.phone || 'No phone'}</span>
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {customer.address || 'No address'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Invoices */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Receipt className="h-4 w-4" /> Purchase History</h2>
          <div className="space-y-3">
            {invoices?.map(inv => (
              <Link href={`/invoices/${inv.id}`} key={inv.id} className="block p-3 border border-slate-100 rounded-lg hover:border-brand-300 transition">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm font-semibold text-brand-700">{inv.invoice_number}</span>
                  <span className="text-sm font-bold">Rs. {Number(inv.total).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>{new Date(inv.invoice_date).toLocaleDateString()}</span>
                  <span className={inv.payment_status === 'paid' ? 'text-emerald-600' : 'text-rose-600'}>{inv.payment_status.toUpperCase()}</span>
                </div>
              </Link>
            ))}
            {invoices?.length === 0 && <p className="text-sm text-slate-500">No purchases yet.</p>}
          </div>
        </div>

        {/* Repairs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Wrench className="h-4 w-4" /> Repair History</h2>
          <div className="space-y-3">
            {repairs?.map(job => (
              <Link href={`/repairs/${job.id}`} key={job.id} className="block p-3 border border-slate-100 rounded-lg hover:border-brand-300 transition">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm font-semibold text-brand-700">{job.job_number}</span>
                  <span className="text-xs font-bold uppercase text-amber-600">{job.status}</span>
                </div>
                <p className="text-sm text-slate-700 mt-1">{job.item_description}</p>
              </Link>
            ))}
            {repairs?.length === 0 && <p className="text-sm text-slate-500">No repairs yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}