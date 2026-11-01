import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { resolveAssetUrl } from '@/lib/storage-client'
import { InventoryActions } from './inventory-actions'
import { Gem, Coins, MapPin, ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
}
const fmtG = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}
const fmtCt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const TERMINAL_STATUSES = new Set([
  'sold',
  'returned',
  'exchanged',
  'scrapped',
  'lost',
])

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  const { data: item, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !item) notFound()

  // Find the craftsman_job that produced this item (if any).
  // The FK direction is craftsman_jobs.inventory_item_id → inventory_items.id
  const { data: itemJob } = await supabase
    .from('craftsman_jobs')
    .select('id, job_number, craftsman_id, completed_at, design_id')
    .eq('inventory_item_id', item.id)
    .maybeSingle()

  // Find the design:
  //   1. item.variant_id → product_variants.design_id
  //   2. craftsman_jobs.design_id (fallback)
  let design: {
    id: string
    name: string
    design_code: string
    product_type: string
    description: string | null
  } | null = null

  if (item.variant_id) {
    const { data: variant } = await supabase
      .from('product_variants')
      .select('design_id')
      .eq('id', item.variant_id)
      .maybeSingle()
    if (variant?.design_id) {
      const { data } = await supabase
        .from('product_designs')
        .select('id, name, design_code, product_type, description')
        .eq('id', variant.design_id)
        .maybeSingle()
      design = data
    }
  }
  if (!design && itemJob?.design_id) {
    const { data } = await supabase
      .from('product_designs')
      .select('id, name, design_code, product_type, description')
      .eq('id', itemJob.design_id)
      .maybeSingle()
    design = data
  }

  const [locationRes, purityRes, txnsRes, stonesRes, assetsRes] = await Promise.all([
    item.location_id
      ? supabase.from('locations').select('id, name').eq('id', item.location_id).maybeSingle()
      : Promise.resolve({ data: null }),
    item.metal_purity_id
      ? supabase
          .from('metal_purities')
          .select('id, code, purity_percent')
          .eq('id', item.metal_purity_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('inventory_transactions')
      .select('*')
      .eq('inventory_item_id', id)
      .order('created_at', { ascending: false }),
    itemJob?.id
      ? supabase
          .from('craftsman_job_stone_issues')
          .select(
            '*, stone_items(inventory_tag, carat, shape, color, clarity, cut, cost_price, status)',
          )
          .eq('job_id', itemJob.id)
      : Promise.resolve({ data: [] }),
    design?.id
      ? supabase
          .from('product_assets')
          .select('id, url, is_primary, sort_order')
          .eq('design_id', design.id)
          .eq('asset_type', 'image')
          .order('is_primary', { ascending: false })
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] }),
  ])

  const location = locationRes.data
  const purity = purityRes.data
  const txns = txnsRes.data
  const stones = stonesRes.data
  const assets = assetsRes.data

  const primaryImage = assets?.[0]?.url
    ? resolveAssetUrl(assets[0].url)
    : null

  const mountedStones = (stones ?? []).filter((iss) => {
    const s = iss.stone_items as Record<string, unknown> | null
    return String(s?.status ?? '') === 'mounted'
  })

  const making = Number(item.making_charge_amount ?? 0)
  const totalCost = Number(item.cost_price || 0) + making

  const stoneCost = mountedStones.reduce((sum, iss) => {
    const s = iss.stone_items as Record<string, unknown> | null
    return sum + Number(s?.cost_price ?? 0)
  }, 0)
  const metalOnlyCost = Math.max(0, Number(item.cost_price || 0) - stoneCost)

  const isTerminal = TERMINAL_STATUSES.has(item.status)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to inventory
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt={design?.name || 'Product'}
                  className="h-full w-full object-cover"
                />
              ) : design ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-200">
                    <Gem className="h-12 w-12 text-brand-500" strokeWidth={1.2} />
                  </div>
                  <p className="px-6 text-sm font-medium text-slate-600">
                    {design.name}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    {design.design_code}
                  </p>
                  <p className="mt-3 text-[10px] uppercase tracking-wide text-slate-400">
                    No photo uploaded
                  </p>
                </div>
              ) : (
                <Gem className="h-16 w-16 text-slate-300" strokeWidth={1} />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">
                {design?.name ?? 'Finished piece'}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  item.status === 'available'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : item.status === 'reserved'
                      ? 'bg-amber-50 text-amber-700 ring-amber-200'
                      : item.status === 'sold'
                        ? 'bg-sky-50 text-sky-700 ring-sky-200'
                        : 'bg-slate-100 text-slate-700 ring-slate-200'
                }`}
              >
                {humanize(item.status)}
              </span>
            </div>
            <p className="mt-1 font-mono text-sm text-slate-500">
              {item.inventory_tag}
              {purity && (
                <>
                  {' · '}
                  <span className="font-sans">
                    {purity.code} ({Number(purity.purity_percent).toFixed(2)}%)
                  </span>
                </>
              )}
            </p>
            {design?.description && (
              <p className="mt-3 text-sm text-slate-600">{design.description}</p>
            )}
          </div>

          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-5">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">
                  Total cost
                </p>
                <p className="mt-1 tabular text-2xl font-semibold text-brand-900">
                  ₹ {fmtMoney(totalCost)}
                </p>
              </div>
              {item.floor_price && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Floor price
                  </p>
                  <p className="mt-1 tabular text-2xl font-semibold text-slate-700">
                    ₹ {fmtMoney(item.floor_price)}
                  </p>
                </div>
              )}
              {item.sold_at && (
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Sold on
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {new Date(item.sold_at).toLocaleDateString('en-IN', {
                      dateStyle: 'medium',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-slate-900">Specifications</p>
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Net metal</dt>
                <dd className="mt-0.5 tabular font-medium">{fmtG(item.net_metal_weight_g)} g</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Fine metal</dt>
                <dd className="mt-0.5 tabular font-medium">{fmtG(item.net_fine_weight_g)} g</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Gross weight</dt>
                <dd className="mt-0.5 tabular font-medium">{fmtG(item.gross_weight_g)} g</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Stones</dt>
                <dd className="mt-0.5 tabular font-medium">
                  {item.stone_pcs_total} pcs · {fmtCt(item.stone_carat_total)} ct
                </dd>
              </div>
              {location && (
                <div>
                  <dt className="text-xs text-slate-500">Location</dt>
                  <dd className="mt-0.5 flex items-center gap-1 font-medium">
                    <MapPin className="h-3 w-3 text-slate-400" /> {location.name}
                  </dd>
                </div>
              )}
              {itemJob && (
                <div>
                  <dt className="text-xs text-slate-500">Made in job</dt>
                  <dd className="mt-0.5">
                    <Link
                      href={`/jobs/${itemJob.id}`}
                      className="font-mono text-xs font-medium text-brand-700 hover:underline"
                    >
                      {itemJob.job_number}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-slate-900">Cost breakdown</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Metal</dt>
                <dd className="tabular">₹ {fmtMoney(metalOnlyCost)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Stones ({mountedStones.length} mounted)</dt>
                <dd className="tabular">₹ {fmtMoney(stoneCost)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Making charge</dt>
                <dd className="tabular">₹ {fmtMoney(making)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <dt>Total cost</dt>
                <dd className="tabular text-brand-700">₹ {fmtMoney(totalCost)}</dd>
              </div>
            </dl>
          </div>

          <InventoryActions
            itemId={item.id}
            inventoryTag={item.inventory_tag}
            status={item.status}
            floorPrice={item.floor_price != null ? Number(item.floor_price) : null}
            totalCost={totalCost}
            isTerminal={isTerminal}
          />

          {mountedStones.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Mounted stones</p>
                <p className="text-xs text-slate-500">
                  {mountedStones.length} stone
                  {mountedStones.length === 1 ? '' : 's'} · {fmtCt(item.stone_carat_total)} ct
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 font-medium">Tag</th>
                      <th className="py-2 font-medium">4Cs</th>
                      <th className="py-2 text-right font-medium">Carat</th>
                      <th className="py-2 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mountedStones.map((iss) => {
                      const s = iss.stone_items as Record<string, unknown> | null
                      const summary =
                        [s?.shape, s?.color, s?.clarity, s?.cut && s.cut !== 'N/A' ? s.cut : null]
                          .filter(Boolean)
                          .join(' · ') || '—'
                      return (
                        <tr key={iss.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-2 font-mono text-xs">
                            {String(s?.inventory_tag ?? '—')}
                          </td>
                          <td className="py-2 text-xs text-slate-600">{summary}</td>
                          <td className="py-2 text-right tabular text-xs">
                            {fmtCt(s?.carat)}
                          </td>
                          <td className="py-2 text-right tabular text-xs">
                            ₹ {fmtMoney(s?.cost_price)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-slate-900">Movement history</p>
            {(txns ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No movements recorded yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5">
                {(txns ?? []).map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {humanize(t.txn_type)}
                      </p>
                      {t.status_from && t.status_to && (
                        <p className="text-xs text-slate-500">
                          {humanize(t.status_from)} → {humanize(t.status_to)}
                        </p>
                      )}
                      {t.notes && (
                        <p className="mt-0.5 text-xs text-slate-600">{t.notes}</p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        {new Date(t.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}