import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

type Row = {
  id: string
  event_type: string | null
  reference_type: string
  reference_id: string
  reversed: boolean
  created_at: string
  journal_entries: { description: string | null; total_amount: number | null } | null
}

const FRIENDLY: Record<string, string> = {
  invoice_issued: 'Invoice issued',
  invoice_voided: 'Invoice voided',
  payment_received: 'Payment received',
  payment_voided: 'Payment voided',
  refund_paid: 'Refund paid',
  refund_voided: 'Refund voided',
  purchase_posted: 'Purchase recorded',
  expense_posted: 'Expense recorded',
  expense_voided: 'Expense voided',
  job_completed: 'Job completed',
  job_posting_reversed: 'Job posting reversed',
  return_completed: 'Return completed',
  return_voided: 'Return voided',
  buyback_posted: 'Buyback posted',
  buyback_voided: 'Buyback voided',
  vendor_payment: 'Vendor paid',
  karigar_payment: 'Karigar paid',
  scheme_installment_paid: 'Scheme installment paid',
  scheme_redemption: 'Scheme redemption',
}

/** Where to send the user when they click an activity row. */
function hrefFor(row: Row): string | null {
  const { reference_type, reference_id } = row
  switch (reference_type) {
    case 'invoice':
      return `/invoices/${reference_id}`
    case 'purchase':
      return `/purchases/${reference_id}`
    case 'return':
    case 'sales_return':
      return `/returns/${reference_id}`
    case 'buyback':
    case 'buyback_intake':
      return `/buyback/${reference_id}`
    case 'craftsman_job':
    case 'job':
      return `/jobs/${reference_id}`
    default:
      return null
  }
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export async function RecentActivity({ limit = 10 }: { limit?: number }) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('posted_events')
    .select(
      'id, event_type, reference_type, reference_id, reversed, created_at, journal_entries(description, total_amount)',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  // Never let a monitoring panel crash the dashboard.
  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
        <p className="mt-2 text-sm text-slate-500">Activity is temporarily unavailable.</p>
      </div>
    )
  }

  const rows = (data ?? []) as unknown as Row[]

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
        <span className="text-xs text-slate-500">Last {rows.length}</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">
          No activity yet. Once invoices, payments, and job postings start flowing,
          they'll appear here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const title = FRIENDLY[row.event_type ?? ''] ?? row.event_type ?? 'Event'
            const description = row.journal_entries?.description ?? null
            const amount = row.journal_entries?.total_amount ?? null
            const href = hrefFor(row)

            const inner = (
              <div className="flex items-start justify-between gap-4 px-6 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {title}
                    {row.reversed && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        reversed
                      </span>
                    )}
                  </p>
                  {description && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{description}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm tabular-nums text-slate-900">{fmtAmount(amount)}</p>
                  <p className="text-xs text-slate-500">{fmtRelative(row.created_at)}</p>
                </div>
              </div>
            )

            return (
              <li key={row.id} className={cn(row.reversed && 'opacity-60')}>
                {href ? (
                  <Link
                    href={href}
                    className="block transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}