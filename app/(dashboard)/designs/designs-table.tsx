'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { DataTable, type Column } from '@/components/primitives/data-table'
import { StatusBadge } from '@/components/primitives/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Gem, Eye, EyeOff, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────

type Design = {
  id: string
  design_code: string
  name: string
  is_published: boolean
  pos_enabled: boolean
  created_at: string
  product_type: 'jewellery' | 'loose_stone' | 'service'
  fulfillment_type: 'in_stock' | 'made_to_order' | 'hybrid'
  making_charge_type: 'fixed' | 'per_gram' | 'percent_of_metal' | 'percent_of_total'
  making_charge_value: number | string
  category: { id: string; name: string } | null
  brand: { id: string; name: string } | null
  variants: Array<{
    id: string
    sku: string
    is_default: boolean
    default_price: number | string | null
  }>
}

// ─── Constants ─────────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { value: 'jewellery',   label: 'Jewellery' },
  { value: 'loose_stone', label: 'Loose stone' },
  { value: 'service',     label: 'Service' },
] as const

const FULFILLMENT_TYPES = [
  { value: 'in_stock',      label: 'In stock' },
  { value: 'made_to_order', label: 'Made to order' },
  { value: 'hybrid',        label: 'Hybrid' },
] as const

const MAKING_CHARGE_TYPES = [
  { value: 'fixed',            label: 'Fixed ₹' },
  { value: 'per_gram',         label: '₹ / g' },
  { value: 'percent_of_metal', label: '% of metal' },
  { value: 'percent_of_total', label: '% of total' },
] as const

const productTypeLabel  = (v: string) => PRODUCT_TYPES.find((p) => p.value === v)?.label ?? v
const fulfillmentLabel  = (v: string) => FULFILLMENT_TYPES.find((f) => f.value === v)?.label ?? v
const makingChargeLabel = (v: string) => MAKING_CHARGE_TYPES.find((m) => m.value === v)?.label ?? v

const fmtPrice = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

// ─── Component ─────────────────────────────────────────────────────────

export function DesignsTable({
  designs,
  designImages,
}: {
  designs: Design[]
  designImages: Record<string, string>
}) {
  const router = useRouter()
  const supabase = createClient()

  const [productType, setProductType] = useState<string>('all')
  const [fulfillment, setFulfillment] = useState<string>('all')
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return designs.filter((d) => {
      if (productType !== 'all' && d.product_type !== productType) return false
      if (fulfillment !== 'all' && d.fulfillment_type !== fulfillment) return false
      if (status === 'published' && !d.is_published) return false
      if (status === 'draft' && d.is_published) return false
      return true
    })
  }, [designs, productType, fulfillment, status])

  async function togglePublished(design: Design) {
    setTogglingId(design.id)
    const next = !design.is_published
    const { error } = await supabase
      .from('product_designs')
      .update({ is_published: next })
      .eq('id', design.id)
    setTogglingId(null)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(next ? 'Design published' : 'Design unpublished')
      router.refresh()
    }
  }

  const columns: Column<Design>[] = [
    {
      key: 'design_code',
      header: 'Code',
      sortable: true,
      cell: (d) => <span className="font-mono text-xs text-fg">{d.design_code}</span>,
    },
    {
      key: 'name',
      header: 'Design',
      sortable: true,
      cell: (d) => {
        const img = designImages[d.id]
        return (
          <div className="flex items-center gap-2.5">
            {img ? (
              <img
                src={img}
                alt={d.name}
                className="h-9 w-9 shrink-0 rounded border border-border object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface-muted">
                <Gem className="h-4 w-4 text-fg-subtle" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-medium text-fg">{d.name}</div>
              <div className="mt-0.5 truncate text-xs text-fg-muted">
                {d.category?.name ?? 'Uncategorised'}
                {d.brand?.name && <> · {d.brand.name}</>}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'product_type',
      header: 'Type',
      cell: (d) => (
        <div>
          <div className="text-xs text-fg">{productTypeLabel(d.product_type)}</div>
          <div className="mt-0.5 text-[11px] text-fg-muted">{fulfillmentLabel(d.fulfillment_type)}</div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      cell: (d) => {
        const prices = d.variants
          .map((v) => Number(v.default_price ?? 0))
          .filter((n) => n > 0)
        const min = prices.length > 0 ? Math.min(...prices) : null
        const max = prices.length > 0 ? Math.max(...prices) : null
        const label =
          min != null && max != null
            ? min === max
              ? fmtPrice(min)
              : `${fmtPrice(min)}–${fmtPrice(max)}`
            : '—'
        return (
          <div>
            <div className="text-xs tabular-nums text-fg">{label}</div>
            <div className="mt-0.5 text-[11px] text-fg-muted">
              {makingChargeLabel(d.making_charge_type)}
            </div>
          </div>
        )
      },
    },
    {
      key: 'variants',
      header: 'Variants',
      align: 'center',
      cell: (d) => (
        <span className="inline-flex min-w-[1.5rem] justify-center rounded-full bg-surface-sunken px-1.5 py-0.5 text-xs tabular-nums text-fg">
          {d.variants.length}
        </span>
      ),
    },
    {
      key: 'is_published',
      header: 'Status',
      cell: (d) => (
        <div className="flex flex-wrap gap-1">
          {d.is_published ? (
            <StatusBadge def={{ label: 'Published', tone: 'success' }} />
          ) : (
            <StatusBadge def={{ label: 'Draft', tone: 'neutral' }} />
          )}
          {d.pos_enabled && <StatusBadge def={{ label: 'POS', tone: 'brand' }} />}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (d) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => togglePublished(d)}
            disabled={togglingId === d.id}
            aria-label={d.is_published ? 'Unpublish design' : 'Publish design'}
          >
            {d.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Link
            href={`/designs/${d.id}`}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            aria-label="Edit design"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </div>
      ),
    },
  ]

  if (designs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted p-8 text-center sm:p-12">
        <Gem className="mx-auto mb-3 h-10 w-10 text-fg-subtle" />
        <h3 className="text-base font-semibold text-fg">No designs yet</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
          A design is the template for a piece of jewellery. Define it once here, then
          produce or purchase finished pieces of it — each one becomes a variant you can sell.
        </p>
        <Link
          href="/designs/new"
          className={cn(buttonVariants({ size: 'lg' }), 'mt-5 inline-flex')}
        >
          + Create your first design
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Type"
          value={productType}
          onChange={setProductType}
          options={[{ value: 'all', label: 'All types' }, ...PRODUCT_TYPES]}
        />
        <FilterSelect
          label="Fulfillment"
          value={fulfillment}
          onChange={setFulfillment}
          options={[{ value: 'all', label: 'All' }, ...FULFILLMENT_TYPES]}
        />
        <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
          {(['all', 'published', 'draft'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                status === s
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs tabular-nums text-fg-muted">
          {filtered.length} {filtered.length === 1 ? 'design' : 'designs'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted p-10 text-center">
          <p className="text-sm font-medium text-fg">No designs match your filters</p>
          <button
            type="button"
            onClick={() => {
              setProductType('all')
              setFulfillment('all')
              setStatus('all')
            }}
            className="mt-2 text-xs text-brand-700 underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <DataTable<Design>
          columns={columns}
          rows={filtered}
          rowKey={(d) => d.id}
          onRowClick={(d) => router.push(`/designs/${d.id}`)}
          searchPlaceholder="Search by code, name, category…"
          mobileCard={(d) => {
            const img = designImages[d.id]
            const prices = d.variants
              .map((v) => Number(v.default_price ?? 0))
              .filter((n) => n > 0)
            const min = prices.length > 0 ? Math.min(...prices) : null
            const max = prices.length > 0 ? Math.max(...prices) : null
            const priceLabel =
              min != null && max != null
                ? min === max
                  ? fmtPrice(min)
                  : `${fmtPrice(min)}–${fmtPrice(max)}`
                : '—'
            return (
              <div className="flex items-start gap-3">
                {img ? (
                  <img
                    src={img}
                    alt={d.name}
                    className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted">
                    <Gem className="h-5 w-5 text-fg-subtle" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-fg-muted">{d.design_code}</span>
                    {d.is_published ? (
                      <StatusBadge def={{ label: 'Published', tone: 'success' }} />
                    ) : (
                      <StatusBadge def={{ label: 'Draft', tone: 'neutral' }} />
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-medium text-fg">{d.name}</div>
                  <div className="mt-0.5 truncate text-xs text-fg-muted">
                    {d.category?.name ?? 'Uncategorised'}
                    {d.variants.length > 0 && (
                      <> · {d.variants.length} {d.variants.length === 1 ? 'variant' : 'variants'}</>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-fg-subtle">
                      {productTypeLabel(d.product_type)} · {fulfillmentLabel(d.fulfillment_type)}
                    </span>
                    <span className="tabular font-medium text-brand-700">{priceLabel}</span>
                  </div>
                </div>
              </div>
            )
          }}
        />
      )}
    </div>
  )
}

// ─── Filter chip select ────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs">
      <span className="text-fg-muted">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent text-fg focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
} 