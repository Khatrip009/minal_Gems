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
import {
  Gem, Pencil, Plus, Power, Sparkles,
} from 'lucide-react'
import {
  FLUORESCENCE_GRADES, STONE_CATEGORIES, STONE_CLARITY, STONE_COLORS,
  STONE_CUTS, STONE_SHAPES,
} from '@/lib/catalog-constants'
import { cn } from '@/lib/utils'

type Stone = {
  id: string
  category: string
  name: string | null
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
  fluorescence: string | null
  origin: string | null
  is_active: boolean
}

type Props = {
  stones: Stone[]
  usageByStone: Record<string, number>
}

const categoryLabel = (v: string) => STONE_CATEGORIES.find((c) => c.value === v)?.label ?? v

export function StoneMasterTable({ stones, usageByStone }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Stone | null>(null)

  const [togglingId, setTogglingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return stones.filter((s) => {
      if (category !== 'all' && s.category !== category) return false
      if (status === 'active' && !s.is_active) return false
      if (status === 'inactive' && s.is_active) return false
      if (!q) return true
      return [s.name, s.shape, s.color, s.clarity, s.cut, s.origin]
        .some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [stones, search, category, status])

  const counts = useMemo(() => {
    return {
      total: stones.length,
      active: stones.filter((s) => s.is_active).length,
      inactive: stones.filter((s) => !s.is_active).length,
      byCategory: STONE_CATEGORIES.reduce<Record<string, number>>((acc, c) => {
        acc[c.value] = stones.filter((s) => s.category === c.value).length
        return acc
      }, {}),
    }
  }, [stones])

  async function toggleActive(s: Stone) {
    setTogglingId(s.id)
    const { error } = await supabase
      .from('stone_master')
      .update({ is_active: !s.is_active })
      .eq('id', s.id)
    setTogglingId(null)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(s.is_active ? 'Stone type deactivated' : 'Stone type reactivated')
      router.refresh()
    }
  }

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }
  function openEdit(s: Stone) {
    setEditing(s)
    setDialogOpen(true)
  }

  const columns: Column<Stone>[] = [
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      cell: (s) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-fg">
          <Gem className="h-3.5 w-3.5 text-fg-subtle" />
          {categoryLabel(s.category)}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Stone',
      sortable: true,
      cell: (s) => (
        <div>
          <div className="text-sm font-medium text-fg">{s.name ?? '—'}</div>
          <div className="mt-0.5 text-[11px] text-fg-muted">
            {[s.shape, s.color, s.clarity, s.cut].filter(Boolean).join(' · ') || 'No 4C details'}
          </div>
        </div>
      ),
    },
    {
      key: 'fluorescence',
      header: 'Fluor.',
      cell: (s) => (
        <span className="text-xs text-fg-muted">{s.fluorescence ?? '—'}</span>
      ),
    },
    {
      key: 'origin',
      header: 'Origin',
      cell: (s) => (
        <span className="text-xs text-fg-muted">{s.origin ?? '—'}</span>
      ),
    },
    {
      key: 'usage',
      header: 'Used in',
      align: 'center',
      cell: (s) => {
        const n = usageByStone[s.id] ?? 0
        return n > 0 ? (
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs tabular-nums text-fg">
            {n} {n === 1 ? 'design' : 'designs'}
          </span>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        )
      },
    },
    {
      key: 'is_active',
      header: 'Status',
      cell: (s) =>
        s.is_active ? (
          <StatusBadge def={{ label: 'Active', tone: 'success' }} />
        ) : (
          <StatusBadge def={{ label: 'Inactive', tone: 'muted' }} />
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEdit(s)}
            aria-label="Edit stone type"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleActive(s)}
            disabled={togglingId === s.id}
            aria-label={s.is_active ? 'Deactivate' : 'Reactivate'}
            title={s.is_active ? 'Deactivate' : 'Reactivate'}
          >
            <Power className={cn('h-4 w-4', s.is_active ? 'text-success' : 'text-fg-subtle')} />
          </Button>
        </div>
      ),
    },
  ]

  // No stone types at all
  if (stones.length === 0) {
    return (
      <>
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted p-8 text-center sm:p-12">
          <Gem className="mx-auto mb-3 h-10 w-10 text-fg-subtle" />
          <h3 className="text-base font-semibold text-fg">No stone types yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">
            Stone types describe what a stone <em>is</em> — diamond, ruby, CZ — and its 4C
            profile. You reference them when defining designs and receiving stone stock.
          </p>
          <Button size="lg" onClick={openNew} className="mt-5">
            <Plus className="h-4 w-4" /> Add your first stone type
          </Button>
        </div>
        <StoneDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          onSaved={() => { setDialogOpen(false); router.refresh() }}
        />
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, shape, clarity…"
            className="w-64"
          />
        </div>

        <label className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs">
          <span className="text-fg-muted">Category:</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="cursor-pointer bg-transparent text-fg focus:outline-none"
          >
            <option value="all">All ({counts.total})</option>
            {STONE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({counts.byCategory[c.value] ?? 0})
              </option>
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
          {filtered.length} of {stones.length}
        </span>

        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Add stone type
        </Button>
      </div>

      {/* Table / cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-muted p-10 text-center">
          <p className="text-sm font-medium text-fg">No stone types match your filters</p>
          <button
            type="button"
            onClick={() => { setSearch(''); setCategory('all'); setStatus('all') }}
            className="mt-2 text-xs text-brand-700 underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <DataTable<Stone>
          columns={columns}
          rows={filtered}
          rowKey={(s) => s.id}
          onRowClick={openEdit}
          searchPlaceholder="Search…"
          mobileCard={(s) => {
            const n = usageByStone[s.id] ?? 0
            return (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted">
                  <Gem className="h-5 w-5 text-fg-subtle" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-fg">{s.name ?? '—'}</span>
                    {s.is_active ? (
                      <StatusBadge def={{ label: 'Active', tone: 'success' }} />
                    ) : (
                      <StatusBadge def={{ label: 'Inactive', tone: 'muted' }} />
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-fg-muted">
                    {categoryLabel(s.category)}
                    {[s.shape, s.color, s.clarity].filter(Boolean).length > 0 && (
                      <> · {[s.shape, s.color, s.clarity].filter(Boolean).join(' · ')}</>
                    )}
                  </div>
                  {n > 0 && (
                    <div className="mt-1 text-[11px] text-fg-subtle">
                      Used in {n} {n === 1 ? 'design' : 'designs'}
                    </div>
                  )}
                </div>
              </div>
            )
          }}
        />
      )}

      <StoneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => { setDialogOpen(false); router.refresh() }}
      />
    </div>
  )
}

// ─── Dialog ────────────────────────────────────────────────────────────

function StoneDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Stone | null
  onSaved: () => void
}) {
  const supabase = createClient()
  const [category, setCategory] = useState<string>(editing?.category ?? 'diamond')
  const [name, setName] = useState(editing?.name ?? '')
  const [shape, setShape] = useState(editing?.shape ?? '')
  const [color, setColor] = useState(editing?.color ?? '')
  const [clarity, setClarity] = useState(editing?.clarity ?? '')
  const [cut, setCut] = useState(editing?.cut ?? '')
  const [fluorescence, setFluorescence] = useState(editing?.fluorescence ?? '')
  const [origin, setOrigin] = useState(editing?.origin ?? '')
  const [isActive, setIsActive] = useState(editing?.is_active ?? true)
  const [saving, setSaving] = useState(false)

  // Reset when the dialog re-opens for a different row
  const formKey = editing?.id ?? 'new'
  const [lastKey, setLastKey] = useState(formKey)
  if (lastKey !== formKey) {
    setLastKey(formKey)
    setCategory(editing?.category ?? 'diamond')
    setName(editing?.name ?? '')
    setShape(editing?.shape ?? '')
    setColor(editing?.color ?? '')
    setClarity(editing?.clarity ?? '')
    setCut(editing?.cut ?? '')
    setFluorescence(editing?.fluorescence ?? '')
    setOrigin(editing?.origin ?? '')
    setIsActive(editing?.is_active ?? true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Give the stone a name')
      return
    }
    setSaving(true)
    try {
      const payload = {
        category,
        name: name.trim(),
        shape: shape.trim() || null,
        color: color.trim() || null,
        clarity: clarity.trim() || null,
        cut: cut.trim() || null,
        fluorescence: fluorescence || null,
        origin: origin.trim() || null,
        is_active: isActive,
      }

      const { error } = editing
        ? await supabase.from('stone_master').update(payload).eq('id', editing.id)
        : await supabase.from('stone_master').insert(payload)
      if (error) throw error

      toast.success(editing ? 'Stone type updated' : 'Stone type added')
      onSaved()
    } catch (err: any) {
      toast.error(err?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            {editing ? 'Edit stone type' : 'Add stone type'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Category */}
          <div>
            <Label>Category <span className="text-danger">*</span></Label>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {STONE_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    'rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                    category === c.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg',
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-fg-subtle">
              {STONE_CATEGORIES.find((c) => c.value === category)?.hint}
            </p>
          </div>

          {/* Name */}
          <div>
            <Label>Name <span className="text-danger">*</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Round brilliant 0.5ct · White · VVS1"
              className="mt-1"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-fg-subtle">
              A short label your team will recognise. Shown wherever this stone is referenced.
            </p>
          </div>

          {/* 4C grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Shape</Label>
              <Input
                list="stone-shapes"
                value={shape}
                onChange={(e) => setShape(e.target.value)}
                placeholder="Round, Oval…"
                className="mt-1"
              />
              <datalist id="stone-shapes">
                {STONE_SHAPES.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <Label>Color</Label>
              <Input
                list="stone-colors"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="D, F, White…"
                className="mt-1"
              />
              <datalist id="stone-colors">
                {STONE_COLORS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <Label>Clarity</Label>
              <Input
                list="stone-clarity"
                value={clarity}
                onChange={(e) => setClarity(e.target.value)}
                placeholder="VVS1, SI2…"
                className="mt-1"
              />
              <datalist id="stone-clarity">
                {STONE_CLARITY.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <Label>Cut</Label>
              <Input
                list="stone-cuts"
                value={cut}
                onChange={(e) => setCut(e.target.value)}
                placeholder="Excellent…"
                className="mt-1"
              />
              <datalist id="stone-cuts">
                {STONE_CUTS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fluorescence</Label>
              <select
                value={fluorescence}
                onChange={(e) => setFluorescence(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">— None / unspecified —</option>
                {FLUORESCENCE_GRADES.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Label>Origin</Label>
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Surat, South Africa…"
                className="mt-1"
              />
            </div>
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
                Inactive stone types don't appear in the design form picker, but stay linked to existing designs.
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add stone type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}