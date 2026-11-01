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
import { Coins, Plus } from 'lucide-react'

export type LotRow = {
  metal_lot_id: string
  lot_number: string
  purity_code: string | null
  purity_percent: number | string | null
  opening_fine_weight_g: number | string | null
  txn_fine_g: number | string | null
  balance_fine_g: number | string | null
  rate_per_gram: number | string | null
  location_id: string | null
}

type Option = { id: string; label: string }

const fmtG = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '—'
}
const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
}

export function MetalLotsTable({
  lots,
  locationMap,
  purityOptions,
  locationOptions,
}: {
  lots: LotRow[]
  locationMap: Record<string, string>
  purityOptions: Option[]
  locationOptions: Option[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    purity_id: purityOptions[0]?.id ?? '',
    location_id: locationOptions[0]?.id ?? '',
    opening_fine_weight_g: '',
    rate_per_gram: '',
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...lots].sort((a, b) =>
      String(a.lot_number).localeCompare(String(b.lot_number), undefined, { numeric: true }),
    )
    if (!q) return sorted
    return sorted.filter(
      (l) =>
        l.lot_number.toLowerCase().includes(q) ||
        (l.purity_code ?? '').toLowerCase().includes(q) ||
        (locationMap[l.location_id ?? ''] ?? '').toLowerCase().includes(q),
    )
  }, [lots, query, locationMap])

  function openCreate() {
    setForm({
      purity_id: purityOptions[0]?.id ?? '',
      location_id: locationOptions[0]?.id ?? '',
      opening_fine_weight_g: '',
      rate_per_gram: '',
    })
    setOpen(true)
  }

async function submit(e: React.FormEvent) {
  e.preventDefault()
  if (!form.purity_id || !form.location_id) {
    toast.error('Select a purity and a location', { duration: 6000 })
    return
  }
  const openingWeight = Number(form.opening_fine_weight_g)
  const rate = Number(form.rate_per_gram)
  if (!(openingWeight > 0)) {
    toast.error('Opening fine weight must be > 0', { duration: 6000 })
    return
  }

  setSaving(true)
  const supabase = createClient()

  // 1. Create the lot — do NOT send opening_fine_weight_g
  const { data: lot, error: lotErr } = await supabase
    .from('metal_lots')
    .insert({
      purity_id: form.purity_id,
      location_id: form.location_id,
      rate_per_gram: rate,
      source: 'opening',
    })
    .select('id, lot_number')
    .single()

  if (lotErr || !lot) {
    setSaving(false)
    toast.error(lotErr?.message ?? 'Failed to create lot', { duration: 10000 })
    return
  }

  // 2. Record the opening weight as a metal_transactions row
  const { error: txnErr } = await supabase
    .from('metal_transactions')
    .insert({
      metal_lot_id: lot.id,
      txn_type: 'opening',
      fine_weight_change_g: openingWeight,
      notes: 'Opening balance on lot creation',
    })

  setSaving(false)
  if (txnErr) {
    toast.error(
      `Lot ${lot.lot_number} created but opening transaction failed: ${txnErr.message}`,
      { duration: 12000 },
    )
    router.refresh()
    return
  }

  toast.success(`Lot ${lot.lot_number} created`)
  setOpen(false)
  router.refresh()
}

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metal Lots"
        description={`${lots.length} lot${lots.length === 1 ? '' : 's'}`}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New lot
          </Button>
        }
      />

      <div className="w-full sm:w-72">
        <Input
          placeholder="Search by lot, purity, location…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={lots.length === 0 ? 'No metal lots yet' : 'No matches'}
          description={
            lots.length === 0
              ? 'Register the first lot of raw metal entering the workshop.'
              : 'Try a different search term.'
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
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Purity</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Opening g</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Txn g</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Balance g</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Rate / g</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Book value</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Location</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const bookValue = Number(l.balance_fine_g) * Number(l.rate_per_gram)
                return (
                  <tr
                    key={l.metal_lot_id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link
                        href={`/metal/lots/${l.metal_lot_id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {l.lot_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {l.purity_code ?? '—'}
                      </span>
                      {l.purity_percent != null && (
                        <span className="ml-2 text-xs text-slate-500">
                          {Number(l.purity_percent).toFixed(2)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {fmtG(l.opening_fine_weight_g)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {fmtG(l.txn_fine_g)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular font-semibold">
                      {fmtG(l.balance_fine_g)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      ₹ {fmtMoney(l.rate_per_gram)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      ₹ {Number.isFinite(bookValue) ? fmtMoney(bookValue) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {l.location_id ? (locationMap[l.location_id] ?? '—') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Book value = remaining fine weight × rate at which the lot was received.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>New Metal Lot</DialogTitle>
              <DialogDescription>
                Register raw metal entering the workshop. Lot number is generated automatically.
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Purity <span className="text-red-500">*</span></Label>
                <select
                  required
                  value={form.purity_id}
                  onChange={(e) => setForm({ ...form, purity_id: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {purityOptions.length === 0 && (
                    <option value="">No purities configured</option>
                  )}
                  {purityOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Location <span className="text-red-500">*</span></Label>
                <select
                  required
                  value={form.location_id}
                  onChange={(e) => setForm({ ...form, location_id: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {locationOptions.length === 0 && (
                    <option value="">No locations configured</option>
                  )}
                  {locationOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  Opening fine weight (g) <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.opening_fine_weight_g}
                  onChange={(e) =>
                    setForm({ ...form, opening_fine_weight_g: e.target.value })
                  }
                  placeholder="0.0000"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Rate per gram (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.rate_per_gram}
                  onChange={(e) => setForm({ ...form, rate_per_gram: e.target.value })}
                  placeholder="0.00"
                />
              </div>
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