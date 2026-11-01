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
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/primitives/page-header'
import { EmptyState } from '@/components/primitives/empty-state'
import { StatusBadge } from '@/components/primitives/status-badge'
import { Users, Plus } from 'lucide-react'

export type CraftsmanRow = {
  id: string
  code: string
  name: string
  phone: string | null
  skill_type: string | null
  is_inhouse: boolean
  is_active: boolean
  kyc: Record<string, unknown> | null
  total_earnings: number
  total_paid: number
  balance_owed: number
}

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
}

type FormState = {
  name: string
  phone: string
  skill_type: string
  is_inhouse: boolean
  is_active: boolean
}

const toForm = (c: CraftsmanRow | null): FormState => ({
  name: c?.name ?? '',
  phone: c?.phone ?? '',
  skill_type: c?.skill_type ?? '',
  is_inhouse: c?.is_inhouse ?? false,
  is_active: c?.is_active ?? true,
})

export function CraftsmenTable({
  rows,
  initialQuery = '',
}: {
  rows: CraftsmanRow[]
  initialQuery?: string
}) {
  const router = useRouter()
  const supabase = createClient()  
  const [query, setQuery] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CraftsmanRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(toForm(null))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        (r.skill_type ?? '').toLowerCase().includes(q),
    )
  }, [rows, query])

  function openCreate() {
    setForm(toForm(null))
    setEditing(null)
    setOpen(true)
  }
  function openEdit(c: CraftsmanRow) {
    setForm(toForm(c))
    setEditing(c)
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    const payload = {
      name,
      phone: form.phone.trim() || null,
      skill_type: form.skill_type.trim() || null,
      is_inhouse: form.is_inhouse,
      is_active: form.is_active,
    }
    const { error } = editing
      ? await supabase.from('craftsmen').update(payload).eq('id', editing.id)
      : await supabase.from('craftsmen').insert(payload)
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 8000 })
      return
    }
    toast.success(editing ? 'Craftsman updated' : 'Craftsman created')
    setOpen(false)
    router.refresh()
  }

  async function toggleActive(c: CraftsmanRow) {
    setTogglingId(c.id)
    const { error } = await supabase
      .from('craftsmen')
      .update({ is_active: !c.is_active })
      .eq('id', c.id)
    setTogglingId(null)
    if (error) {
      toast.error(error.message, { duration: 8000 })
      return
    }
    toast.success(c.is_active ? 'Craftsman deactivated' : 'Craftsman activated')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Craftsmen"
        description={`${rows.length} total · ${rows.filter((r) => r.is_active).length} active`}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New craftsman
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by name, code, skill…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'No craftsmen yet' : 'No matches'}
          description={
            rows.length === 0
              ? 'Add your first craftsman to start creating jobs.'
              : 'Try a different search term.'
          }
          action={
            rows.length === 0 ? (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" /> New craftsman
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Code</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Total Earned</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Total Paid</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Balance Owed</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
                <th className="w-1 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs">{c.code}</td>
                  <td className="px-4 py-2.5 font-medium">
                    <Link href={`/craftsmen/${c.id}`} className="text-brand-700 hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-[10px] text-slate-400">{c.skill_type || 'General'}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    ₹ {fmtMoney(c.total_earnings)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-600">
                    ₹ {fmtMoney(c.total_paid)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">
                    <span className={c.balance_owed > 0 ? 'text-rose-600' : 'text-slate-400'}>
                      ₹ {fmtMoney(c.balance_owed)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge variant={c.is_active ? 'success' : 'neutral'}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={togglingId === c.id}
                      onClick={() => toggleActive(c)}
                    >
                      {togglingId === c.id
                        ? '…'
                        : c.is_active
                          ? 'Deactivate'
                          : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{editing ? 'Edit Craftsman' : 'New Craftsman'}</DialogTitle>
              <DialogDescription>
                {editing
                  ? `Update details for ${editing.name}.`
                  : 'Add a new craftsman. The code is generated automatically.'}
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 pt-2">
            {editing && (
              <div className="space-y-1">
                <Label>Code</Label>
                <Input value={editing.code} readOnly className="bg-slate-50 font-mono" />
                <p className="text-xs text-slate-500">Codes are permanent.</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91…"
                />
              </div>
              <div className="space-y-1">
                <Label>Skill Type</Label>
                <Input
                  value={form.skill_type}
                  onChange={(e) => setForm({ ...form, skill_type: e.target.value })}
                  placeholder="goldsmith, stone setter"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={form.is_inhouse}
                  onChange={(e) => setForm({ ...form, is_inhouse: e.target.checked })}
                />
                In-house (Direct employee)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Craftsman'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}