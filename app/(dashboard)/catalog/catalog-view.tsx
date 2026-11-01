'use client'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/primitives/page-header'
import { EmptyState } from '@/components/primitives/empty-state'
import { resolveAssetUrl } from '@/lib/storage-client'
import {
  Gem,
  Search,
  X,
  Package,
  Clock,
  Sparkles,
  Wrench,
  Plus,
} from 'lucide-react'

type Design = {
  id: string
  design_code: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  product_type: string
  fulfillment_type: string
  category_id: string | null
  brand_id: string | null
  default_purity_id: string | null
  making_charge_type: string
  making_charge_value: number | string
  is_published: boolean
  pos_enabled: boolean
  created_at: string
}
type Category = { id: string; name: string }
type Brand = { id: string; name: string }
type Purity = { id: string; code: string }
type Job = {
  id: string
  design_id: string | null
  planned_finished_purity_id: string | null
}
type Variant = {
  id: string
  design_id: string
  default_price: number | string | null
}
type Inventory = {
  id: string
  inventory_tag: string
  variant_id: string | null
  status: string
  floor_price: number | string | null
  cost_price: number | string | null
  net_metal_weight_g: number | string
  net_fine_weight_g: number | string
  stone_pcs_total: number
  stone_carat_total: number | string
}

type DesignWithStats = {
  design: Design
  totalPieces: number
  availablePieces: number
  reservedPieces: number
  soldPieces: number
  deliveredPieces: number
  minFloor: number | null
  maxFloor: number | null
  listMin: number | null
  listMax: number | null
  totalStonePcs: number
  totalStoneCarat: number
  avgNetWeight: number | null
  purityCodes: string[]
}

type AvailabilityFilter = 'all' | 'in_stock' | 'made_to_order' | 'sold_out'
type ProductTypeFilter = 'all' | 'jewellery' | 'loose_stone' | 'service'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  if (n >= 100000) {
    return `${(n / 100000).toFixed(2)}L`
  }
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
const fmtG = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export function CatalogView({
  designs,
  categories,
  brands,
  purities,
  jobs,
  variants,
  inventory,
  designImages,
}: {
  designs: Design[]
  categories: Category[]
  brands: Brand[]
  purities: Purity[]
  jobs: Job[]
  variants: Variant[]
  inventory: Inventory[]
  designImages: Record<string, string>
}) {
  const [search, setSearch] = useState('')
  const [productType, setProductType] = useState<ProductTypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [availability, setAvailability] = useState<AvailabilityFilter>('all')

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories],
  )
  const brandMap = useMemo(
    () => Object.fromEntries(brands.map((b) => [b.id, b.name])),
    [brands],
  )
  const purityMap = useMemo(
    () => Object.fromEntries(purities.map((p) => [p.id, p.code])),
    [purities],
  )

  const designStats: DesignWithStats[] = useMemo(() => {
    // variant_id → design_id
    const designByVariant = new Map<string, string>()
    for (const v of variants) designByVariant.set(v.id, v.design_id)

    // Group variants by design — needed to compute list price ranges
    const variantsByDesign = new Map<string, Variant[]>()
    for (const v of variants) {
      const arr = variantsByDesign.get(v.design_id) ?? []
      arr.push(v)
      variantsByDesign.set(v.design_id, arr)
    }

    // Bucket inventory by design via variant mapping
    const invByDesign = new Map<string, Inventory[]>()
    for (const i of inventory) {
      if (!i.variant_id) continue
      const designId = designByVariant.get(i.variant_id)
      if (!designId) continue
      const arr = invByDesign.get(designId) ?? []
      arr.push(i)
      invByDesign.set(designId, arr)
    }

    const jobsByDesign = new Map<string, Job[]>()
    for (const j of jobs) {
      if (!j.design_id) continue
      const arr = jobsByDesign.get(j.design_id) ?? []
      arr.push(j)
      jobsByDesign.set(j.design_id, arr)
    }

    return designs.map((design) => {
      const designJobs = jobsByDesign.get(design.id) ?? []
      const designInv = invByDesign.get(design.id) ?? []
      const designVariants = variantsByDesign.get(design.id) ?? []

      const totalPieces = designInv.length
      const availablePieces = designInv.filter(
        (i) => i.status === 'available',
      ).length
      const reservedPieces = designInv.filter(
        (i) => i.status === 'reserved',
      ).length
      const soldPieces = designInv.filter((i) => i.status === 'sold').length
      const deliveredPieces = designInv.filter(
        (i) => i.status === 'delivered',
      ).length

      const floors = designInv
        .map((i) => Number(i.floor_price ?? 0))
        .filter((n) => n > 0)
      const minFloor = floors.length > 0 ? Math.min(...floors) : null
      const maxFloor = floors.length > 0 ? Math.max(...floors) : null

      // Fallback price — from variant default_price values
      const listPrices = designVariants
        .map((v) => Number(v.default_price ?? 0))
        .filter((n) => n > 0)
      const listMin = listPrices.length > 0 ? Math.min(...listPrices) : null
      const listMax = listPrices.length > 0 ? Math.max(...listPrices) : null

      const totalStonePcs = designInv.reduce(
        (a, i) => a + Number(i.stone_pcs_total ?? 0),
        0,
      )
      const totalStoneCarat = designInv.reduce(
        (a, i) => a + Number(i.stone_carat_total ?? 0),
        0,
      )
      const weights = designInv
        .map((i) => Number(i.net_fine_weight_g ?? 0))
        .filter((n) => n > 0)
      const avgNetWeight =
        weights.length > 0
          ? weights.reduce((a, b) => a + b, 0) / weights.length
          : null

      const purityCodes = Array.from(
        new Set(
          designJobs
            .map((j) =>
              j.planned_finished_purity_id
                ? purityMap[j.planned_finished_purity_id]
                : null,
            )
            .filter((c): c is string => Boolean(c)),
        ),
      )

      return {
        design,
        totalPieces,
        availablePieces,
        reservedPieces,
        soldPieces,
        deliveredPieces,
        minFloor,
        maxFloor,
        listMin,
        listMax,
        totalStonePcs,
        totalStoneCarat,
        avgNetWeight,
        purityCodes,
      }
    })
  }, [designs, jobs, variants, inventory, purityMap])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return designStats.filter((d) => {
      if (productType !== 'all' && d.design.product_type !== productType) {
        return false
      }
      if (categoryFilter && d.design.category_id !== categoryFilter) {
        return false
      }
      if (brandFilter && d.design.brand_id !== brandFilter) {
        return false
      }
      if (availability === 'in_stock' && d.availablePieces + d.reservedPieces === 0) {
        return false
      }
      if (
        availability === 'made_to_order' &&
        (d.totalPieces > 0 || d.design.product_type === 'service')
      ) {
        return false
      }
      if (
        availability === 'sold_out' &&
        !(d.totalPieces > 0 && d.availablePieces + d.reservedPieces === 0)
      ) {
        return false
      }
      if (!q) return true
      return (
        d.design.name.toLowerCase().includes(q) ||
        d.design.design_code.toLowerCase().includes(q) ||
        (categoryMap[d.design.category_id ?? ''] ?? '')
          .toLowerCase()
          .includes(q) ||
        (brandMap[d.design.brand_id ?? ''] ?? '').toLowerCase().includes(q)
      )
    })
  }, [
    designStats,
    search,
    productType,
    categoryFilter,
    brandFilter,
    availability,
    categoryMap,
    brandMap,
  ])

  const grouped = useMemo(() => {
    if (categoryFilter) {
      return [
        {
          categoryName: categoryMap[categoryFilter] ?? 'Category',
          categoryId: categoryFilter,
          designs: filtered,
        },
      ]
    }
    const byCategory = new Map<string, DesignWithStats[]>()
    for (const d of filtered) {
      const key = d.design.category_id ?? '__uncategorized__'
      const arr = byCategory.get(key) ?? []
      arr.push(d)
      byCategory.set(key, arr)
    }
    return Array.from(byCategory.entries())
      .map(([catId, list]) => ({
        categoryId: catId,
        categoryName:
          catId === '__uncategorized__'
            ? 'Uncategorized'
            : (categoryMap[catId] ?? 'Category'),
        designs: list.sort((a, b) =>
          a.design.name.localeCompare(b.design.name),
        ),
      }))
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  }, [filtered, categoryFilter, categoryMap])

  const totalDesigns = filtered.length
  const activeFilterCount =
    (productType !== 'all' ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (brandFilter ? 1 : 0) +
    (availability !== 'all' ? 1 : 0) +
    (search ? 1 : 0)

  function resetFilters() {
    setSearch('')
    setProductType('all')
    setCategoryFilter('')
    setBrandFilter('')
    setAvailability('all')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalog"
        description={`${designs.length} design${designs.length === 1 ? '' : 's'} · browse, filter and drill into every piece`}
        actions={
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Clear filters ({activeFilterCount})
              </Button>
            )}
            <Link
              href="/catalog/new"
              className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
            >
              <Plus className="h-3.5 w-3.5" /> New design
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Name, code, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Product type
            </label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as ProductTypeFilter)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">All types</option>
              <option value="jewellery">Jewellery</option>
              <option value="loose_stone">Loose stone</option>
              <option value="service">Service</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Brand
            </label>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Availability
            </label>
            <div className="space-y-1.5">
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'in_stock', label: 'In stock' },
                  { value: 'made_to_order', label: 'Made to order' },
                  { value: 'sold_out', label: 'Sold out' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name="availability"
                    value={opt.value}
                    checked={availability === opt.value}
                    onChange={() => setAvailability(opt.value)}
                    className="rounded-full border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-8">
          {totalDesigns === 0 ? (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title={
                designs.length === 0
                  ? 'No designs yet'
                  : 'No designs match your filters'
              }
              description={
                designs.length === 0
                  ? 'Create your first design to start building the catalog.'
                  : 'Try a different search or clear the filters.'
              }
              action={
                designs.length === 0 ? (
                  <Link
                    href="/catalog/new"
                    className={cn(buttonVariants(), 'gap-1.5')}
                  >
                    <Plus className="h-3.5 w-3.5" /> New design
                  </Link>
                ) : activeFilterCount > 0 ? (
                  <Button variant="outline" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            grouped.map((group) => (
              <section key={group.categoryId} className="space-y-3">
                <div className="flex items-baseline justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {group.categoryName}
                  </h2>
                  <span className="text-xs text-slate-500">
                    {group.designs.length} design
                    {group.designs.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.designs.map((d) => (
                    <DesignCard
                      key={d.design.id}
                      data={d}
                      imageUrl={designImages[d.design.id]}
                      categoryName={
                        d.design.category_id
                          ? categoryMap[d.design.category_id]
                          : null
                      }
                      brandName={
                        d.design.brand_id ? brandMap[d.design.brand_id] : null
                      }
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Card ──
function DesignCard({
  data,
  imageUrl,
  categoryName,
  brandName,
}: {
  data: DesignWithStats
  imageUrl?: string
  categoryName: string | null
  brandName: string | null
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const d = data.design
  const inStock = data.availablePieces + data.reservedPieces > 0
  const soldOut =
    data.totalPieces > 0 && data.availablePieces + data.reservedPieces === 0
  const isService = d.product_type === 'service'

  const resolvedImageUrl = imageUrl ? resolveAssetUrl(imageUrl) : undefined
  const showImage = Boolean(resolvedImageUrl) && !imgFailed

  const statusLabel = isService
    ? 'Service'
    : inStock
      ? `${data.availablePieces + data.reservedPieces} in stock`
      : soldOut
        ? 'Sold out'
        : 'Made to order'

  const statusClass = isService
    ? 'bg-violet-50 text-violet-700 ring-violet-200'
    : inStock
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : soldOut
        ? 'bg-slate-100 text-slate-500 ring-slate-200'
        : 'bg-sky-50 text-sky-700 ring-sky-200'

  // Prefer actual inventory floor prices; fall back to variant list prices.
  // This is what turns "No pricing yet" into a real number once the user
  // has filled in default_price on at least one variant.
  const displayMin = data.minFloor ?? data.listMin
  const displayMax = data.maxFloor ?? data.listMax

  const priceRange =
    displayMin && displayMax
      ? displayMin === displayMax
        ? `₹${fmtMoney(displayMin)}`
        : `₹${fmtMoney(displayMin)}–${fmtMoney(displayMax)}`
      : null

  const specs: string[] = []
  if (data.purityCodes.length > 0) {
    specs.push(data.purityCodes.join('/'))
  }
  if (data.avgNetWeight != null) {
    specs.push(`${fmtG(data.avgNetWeight)} g`)
  }
  if (data.totalStonePcs > 0) {
    const avgStones = Math.round(data.totalStonePcs / Math.max(1, data.totalPieces))
    specs.push(`${avgStones} stone${avgStones === 1 ? '' : 's'}`)
  }

  return (
    <Link
      href={`/catalog/${d.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
        {showImage && resolvedImageUrl ? (
          <img
            src={resolvedImageUrl}
            alt={d.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                <Gem className="h-8 w-8 text-brand-500" strokeWidth={1.5} />
              </div>
              <p className="px-4 text-xs font-medium text-slate-500">
                {humanize(d.product_type)}
              </p>
            </div>
          </div>
        )}

        <div className="absolute left-3 top-3">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset backdrop-blur-sm ${statusClass}`}
          >
            {isService ? (
              <Wrench className="h-2.5 w-2.5" />
            ) : inStock ? (
              <Package className="h-2.5 w-2.5" />
            ) : soldOut ? (
              <Clock className="h-2.5 w-2.5" />
            ) : (
              <Sparkles className="h-2.5 w-2.5" />
            )}
            {statusLabel}
          </span>
        </div>

        {!d.is_published && (
          <div className="absolute right-3 top-3">
            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-200 backdrop-blur-sm">
              Draft
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <p className="font-mono text-[10px] text-slate-500">
            {d.design_code}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-tight text-slate-900 group-hover:text-brand-700">
            {d.name}
          </p>
          {(categoryName || brandName) && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              {categoryName}
              {categoryName && brandName && ' · '}
              {brandName}
            </p>
          )}
        </div>

        {specs.length > 0 && (
          <p className="text-[11px] text-slate-600">{specs.join(' · ')}</p>
        )}

        <div className="mt-auto flex items-baseline justify-between border-t border-slate-100 pt-2">
          {priceRange ? (
            <span className="tabular text-sm font-semibold text-brand-700">
              {priceRange}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">No pricing yet</span>
          )}
          {data.totalPieces > 0 && (
            <span className="text-[10px] text-slate-400">
              {data.totalPieces} made
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}