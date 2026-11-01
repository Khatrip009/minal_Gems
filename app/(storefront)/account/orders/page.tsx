import Link from 'next/link'
import { Package, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { fmtINR, fmtDate } from '@/lib/storefront/format'
import { getOrderStatusConfig } from '@/lib/storefront/order-status'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Orders · Minal Gems' }

export default async function OrdersListPage() {
  const auth = await getCurrentCustomer()
  if (!auth) return null

  const supabase = await createClient()
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, total, placed_at, access_token, order_items(id)',
    )
    .eq('customer_id', auth.customer.id)
    .order('placed_at', { ascending: false })

  if (error) {
    console.error('[account/orders] query failed:', error)
  }

  const rows = orders ?? []

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white p-12 text-center">
        <Package className="mx-auto mb-3 h-10 w-10 text-stone-300" />
        <p className="text-base font-medium text-stone-900">
          You haven't placed any orders yet
        </p>
        <p className="mt-1 text-sm text-stone-500">
          When you do, they'll appear here with tracking and status.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 text-sm font-semibold"
        >
          Browse Collections <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">
          {rows.length} order{rows.length !== 1 ? 's' : ''}
        </h2>
      </div>

      <ul className="space-y-3">
        {rows.map((o) => {
          const cfg = getOrderStatusConfig(o.status)
          const itemCount = (o.order_items as any[])?.length ?? 0

          return (
            <li key={o.id}>
              <Link
                href={`/account/orders/${o.order_number}`}
                className="block rounded-lg border border-stone-200 bg-white p-5 hover:border-stone-400 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-stone-900">
                      {o.order_number}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      Placed on {fmtDate(o.placed_at)} · {itemCount} item
                      {itemCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-stone-900 tabular-nums">
                      {fmtINR(Number(o.total))}
                    </p>
                    <span
                      className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.tone}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}