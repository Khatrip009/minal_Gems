'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/primitives/page-header'
import { EmptyState } from '@/components/primitives/empty-state'
import { StatusBadge, statusVariant } from '@/components/primitives/status-badge'
import { resolveAssetUrl } from '@/lib/storage-client'
import { Package, Search, Gem, Coins } from 'lucide-react'

type Item = {
  id: string
  inventory_tag: string
  variant_id: string | null
  metal_purity_id: string | null
  net_metal_weight_g: number | string
  net_fine_weight_g: number | string
  gross_weight_g: number | string
  stone_carat_total: number | string
  stone_pcs_total: number
  cost_price: number | string
  making_charge_amount: number | string | null
  floor_price: number | string | null
  status: string
  location_id: string | null
  created_at: string
  sold_at: string | null
}

type Design = { id: string; name: string; design_code: string; product_type: string }

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

const STATUS_TABS = [
  'all',
  'available',
  'reserved',
  'sold',
  'in_repair',
  'returned',
] as const
type StatusTab = (typeof STATUS_TABS)[number]

export function InventoryGrid({
  items,
  designMap,
  itemDesignMap,
  locationMap,
  designImages,
}: {
  items: Item[]
  designMap: Record<string, Design>
  itemDesignMap: Record<string, string>
  locationMap: Record<string, string>
  designImages: Record<string, string>
}) {
  const [query, setQuery] = useState('')
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  function resolveDesign(item: Item): Design | null {
    const designId = itemDesignMap[item.id]
    return designId ? designMap[designId] ?? null : null
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    for (const i of items) c[i.status] = (c[i.status] ?? 0) + 1
    return c
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (statusTab !== 'all' && i.status !== statusTab) return false
      if (!q) return true
      const d = resolveDesign(i)
      return (
        i.inventory_tag.toLowerCase().includes(q) ||
        (d?.name ?? '').toLowerCase().includes(q) ||
        (d?.design_code ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, query, statusTab, itemDesignMap, designMap])

  const totalCost = filtered.reduce(
    (sum, i) =>
      sum + Number(i.cost_price || 0) + Number(i.making_charge_amount || 0),
    0,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description={`${items.length} piece${items.length === 1 ? '' : 's'} · ₹ ${fmtMoney(totalCost)} total cost`}
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {STATUS_TABS.map((tab) => {
          const isActive = statusTab === tab
          const count = counts[tab] ?? 0
          const hide = tab !== 'all' && count === 0
          if (hide) return null
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusTab(tab)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab === 'all' ? 'All' : humanize(tab)}
              <span
                className={`tabular ${
                  isActive ? 'text-brand-100' : 'text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by tag, design…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title={items.length === 0 ? 'No finished pieces yet' : 'No matches'}
          description={
            items.length === 0
              ? 'Complete a job to create the first finished piece. It will appear here once the job is completed.'
              : 'Try a different search or filter.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const design = resolveDesign(item)
            const rawImageUrl = design ? designImages[design.id] : null
            const imageUrl = rawImageUrl ? resolveAssetUrl(rawImageUrl) : null
            const showImage = !!imageUrl && !failedImages.has(item.id)
            const totalCost =
              Number(item.cost_price || 0) + Number(item.making_charge_amount || 0)

            return (
              <Link
                key={item.id}
                href={`/inventory/${item.id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
              >
                <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
                  {showImage ? (
                    <img
                      src={imageUrl}
                      alt={design?.name || 'Product'}
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      onError={() =>
                        setFailedImages((prev) => new Set(prev).add(item.id))
                      }
                    />
                  ) : null}

                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ display: showImage ? 'none' : 'flex' }}
                  >
                    {design ? (
                      <div className="text-center">
                        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                          <Gem className="h-8 w-8 text-brand-500" strokeWidth={1.5} />
                        </div>
                        <p className="px-4 text-xs font-medium text-slate-600">
                          {design.name}
                        </p>
                      </div>
                    ) : (
                      <Gem className="h-12 w-12 text-slate-300" strokeWidth={1} />
                    )}
                  </div>

                  <div className="absolute left-3 top-3">
                    <StatusBadge variant={statusVariant(item.status)}>
                      {humanize(item.status)}
                    </StatusBadge>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div>
                    <p className="font-mono text-xs text-slate-500">
                      {item.inventory_tag}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                      {design?.name ?? 'No design'}
                    </p>
                    {design && (
                      <p className="font-mono text-[10px] text-slate-400">
                        {design.design_code}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Coins className="h-3 w-3 text-slate-400" />
                      <span className="tabular">{fmtG(item.net_metal_weight_g)} g net</span>
                      <span className="text-slate-300">·</span>
                      <span className="tabular">{fmtG(item.gross_weight_g)} g gross</span>
                    </div>
                    {Number(item.stone_pcs_total) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Gem className="h-3 w-3 text-slate-400" />
                        <span className="tabular">
                          {item.stone_pcs_total} stone
                          {item.stone_pcs_total === 1 ? '' : 's'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="tabular">
                          {fmtCt(item.stone_carat_total)} ct
                        </span>
                      </div>
                    )}
                    {item.location_id && (
                      <p className="text-slate-500">
                        At {locationMap[item.location_id] ?? '—'}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto border-t border-slate-100 pt-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">
                        Cost
                      </span>
                      <span className="tabular text-sm font-semibold text-brand-700">
                        ₹ {fmtMoney(totalCost)}
                      </span>
                    </div>
                    {item.floor_price && (
                      <div className="mt-0.5 flex items-baseline justify-between">
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">
                          Floor
                        </span>
                        <span className="tabular text-xs text-slate-600">
                          ₹ {fmtMoney(item.floor_price)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}