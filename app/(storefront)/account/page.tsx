import Link from 'next/link'
import { Package, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { fmtINR, fmtDate } from '@/lib/storefront/format'
import { getOrderStatusConfig } from '@/lib/storefront/order-status'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Account · Minal Gems' }

export default async function AccountPage() {
  const auth = await getCurrentCustomer()
  if (!auth) return null // layout already redirects

  const supabase = await createClient()

  // Recent orders (3)
  const { data: recentOrders } = await supabase
    .from('orders')
    .select('id, order_number, status, total, placed_at, access_token')
    .eq('customer_id', auth.customer.id)
    .order('placed_at', { ascending: false })
    .limit(3)

  // Total count
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', auth.customer.id)

  // Saved addresses count
  const { count: totalAddresses } = await supabase
    .from('customer_addresses')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', auth.customer.id)

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Total orders" value={String(totalOrders ?? 0)} />
        <Stat
          label="Saved addresses"
          value={String(totalAddresses ?? 0)}
        />
        <Stat
          label="Member since"
          value={fmtDate(auth.customer.created_at ?? new Date())}
        />
      </div>

      {/* Recent orders */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-stone-900">
            Recent orders
          </h2>
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 font-medium"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {!recentOrders || recentOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <p className="text-sm font-medium text-stone-900">
              No orders yet
            </p>
            <p className="mt-1 text-sm text-stone-500">
              Your orders will appear here once you place one.
            </p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-full bg-stone-900 hover:bg-stone-800 text-white px-5 py-2 text-xs font-semibold"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {recentOrders.map((o) => {
              const cfg = getOrderStatusConfig(o.status)
              return (
                <li key={o.id}>
                  <Link
                    href={`/account/orders/${o.order_number}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-stone-50"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-stone-900">
                        {o.order_number}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {fmtDate(o.placed_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.tone}`}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-sm font-medium text-stone-900 tabular-nums">
                        {fmtINR(Number(o.total))}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-stone-900 tabular-nums">
        {value}
      </p>
    </div>
  )
}