'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { DataTable, type Column } from '@/components/primitives/data-table'
import { StatusBadge } from '@/components/primitives/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Package2, Pencil, Plus, Power, Sparkles } from 'lucide-react'
import { MATERIAL_CATEGORIES, MATERIAL_UNITS } from '@/lib/catalog-constants'
import { cn } from '@/lib/utils'

type Material = {
  id: string
  code: string
  name: string
  category: string
  unit: string
  default_rate: number | string
  is_active: boolean
}

type Props = {
  materials: Material[]
  designsByMaterial: Record<string, number>
  lotsByMaterial: Record<string, number>
}

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'
}

function autoCode(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)
}

export function MaterialsTable({ materials, designsByMaterial, lotsByMaterial }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const categoriesInUse = useMemo(() => {
    const set = new Set(materials.map((m) => m.category))
    return Array.from(set).sort()
  }, [materials])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return materials.filter((m) => {
      if (category !== 'all' && m.category !== category) return false
      if (status === 'active' && !m.is_active) return false
      if (status === 'inactive' && m.is_active) return false
      if (!q) return true
      return [m.name, m.code, m.category].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [materials, search, category, status])

  async function toggleActive(m: Material) {
    setTogglingId(m.id)
    const { error } = await supabase
      .from('material_master')
      .update({ is_active: !m.is_active })
      .eq('id', m.id)
    setTogglingId(null)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(m.is_active ? 'Material deactivated' : 'Material reactivated')
      router.refresh()
    }
  }

  function openNew() { setEditing(null); setDialogOpen(true) }
  function openEdit(m: Material) { setEditing(m); setDialogOpen(true) }

  const columns: Column<Material>[] = [
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      cell: (m) => <span className="font-mono text-xs text-fg">{m.code}</span>,
    },
    {
      key: 'name',
      header: 'Material',
      sortable: true,
      cell: (m) => (
        <div>
          <div className="text-sm font-medium text-fg">{m.name}</div>
          <div className="mt-0.5 text-[11px] capitalize text-fg-muted">{m.category}</div>
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      cell: (m) => <span className="text-xs text-fg-muted">{m.unit}</span>,
    },
    {
      key: 'default_rate',
      header: 'Default rate',
      align: 'right',
      cell: (m) => <span className="text-sm tabular-nums text-fg">₹ {fmtMoney(m.default_rate)}</span>,
    },
    {
      key: 'usage',
      header: 'Used in',
      align: 'center',
      cell: (m) => {
        const d = designsByMaterial[m.id] ?? 0
        const l = lotsByMaterial[m.id] ?? 0
        if (d === 0 && l === 0) return <span className="text-xs text-fg-subtle">—</span>
        const parts: string[] = []
        if (d > 0) parts.push(`${d} design${d === 1 ? '' : 's'}`)
        if (l > 0) parts.push(`${l} lot${l === 1 ? '' : 's'}`)
        return <span className="text-xs text-fg-muted">{parts.join(' · ')}</span>
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (m) =>
        m.is_active
          ? <StatusBadge def={{ label: 'Active', tone: 'success' }} />
          : <StatusBadge def={{ label: 'Inactive', tone: 'muted' }} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => openEdit(m)} aria-label="Edit material">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="sm" onClick={() => toggleActive(m)}
            disabled={togglingId === m.id}
            aria-label={m.is_active ? 'Deactivate' : 'Reactivate'}
          >
            <Power className={cn('h-4 w-4', m.is_active ? 'text-success' : 'text-fg-subtle')} />
          </Button>
        </div>
      ),
    },
  ]

  if (materials.length === 0) {
    return (
      <>
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted p-8 text-center sm:p-12">
          <Package2 className="mx-auto mb-3 h-10 w-10 text-fg-subtle" />
          <h3 className="text-base font-semibold text-fg">No materials yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
            Materials capture every non-metal, non-stone input your workshop consumes —
            leather straps, clasps, threads, findings, even packaging. Add one, then
            reference it from designs and material lots.
          </p>
          <Button size="lg" onClick={openNew} className="mt-5">
            <Plus className="h-4 w-4" /> Add your first material
          </Button>
        </div>
        <MaterialDialog
          open={dialogOpen} onOpenChange={setDialogOpen} editing={editing}
          onSaved={() => { setDialogOpen(false); router.refresh() }}
        />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, name…"
          className="w-64"
        />

        <label className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs">
          <span className="text-fg-muted">Category:</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="cursor-pointer bg-transparent capitalize text-fg focus:outline-none"
          >
            <option value="all">All</option>
            {categoriesInUse.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                status === s ? 'bg-brand-50 text-brand-700' : 'text-fg-muted hover:text-fg',
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs tabular-nums text-fg-muted">
          {filtered.length} of {materials.length}
        </span>

        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Add material
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted p-10 text-center">
          <p className="text-sm font-medium text-fg">No materials match your filters</p>
          <button
            type="button"
            onClick={() => { setSearch(''); setCategory('all'); setStatus('all') }}
            className="mt-2 text-xs text-brand-700 underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <DataTable<Material>
          columns={columns}
          rows={filtered}
          rowKey={(m) => m.id}
          onRowClick={openEdit}
          searchPlaceholder="Search…"
          mobileCard={(m) => {
            const d = designsByMaterial[m.id] ?? 0
            const l = lotsByMaterial[m.id] ?? 0
            return (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted">
                  <Package2 className="h-5 w-5 text-fg-subtle" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-fg">{m.name}</span>
                    {m.is_active ? (
                      <StatusBadge def={{ label: 'Active', tone: 'success' }} />
                    ) : (
                      <StatusBadge def={{ label: 'Inactive', tone: 'muted' }} />
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-fg-muted">{m.code}</div>
                  <div className="mt-0.5 flex items-center justify-between text-xs">
                    <span className="capitalize text-fg-muted">{m.category} · {m.unit}</span>
                    <span className="tabular-nums text-fg">₹ {fmtMoney(m.default_rate)}</span>
                  </div>
                  {(d > 0 || l > 0) && (
                    <div className="mt-1 text-[11px] text-fg-subtle">
                      {d > 0 && `${d} design${d === 1 ? '' : 's'}`}
                      {d > 0 && l > 0 && ' · '}
                      {l > 0 && `${l} lot${l === 1 ? '' : 's'}`}
                    </div>
                  )}
                </div>
              </div>
            )
          }}
        />
      )}

      <MaterialDialog
        open={dialogOpen} onOpenChange={setDialogOpen} editing={editing}
        onSaved={() => { setDialogOpen(false); router.refresh() }}
      />
    </div>
  )
}

// ─── Dialog ────────────────────────────────────────────────────────────

function MaterialDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Material | null
  onSaved: () => void
}) {
  const supabase = createClient()
  const [code, setCode] = useState(editing?.code ?? '')
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(!!editing)
  const [name, setName] = useState(editing?.name ?? '')
  const [category, setCategory] = useState(editing?.category ?? 'other')
  const [unit, setUnit] = useState(editing?.unit ?? 'piece')
  const [defaultRate, setDefaultRate] = useState(String(editing?.default_rate ?? '0'))
  const [isActive, setIsActive] = useState(editing?.is_active ?? true)
  const [saving, setSaving] = useState(false)

  // Reset when dialog re-opens
  const formKey = editing?.id ?? 'new'
  const [lastKey, setLastKey] = useState(formKey)
  if (lastKey !== formKey) {
    setLastKey(formKey)
    setCode(editing?.code ?? '')
    setCodeManuallyEdited(!!editing)
    setName(editing?.name ?? '')
    setCategory(editing?.category ?? 'other')
    setUnit(editing?.unit ?? 'piece')
    setDefaultRate(String(editing?.default_rate ?? '0'))
    setIsActive(editing?.is_active ?? true)
  }

  // Auto-code from name until the user edits it
  if (!codeManuallyEdited && name) {
    const generated = autoCode(name)
    if (generated !== code) setCode(generated)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Name is required')
    if (!code.trim()) return toast.error('Code is required')

    setSaving(true)
    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        category,
        unit,
        default_rate: Number(defaultRate) || 0,
        is_active: isActive,
      }
      const { error } = editing
        ? await supabase.from('material_master').update(payload).eq('id', editing.id)
        : await supabase.from('material_master').insert(payload)
      if (error) throw error

      toast.success(editing ? 'Material updated' : 'Material added')
      onSaved()
    } catch (err: any) {
      toast.error(err?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            {editing ? 'Edit material' : 'Add material'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Name <span className="text-danger">*</span></Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!codeManuallyEdited) setCode(autoCode(e.target.value))
              }}
              placeholder="Leather strap 4mm · brown"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label>Code <span className="text-danger">*</span></Label>
            <Input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeManuallyEdited(true) }}
              placeholder="LEATHER_4MM_BRN"
              className="mt-1 font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-fg-subtle">
              Unique identifier. Auto-generated from name; edit if you have a house convention.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Input
                list="material-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 capitalize"
              />
              <datalist id="material-categories">
                {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                list="material-units"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1"
              />
              <datalist id="material-units">
                {MATERIAL_UNITS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>

          <div>
            <Label>Default rate (₹ per unit)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
              className="mt-1 tabular-nums"
            />
            <p className="mt-1 text-[11px] text-fg-subtle">
              Used as a fallback when a design references this material without an explicit rate.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mt-0.5 rounded border-border-strong text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="text-fg">Active</span>
              <span className="block text-[11px] text-fg-muted">
                Inactive materials don't appear in design or purchase pickers.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add material'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}