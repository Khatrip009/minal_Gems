'use client'
import { useMemo, useState } from 'react'
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
import { Building2, Plus } from 'lucide-react'

const VENDOR_TYPES = ['metal', 'stone', 'finding', 'service', 'other'] as const
type VendorType = (typeof VENDOR_TYPES)[number]

export type VendorRow = {
  id: string
  name: string
  vendor_type: VendorType
  contact: { email?: string; phone?: string; [k: string]: unknown } | null
  gstin: string | null
  is_active: boolean
}

type FormState = {
  name: string
  vendor_type: VendorType
  email: string
  phone: string
  gstin: string
  is_active: boolean
}

function toForm(v: VendorRow | null): FormState {
  return {
    name: v?.name ?? '',
    vendor_type: v?.vendor_type ?? 'metal',
    email: (v?.contact?.email as string) ?? '',
    phone: (v?.contact?.phone as string) ?? '',
    gstin: v?.gstin ?? '',
    is_active: v?.is_active ?? true,
  }
}

export function VendorsTable({ rows }: { rows: VendorRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VendorRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(toForm(null))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.vendor_type.toLowerCase().includes(q) ||
        (v.gstin ?? '').toLowerCase().includes(q) ||
        (v.contact?.email ?? '').toLowerCase().includes(q) ||
        (v.contact?.phone ?? '').toLowerCase().includes(q),
    )
  }, [rows, query])

  function openCreate() {
    setForm(toForm(null))
    setEditing(null)
    setOpen(true)
  }
  function openEdit(v: VendorRow) {
    setForm(toForm(v))
    setEditing(v)
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const contact = {
      ...((editing?.contact as Record<string, unknown>) ?? {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
    }
    if (!contact.email) delete contact.email
    if (!contact.phone) delete contact.phone

    const payload = {
      name: form.name.trim(),
      vendor_type: form.vendor_type,
      gstin: form.gstin.trim() || null,
      is_active: form.is_active,
      contact,
    }
    const sb = createClient()
    const { error } = editing
      ? await sb.from('vendors').update(payload).eq('id', editing.id)
      : await sb.from('vendors').insert(payload)
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 8000 })
      return
    }
    toast.success(editing ? 'Vendor updated' : 'Vendor created')
    setOpen(false)
    router.refresh()
  }

  async function toggleActive(v: VendorRow) {
    const { error } = await createClient()
      .from('vendors')
      .update({ is_active: !v.is_active })
      .eq('id', v.id)
    if (error) {
      toast.error(error.message, { duration: 8000 })
      return
    }
    toast.success(v.is_active ? 'Vendor deactivated' : 'Vendor activated')
    router.refresh()
  }

  const activeCount = rows.filter((v) => v.is_active).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description={`${rows.length} total · ${activeCount} active`}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New vendor
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by name, type, GSTIN, contact…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? 'No vendors yet' : 'No matches'}
          description={
            rows.length === 0
              ? 'Add your first supplier to start purchasing metal and stones.'
              : 'Try a different search term.'
          }
          action={rows.length === 0 ? <Button onClick={openCreate}>+ New vendor</Button> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">GSTIN</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Contact</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
                <th className="w-1 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{v.name}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge variant="neutral">
                      {v.vendor_type.charAt(0).toUpperCase() + v.vendor_type.slice(1)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                    {v.gstin ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs leading-5">
                    {v.contact?.email && (
                      <div className="text-slate-900">{v.contact.email}</div>
                    )}
                    {v.contact?.phone && (
                      <div className="text-slate-500">{v.contact.phone}</div>
                    )}
                    {!v.contact?.email && !v.contact?.phone && (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge variant={v.is_active ? 'success' : 'neutral'}>
                      {v.is_active ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(v)}>
                      {v.is_active ? 'Deactivate' : 'Activate'}
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
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{editing ? 'Edit Vendor' : 'New Vendor'}</DialogTitle>
              <DialogDescription>
                {editing
                  ? `Update the details for ${editing.name}.`
                  : 'Add a supplier for metal, stones, findings, or services.'}
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Type <span className="text-red-500">*</span>
                </Label>
                <select
                  required
                  value={form.vendor_type}
                  onChange={(e) =>
                    setForm({ ...form, vendor_type: e.target.value as VendorType })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {VENDOR_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="vendor@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>GSTIN</Label>
              <Input
                value={form.gstin}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
                className="font-mono"
              />
            </div>

            <div className="pt-2">
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
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Vendor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}