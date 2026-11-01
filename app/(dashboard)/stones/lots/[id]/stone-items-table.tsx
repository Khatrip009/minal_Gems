'use client'
import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/primitives/empty-state'
import { StatusBadge, statusVariant } from '@/components/primitives/status-badge'
import { Plus, ChevronDown, ChevronRight, X, Layers } from 'lucide-react'

type Option = { id: string; label: string }

export type StoneItemRow = {
  id: string
  stone_lot_id: string | null
  stone_master_id: string
  inventory_tag: string
  carat: number | string
  color: string | null
  clarity: string | null
  cut: string | null
  shape: string | null
  certificate_id: string | null
  cost_price: number | string | null
  selling_price: number | string | null
  status: string
  location_id: string | null
  created_at?: string
  polish?: string | null
  symmetry?: string | null
  fluorescence?: string | null
  length_mm?: number | string | null
  width_mm?: number | string | null
  depth_mm?: number | string | null
}

const SHAPES = ['Round', 'Oval', 'Cushion', 'Emerald', 'Pear', 'Marquise', 'Princess', 'Radiant', 'Asscher', 'Heart', 'Other']
const CUTS = ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor', 'N/A']
const COLORS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N/A']
const CLARITIES = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2', 'I1', 'I2', 'N/A']
const STATUSES = ['available', 'reserved', 'issued_to_job', 'mounted', 'sold', 'returned', 'lost', 'damaged']

const fmtCt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '—'
}
const fmtMoney = (v: unknown) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fourCSummary(row: StoneItemRow): string {
  const parts = [
    row.shape,
    row.color,
    row.clarity,
    row.cut && row.cut !== 'N/A' ? row.cut : null,
  ].filter((p): p is string => Boolean(p))
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export function StoneItemsTable({
  lotId,
  lotStoneMasterId,
  lotRatePerCarat,
  lotCurrency = 'INR',
  items,
  masterMap,
  locationMap,
  locationOptions,
}: {
  lotId: string
  lotStoneMasterId: string
  lotRatePerCarat: number | null
  lotCurrency?: string
  items: StoneItemRow[]
  masterMap: Record<string, string>
  locationMap: Record<string, string>
  locationOptions: Option[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [shapeFilter, setShapeFilter] = useState('')
  const [colorFilter, setColorFilter] = useState('')
  const [clarityFilter, setClarityFilter] = useState('')
  const [caratMin, setCaratMin] = useState('')
  const [caratMax, setCaratMax] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Single-add dialog state
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [costTouched, setCostTouched] = useState(false)
  const [form, setForm] = useState({
    stone_master_id: lotStoneMasterId,
    inventory_tag: '',
    carat: '',
    shape: 'Round',
    cut: 'Excellent',
    color: 'G',
    clarity: 'VS1',
    cost_price: '',
    selling_price: '',
    location_id: locationOptions[0]?.id ?? '',
    status: 'available',
  })

  // Bulk-add dialog state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulk, setBulk] = useState({
    count: '10',
    carat_input_mode: 'each' as 'each' | 'total',
    carat_each: '',
    total_carat: '',
    cost_input_mode: 'auto' as 'auto' | 'each' | 'total',
    cost_each: '',
    total_cost: '',
    shape: 'Round',
    cut: 'Excellent',
    color: 'G',
    clarity: 'VS1',
    location_id: locationOptions[0]?.id ?? '',
    status: 'available',
  })

  // Distinct values present in this lot
  const distinctShapes = useMemo(
    () => Array.from(new Set(items.map((i) => i.shape).filter(Boolean))) as string[],
    [items],
  )
  const distinctColors = useMemo(
    () => Array.from(new Set(items.map((i) => i.color).filter(Boolean))) as string[],
    [items],
  )
  const distinctClarities = useMemo(
    () => Array.from(new Set(items.map((i) => i.clarity).filter(Boolean))) as string[],
    [items],
  )

  const hasActiveFilter = Boolean(
    shapeFilter || colorFilter || clarityFilter || caratMin || caratMax,
  )

  function clearFilters() {
    setShapeFilter('')
    setColorFilter('')
    setClarityFilter('')
    setCaratMin('')
    setCaratMax('')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const minC = caratMin ? Number(caratMin) : null
    const maxC = caratMax ? Number(caratMax) : null

    return items
      .filter((it) => {
        if (shapeFilter && it.shape !== shapeFilter) return false
        if (colorFilter && it.color !== colorFilter) return false
        if (clarityFilter && it.clarity !== clarityFilter) return false
        if (minC != null && Number(it.carat) < minC) return false
        if (maxC != null && Number(it.carat) > maxC) return false
        if (!q) return true
        const summary = fourCSummary(it).toLowerCase()
        return (
          it.inventory_tag.toLowerCase().includes(q) ||
          summary.includes(q) ||
          (it.status ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const caratDiff = Number(b.carat) - Number(a.carat)
        if (caratDiff !== 0) return caratDiff
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      })
  }, [items, query, shapeFilter, colorFilter, clarityFilter, caratMin, caratMax])

  function computeCost(carat: string): string {
    if (!lotRatePerCarat) return ''
    const c = Number(carat)
    if (!Number.isFinite(c) || c <= 0) return ''
    return (c * lotRatePerCarat).toFixed(2)
  }

  function openCreate() {
    setForm({
      stone_master_id: lotStoneMasterId,
      inventory_tag: '',
      carat: '',
      shape: 'Round',
      cut: 'Excellent',
      color: 'G',
      clarity: 'VS1',
      cost_price: '',
      selling_price: '',
      location_id: locationOptions[0]?.id ?? '',
      status: 'available',
    })
    setCostTouched(false)
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const weight = Number(form.carat)
    if (!Number.isFinite(weight) || weight <= 0) {
      toast.error('Carat must be greater than zero', { duration: 5000 })
      return
    }

    // The dialog collects total price per stone. DB stores rate per carat.
    const costTotal = form.cost_price ? Number(form.cost_price) : null
    const sellTotal = form.selling_price ? Number(form.selling_price) : null

    setSaving(true)
    const payload: Record<string, unknown> = {
      stone_lot_id: lotId,
      stone_master_id: form.stone_master_id,
      carat: weight,
      shape: form.shape,
      cut: form.cut === 'N/A' ? null : form.cut,
      color: form.color === 'N/A' ? null : form.color,
      clarity: form.clarity === 'N/A' ? null : form.clarity,
      // ★ rate per carat — divide total by weight
      cost_per_carat:
        costTotal != null && weight > 0 ? costTotal / weight : null,
      selling_per_carat:
        sellTotal != null && weight > 0 ? sellTotal / weight : null,
      location_id: form.location_id || null,
      status: form.status,
    }
    if (form.inventory_tag.trim()) {
      payload.inventory_tag = form.inventory_tag.trim()
    }
    const { data, error } = await createClient()
      .from('stone_items')
      .insert(payload)
      .select('inventory_tag')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 12000 })
      return
    }
    toast.success(`Stone ${data?.inventory_tag ?? ''} added`.trim())
    setOpen(false)
    router.refresh()
  }

  function openBulk() {
    setBulk({
      count: '10',
      carat_input_mode: 'each',
      carat_each: '',
      total_carat: '',
      cost_input_mode: lotRatePerCarat ? 'auto' : 'each',
      cost_each: '',
      total_cost: '',
      shape: 'Round',
      cut: 'Excellent',
      color: 'G',
      clarity: 'VS1',
      location_id: locationOptions[0]?.id ?? '',
      status: 'available',
    })
    setBulkOpen(true)
  }

  // Preview values for the bulk dialog
  const bulkCount = Math.max(0, Math.floor(Number(bulk.count) || 0))
  const bulkCaratEach =
    bulk.carat_input_mode === 'each'
      ? Number(bulk.carat_each) || 0
      : bulkCount > 0
        ? (Number(bulk.total_carat) || 0) / bulkCount
        : 0
  const bulkCostEach = (() => {
    if (bulk.cost_input_mode === 'auto') {
      return lotRatePerCarat && bulkCaratEach > 0 ? bulkCaratEach * lotRatePerCarat : 0
    }
    if (bulk.cost_input_mode === 'each') {
      return Number(bulk.cost_each) || 0
    }
    return bulkCount > 0 ? (Number(bulk.total_cost) || 0) / bulkCount : 0
  })()
  const bulkTotalCarat = bulkCount * bulkCaratEach
  const bulkTotalCost = bulkCount * bulkCostEach

  async function submitBulk(e: React.FormEvent) {
    e.preventDefault()
    if (bulkCount <= 0) {
      toast.error('Count must be a positive integer', { duration: 5000 })
      return
    }
    if (bulkCaratEach <= 0) {
      toast.error('Carat per stone must be greater than zero', { duration: 5000 })
      return
    }
    // ★ rate per carat
    const costPerCarat = bulkCostEach > 0 ? bulkCostEach / bulkCaratEach : null

    setBulkSaving(true)
    const rows = Array.from({ length: bulkCount }).map(() => ({
      stone_lot_id: lotId,
      stone_master_id: lotStoneMasterId,
      carat: bulkCaratEach,
      shape: bulk.shape,
      cut: bulk.cut === 'N/A' ? null : bulk.cut,
      color: bulk.color === 'N/A' ? null : bulk.color,
      clarity: bulk.clarity === 'N/A' ? null : bulk.clarity,
      cost_per_carat: costPerCarat,
      selling_per_carat: null,
      location_id: bulk.location_id || null,
      status: bulk.status,
    }))
    const { error } = await createClient().from('stone_items').insert(rows)
    setBulkSaving(false)
    if (error) {
      toast.error(error.message, { duration: 12000 })
      return
    }
    toast.success(`${bulkCount} stones added to the lot`)
    setBulkOpen(false)
    router.refresh()
  }

  const formPreview = [
    form.carat ? `${Number(form.carat).toFixed(3)} ct` : null,
    form.shape,
    form.color !== 'N/A' ? form.color : null,
    form.clarity !== 'N/A' ? form.clarity : null,
    form.cut !== 'N/A' ? form.cut : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const enteredPcs = items.length
  const enteredCtr = items.reduce((s, i) => s + Number(i.carat || 0), 0)

  return (
    <div className="space-y-4">
      {/* Header line: entered vs opening summary + filter bar */}
      <div className="space-y-2">
        {enteredPcs > 0 && (
          <p className="text-xs text-slate-500">
            {enteredPcs} stone{enteredPcs === 1 ? '' : 's'} entered ·{' '}
            {enteredCtr.toFixed(3)} ct total
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search by tag, 4Cs, status…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {distinctShapes.length > 1 && (
            <select
              value={shapeFilter}
              onChange={(e) => setShapeFilter(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All shapes</option>
              {distinctShapes.sort().map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          {distinctColors.length > 1 && (
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All colors</option>
              {distinctColors.sort().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {distinctClarities.length > 1 && (
            <select
              value={clarityFilter}
              onChange={(e) => setClarityFilter(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All clarities</option>
              {distinctClarities.sort().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Input
              type="number"
              step="0.001"
              min="0"
              placeholder="Carat min"
              value={caratMin}
              onChange={(e) => setCaratMin(e.target.value)}
              className="w-24"
            />
            <span>–</span>
            <Input
              type="number"
              step="0.001"
              min="0"
              placeholder="Carat max"
              value={caratMax}
              onChange={(e) => setCaratMax(e.target.value)}
              className="w-24"
            />
          </div>
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-slate-500">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={openBulk} className="gap-2">
              <Layers className="h-4 w-4" /> Add many
            </Button>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Add stone
            </Button>
          </div>
        </div>
        {filtered.length !== items.length && (
          <p className="text-xs text-slate-500">
            Showing {filtered.length} of {items.length} stone{items.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? 'No stones yet' : 'No matches'}
          description={
            items.length === 0
              ? 'Add stones one by one, or click "Add many" for a homogeneous parcel.'
              : 'Try a different search term or clear the filters.'
          }
          action={
            items.length === 0 ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={openBulk} className="gap-2">
                  <Layers className="h-4 w-4" /> Add many
                </Button>
                <Button onClick={openCreate}>+ Add stone</Button>
              </div>
            ) : hasActiveFilter ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Tag</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">4Cs</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Stone type</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Location</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Cost</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
                <th className="w-8 px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const isExpanded = expanded === it.id
                const summary = fourCSummary(it)
                return (
                  <Fragment key={it.id}>
                    <tr
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                        isExpanded ? 'bg-slate-50/60' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">{it.inventory_tag}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold tabular text-slate-900">
                          {fmtCt(it.carat)} ct
                        </div>
                        <div className="text-xs text-slate-600">{summary}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {masterMap[it.stone_master_id] ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {it.location_id ? (locationMap[it.location_id] ?? '—') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {fmtMoney(it.cost_price)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge variant={statusVariant(it.status)}>
                          {it.status.replace(/_/g, ' ')}
                        </StatusBadge>
                      </td>
                      <td className="px-2 py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(isExpanded ? null : it.id)}
                          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-slate-100 bg-slate-50/40">
                        <td colSpan={7} className="px-4 py-4">
                          <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                            <div>
                              <dt className="font-medium text-slate-500">Full 4C grade</dt>
                              <dd className="text-slate-900">
                                {fmtCt(it.carat)} ct · {it.shape ?? '—'} ·{' '}
                                {it.color ?? '—'} · {it.clarity ?? '—'} · {it.cut ?? '—'}
                              </dd>
                            </div>
                            {it.polish && (
                              <div>
                                <dt className="font-medium text-slate-500">Polish</dt>
                                <dd>{it.polish}</dd>
                              </div>
                            )}
                            {it.symmetry && (
                              <div>
                                <dt className="font-medium text-slate-500">Symmetry</dt>
                                <dd>{it.symmetry}</dd>
                              </div>
                            )}
                            {it.fluorescence && (
                              <div>
                                <dt className="font-medium text-slate-500">Fluorescence</dt>
                                <dd>{it.fluorescence}</dd>
                              </div>
                            )}
                            {it.length_mm && it.width_mm && (
                              <div className="col-span-2">
                                <dt className="font-medium text-slate-500">Measurements</dt>
                                <dd className="tabular">
                                  {Number(it.length_mm).toFixed(2)} ×{' '}
                                  {Number(it.width_mm).toFixed(2)}
                                  {it.depth_mm
                                    ? ` × ${Number(it.depth_mm).toFixed(2)}`
                                    : ''}{' '}
                                  mm
                                </dd>
                              </div>
                            )}
                            <div>
                              <dt className="font-medium text-slate-500">Cost</dt>
                              <dd className="tabular">{fmtMoney(it.cost_price)}</dd>
                            </div>
                            <div>
                              <dt className="font-medium text-slate-500">Selling</dt>
                              <dd className="tabular">{fmtMoney(it.selling_price)}</dd>
                            </div>
                            <div>
                              <dt className="font-medium text-slate-500">Created</dt>
                              <dd>
                                {it.created_at
                                  ? new Date(it.created_at).toLocaleDateString('en-IN', {
                                      dateStyle: 'medium',
                                    })
                                  : '—'}
                              </dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Single-add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Add Stone</DialogTitle>
              <DialogDescription>
                Record a single stone. Inventory tag auto-generates if left blank.
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  Stone type <span className="text-red-500">*</span>
                </Label>
                <select
                  required
                  value={form.stone_master_id}
                  onChange={(e) => setForm({ ...form, stone_master_id: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {Object.entries(masterMap).map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Inventory tag</Label>
                <Input
                  value={form.inventory_tag}
                  onChange={(e) => setForm({ ...form, inventory_tag: e.target.value })}
                  placeholder="Auto (SI-000001)"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                The 4Cs
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>
                    Carat <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    required
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.carat}
                    onChange={(e) => {
                      const next = { ...form, carat: e.target.value }
                      if (!costTouched && lotRatePerCarat) {
                        next.cost_price = computeCost(e.target.value)
                      }
                      setForm(next)
                    }}
                    placeholder="0.000"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Shape</Label>
                  <select
                    value={form.shape}
                    onChange={(e) => setForm({ ...form, shape: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {SHAPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Cut</Label>
                  <select
                    value={form.cut}
                    onChange={(e) => setForm({ ...form, cut: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {CUTS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Color</Label>
                  <select
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Clarity</Label>
                  <select
                    value={form.clarity}
                    onChange={(e) => setForm({ ...form, clarity: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {CLARITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {formPreview && (
                <p className="rounded bg-white px-3 py-2 font-mono text-xs text-brand-800">
                  {formPreview}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cost price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => {
                    setCostTouched(true)
                    setForm({ ...form, cost_price: e.target.value })
                  }}
                  placeholder={lotRatePerCarat ? 'Auto from carat × rate' : '0.00'}
                />
              </div>
              <div className="space-y-1">
                <Label>Selling price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Location</Label>
                <select
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— None —</option>
                  {locationOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Adding…' : 'Add Stone'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk-add dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Add Many Stones</DialogTitle>
              <DialogDescription>
                For a homogeneous parcel — creates N stones with shared 4C values. All
                inventory tags auto-generate.
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={submitBulk} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>
                  Number of stones <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={bulk.count}
                  onChange={(e) => setBulk({ ...bulk, count: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Carat input</Label>
                <select
                  value={bulk.carat_input_mode}
                  onChange={(e) =>
                    setBulk({
                      ...bulk,
                      carat_input_mode: e.target.value as 'each' | 'total',
                    })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="each">Per stone</option>
                  <option value="total">Total across all</option>
                </select>
              </div>
            </div>

            {bulk.carat_input_mode === 'each' ? (
              <div className="space-y-1">
                <Label>
                  Carat per stone <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  value={bulk.carat_each}
                  onChange={(e) => setBulk({ ...bulk, carat_each: e.target.value })}
                  placeholder="e.g. 0.325"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label>
                  Total carats <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  value={bulk.total_carat}
                  onChange={(e) => setBulk({ ...bulk, total_carat: e.target.value })}
                  placeholder="e.g. 3.250"
                />
                <p className="text-xs text-slate-500">
                  Divided evenly — {bulkCount > 0 ? bulkCaratEach.toFixed(3) : '0.000'} ct each
                </p>
              </div>
            )}

            <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Shared 4Cs
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Shape</Label>
                  <select
                    value={bulk.shape}
                    onChange={(e) => setBulk({ ...bulk, shape: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {SHAPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Cut</Label>
                  <select
                    value={bulk.cut}
                    onChange={(e) => setBulk({ ...bulk, cut: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {CUTS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Color</Label>
                  <select
                    value={bulk.color}
                    onChange={(e) => setBulk({ ...bulk, color: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Clarity</Label>
                  <select
                    value={bulk.clarity}
                    onChange={(e) => setBulk({ ...bulk, clarity: e.target.value })}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {CLARITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cost input</Label>
                <select
                  value={bulk.cost_input_mode}
                  onChange={(e) =>
                    setBulk({
                      ...bulk,
                      cost_input_mode: e.target.value as 'auto' | 'each' | 'total',
                    })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {lotRatePerCarat && <option value="auto">Auto (carat × rate)</option>}
                  <option value="each">Per stone</option>
                  <option value="total">Total across all</option>
                </select>
              </div>
              {bulk.cost_input_mode === 'each' && (
                <div className="space-y-1">
                  <Label>Cost per stone</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulk.cost_each}
                    onChange={(e) => setBulk({ ...bulk, cost_each: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              )}
              {bulk.cost_input_mode === 'total' && (
                <div className="space-y-1">
                  <Label>Total cost</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bulk.total_cost}
                    onChange={(e) => setBulk({ ...bulk, total_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Location</Label>
                <select
                  value={bulk.location_id}
                  onChange={(e) => setBulk({ ...bulk, location_id: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {locationOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <select
                  value={bulk.status}
                  onChange={(e) => setBulk({ ...bulk, status: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-slate-900">Preview</p>
              <p className="mt-1 text-slate-700">
                Create <strong>{bulkCount}</strong> stone{bulkCount === 1 ? '' : 's'} ·{' '}
                <strong>{bulkTotalCarat.toFixed(3)} ct</strong> total ·{' '}
                <strong>₹ {bulkTotalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong> cost
              </p>
              {lotRatePerCarat && bulk.cost_input_mode === 'auto' && (
                <p className="mt-1 text-xs text-slate-500">
                  Rate applied: ₹ {lotRatePerCarat.toLocaleString('en-IN')}/ct
                </p>
              )}
            </div>

            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setBulkOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={bulkSaving}>
                {bulkSaving ? 'Creating…' : `Create ${bulkCount} stone${bulkCount === 1 ? '' : 's'}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}