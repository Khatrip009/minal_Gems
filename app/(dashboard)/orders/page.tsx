import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { fmtDate, fmtINR } from '@/lib/storefront/format'
import { getOrderStatusConfig } from '@/lib/storefront/order-status'
import { OrdersFilterBar } from './orders-filter'
import { ShoppingBag, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Online Orders Â· Minal Gems' }

const ACTIVE_STATUSES = ['pending', 'pending_payment', 'paid', 'shipped', 'confirmed']

export default async function DashboardOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    q?: string
    tab?: string
  }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const tab = params.tab ?? 'active'
  const status = params.status
  const q = params.q?.trim()

  let query = supabase
    .from('orders')
    .select(
      'id, order_number, status, customer_name, customer_phone, customer_email, total, placed_at, paid_at, shipped_at, delivered_at, order_items(id)',
    )
    .order('placed_at', { ascending: false })
    .range(0, 499)

  if (tab === 'active') {
    query = query.in('status', ACTIVE_STATUSES)
  } else if (tab === 'closed') {
    query = query.in('status', ['delivered', 'cancelled', 'refunded'])
  } else if (tab === 'cancelled') {
    query = query.eq('status', 'cancelled')
  } else if (tab === 'all') {
    // no filter
  }

  if (status) query = query.eq('status', status)
  if (q) {
    query = query.or(
      `order_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%,customer_email.ilike.%${q}%`,
    )
  }

  const { data: orders, error } = await query
  if (error) console.error('[orders] query failed:', error)

  // Counts per tab
  const { data: counts } = await supabase
    .from('orders')
    .select('status')
    .range(0, 4999)

  const statusCounts: Record<string, number> = {}
  let activeCount = 0
  let closedCount = 0
  let cancelledCount = 0
  for (const row of counts ?? []) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1
    if (ACTIVE_STATUSES.includes(row.status)) activeCount++
    else if (['delivered', 'refunded'].includes(row.status)) closedCount++
    else if (row.status === 'cancelled') cancelledCount++
  }

  const rows = orders ?? []

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
            Commerce
          </p>
          <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
            Online orders
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage orders placed through the storefront.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Tab
          label="Active"
          count={activeCount}
          href="/orders?tab=active"
          active={tab === 'active'}
        />
        <Tab
          label="Closed"
          count={closedCount}
          href="/orders?tab=closed"
          active={tab === 'closed'}
        />
        <Tab
          label="Cancelled"
          count={cancelledCount}
          href="/orders?tab=cancelled"
          active={tab === 'cancelled'}
        />
        <Tab
          label="All"
          href="/orders?tab=all"
          active={tab === 'all'}
        />
      </div>

      <OrdersFilterBar />

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-base font-medium text-slate-900">
            No orders in this view
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Try a different tab or clear filters.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4 font-medium">Order</th>
                <th className="py-3 px-4 font-medium">Customer</th>
                <th className="py-3 px-4 font-medium text-center">Items</th>
                <th className="py-3 px-4 font-medium text-right">Total</th>
                <th className="py-3 px-4 font-medium">Placed</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => {
                const cfg = getOrderStatusConfig(o.status)
                const itemCount = (o.order_items as any[])?.length ?? 0
                return (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-mono font-medium text-slate-900 hover:text-amber-700"
                      >
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">
                        {o.customer_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {o.customer_phone ?? o.customer_email ?? 'â€”'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums text-slate-700">
                      {itemCount}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-medium text-slate-900">
                      {fmtINR(Number(o.total))}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {fmtDate(o.placed_at)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.tone}`}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/orders/${o.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
                      >
                        Open <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Tab({
  label,
  count,
  href,
  active,
}: {
  label: string
  count?: number
  href: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {label}
      {typeof count === 'number' && count > 0 && (
        <span
          className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 tabular-nums ${
            active
              ? 'bg-white/20 text-white'
              : 'bg-slate-300 text-slate-700'
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  )
}