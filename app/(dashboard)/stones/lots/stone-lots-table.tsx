'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
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
import { PageHeader } from '@/components/primitives/page-header'
import { EmptyState } from '@/components/primitives/empty-state'
import { StatusBadge } from '@/components/primitives/status-badge'
import { Gem, Plus } from 'lucide-react'

type Option = { id: string; label: string }

export type StoneLotRow = {
  id: string
  lot_number: string
  vendor_id: string | null
  stone_master_id: string
  invoice_no: string | null
  invoice_date: string | null
  rate_per_carat: number | string
  total_carat: number | string
  total_pcs: number
  currency: string
  cost: number | string
  received_date: string
  notes: string | null
  created_at?: string
}

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED']

const fmtCt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toFixed(3)} ct` : '—'
}
const fmtInt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-IN') : '—'
}
const fmtMoney = (v: unknown, currency = 'INR') => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const prefix = currency === 'INR' ? '₹' : `${currency} `
  return `${prefix} ${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export function StoneLotsTable({
  lots,
  vendorMap,
  masterMap,
  vendorOptions,
  masterOptions,
}: {
  lots: StoneLotRow[]
  vendorMap: Record<string, string>
  masterMap: Record<string, string>
  vendorOptions: Option[]
  masterOptions: Option[]
  locationOptions: Option[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [masterFilter, setMasterFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [costTouched, setCostTouched] = useState(false)
  const [form, setForm] = useState({
    stone_master_id: masterOptions[0]?.id ?? '',
    vendor_id: '',
    invoice_no: '',
    invoice_date: '',
    total_pcs: '',
    total_carat: '',
    rate_per_carat: '',
    currency: 'INR',
    cost: '',
    received_date: todayISO(),
    notes: '',
  })

  const uniqueMasterIds = useMemo(() => {
    const set = new Set<string>()
    for (const l of lots) if (l.stone_master_id) set.add(l.stone_master_id)
    return Array.from(set)
  }, [lots])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return lots.filter((l) => {
      if (masterFilter && l.stone_master_id !== masterFilter) return false
      if (!q) return true
      return (
        (l.lot_number ?? '').toLowerCase().includes(q) ||
        (masterMap[l.stone_master_id] ?? '').toLowerCase().includes(q) ||
        (vendorMap[l.vendor_id ?? ''] ?? '').toLowerCase().includes(q) ||
        (l.invoice_no ?? '').toLowerCase().includes(q)
      )
    })
  }, [lots, query, masterFilter, masterMap, vendorMap])

  function openCreate() {
    setForm({
      stone_master_id: masterOptions[0]?.id ?? '',
      vendor_id: '',
      invoice_no: '',
      invoice_date: '',
      total_pcs: '',
      total_carat: '',
      rate_per_carat: '',
      currency: 'INR',
      cost: '',
      received_date: todayISO(),
      notes: '',
    })
    setCostTouched(false)
    setOpen(true)
  }

  function recalcCost(next: typeof form) {
    if (costTouched) return next
    const carat = Number(next.total_carat)
    const rate = Number(next.rate_per_carat)
    const computed = carat > 0 && rate > 0 ? (carat * rate).toFixed(2) : ''
    return { ...next, cost: computed }
  }

async function submit(e: React.FormEvent) {
  e.preventDefault()
  if (!form.stone_master_id) {
    toast.error('Select a stone type', { duration: 5000 })
    return
  }
  if (!form.received_date) {
    toast.error('Received date is required', { duration: 5000 })
    return
  }
  setSaving(true)
  const payload: Record<string, unknown> = {
    stone_master_id: form.stone_master_id,
    vendor_id: form.vendor_id || null,
    invoice_no: form.invoice_no.trim() || null,
    invoice_date: form.invoice_date || null,
    original_pcs: Number(form.total_pcs || 0),      // ← was total_pcs
    original_carat: Number(form.total_carat || 0),  // ← was total_carat
    rate_per_carat: Number(form.rate_per_carat || 0),
    currency: form.currency || 'INR',
    received_date: form.received_date,
    notes: form.notes.trim() || null,
    // cost removed — derived on read from original_carat × rate_per_carat
    // packet_tag uses the new schema default
  }
  const { data, error } = await createClient()
    .from('stone_lots')
    .insert(payload)
    .select('lot_number')
    .single()
  setSaving(false)
  if (error) {
    toast.error(error.message, { duration: 12000 })
    return
  }
  toast.success(`Lot ${data?.lot_number ?? ''} created`.trim())
  setOpen(false)
  router.refresh()
}

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stone Lots"
        description={`${lots.length} lot${lots.length === 1 ? '' : 's'}`}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New lot
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by lot, type, vendor, invoice…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {uniqueMasterIds.length > 1 && (
          <select
            value={masterFilter}
            onChange={(e) => setMasterFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All stone types</option>
            {uniqueMasterIds.map((id) => (
              <option key={id} value={id}>
                {masterMap[id] ?? id}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={lots.length === 0 ? 'No stone lots yet' : 'No matches'}
          description={
            lots.length === 0
              ? 'Register the first parcel of stones entering the workshop.'
              : 'Try a different search term or filter.'
          }
          action={
            lots.length === 0 ? <Button onClick={openCreate}>+ New lot</Button> : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Lot</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Vendor</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Pieces</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Carats</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Rate / ct</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Cost</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Received</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link
                      href={`/stones/lots/${l.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {l.lot_number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge variant="brand">
                      {masterMap[l.stone_master_id] ?? '—'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {l.vendor_id ? (vendorMap[l.vendor_id] ?? '—') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{fmtInt(l.total_pcs)}</td>
                  <td className="px-4 py-2.5 text-right tabular font-semibold">
                    {fmtCt(l.total_carat)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {fmtMoney(l.rate_per_carat, l.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular font-semibold">
                    {fmtMoney(l.cost, l.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {l.received_date
                      ? new Date(l.received_date).toLocaleDateString('en-IN', {
                          dateStyle: 'medium',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                    {l.invoice_no ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Gem className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>New Stone Lot</DialogTitle>
              <DialogDescription>
                Register a parcel of stones. Lot number is generated automatically. Add
                individual stones on the detail page.
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
                  {masterOptions.length === 0 && (
                    <option value="">No stone types configured</option>
                  )}
                  {masterOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Vendor</Label>
                <select
                  value={form.vendor_id}
                  onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— None —</option>
                  {vendorOptions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Invoice no.</Label>
                <Input
                  value={form.invoice_no}
                  onChange={(e) => setForm({ ...form, invoice_no: e.target.value })}
                  placeholder="e.g. INV-2026-0042"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label>Invoice date</Label>
                <Input
                  type="date"
                  value={form.invoice_date}
                  onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>
                  Total pieces <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.total_pcs}
                  onChange={(e) => setForm({ ...form, total_pcs: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Total carat <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.total_carat}
                  onChange={(e) =>
                    setForm(recalcCost({ ...form, total_carat: e.target.value }))
                  }
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Rate / ct <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rate_per_carat}
                  onChange={(e) =>
                    setForm(recalcCost({ ...form, rate_per_carat: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  Currency <span className="text-red-500">*</span>
                </Label>
                <select
                  required
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>
                  Cost <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => {
                    setCostTouched(true)
                    setForm({ ...form, cost: e.target.value })
                  }}
                  placeholder="Auto from carat × rate"
                />
                <p className="text-xs text-slate-500">
                  Defaults to total carat × rate. Override for GST, make charges, etc.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Label>
                Received date <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                type="date"
                value={form.received_date}
                onChange={(e) => setForm({ ...form, received_date: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything worth remembering about this lot"
              />
            </div>

            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create Lot'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}