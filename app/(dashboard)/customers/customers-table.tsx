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
import { Users, Plus, Search, Phone, Mail, ArrowRight } from 'lucide-react'

export type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  gstin: string | null
  pan: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export type CustomerWithStats = Customer & {
  total_invoices: number
  total_invoiced: number
  total_paid: number
  balance_due: number
}

type FormState = {
  name: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  pincode: string
  gstin: string
  pan: string
  notes: string
  is_active: boolean
}

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

function toForm(c: Customer | null): FormState {
  return {
    name: c?.name ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    address: c?.address ?? '',
    city: c?.city ?? '',
    state: c?.state ?? '',
    pincode: c?.pincode ?? '',
    gstin: c?.gstin ?? '',
    pan: c?.pan ?? '',
    notes: c?.notes ?? '',
    is_active: c?.is_active ?? true,
  }
}

export function CustomersTable({ rows }: { rows: CustomerWithStats[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(toForm(null))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.gstin ?? '').toLowerCase().includes(q),
    )
  }, [rows, query])

  function openCreate() {
    setForm(toForm(null))
    setEditing(null)
    setOpen(true)
  }
  function openEdit(c: Customer) {
    setForm(toForm(c))
    setEditing(c)
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      pincode: form.pincode.trim() || null,
      gstin: form.gstin.trim() || null,
      pan: form.pan.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    }
    const sb = createClient()
    const { error } = editing
      ? await sb.from('customers').update(payload).eq('id', editing.id)
      : await sb.from('customers').insert(payload)
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 12000 })
      return
    }
    toast.success(editing ? 'Customer updated' : 'Customer created')
    setOpen(false)
    router.refresh()
  }

  async function toggleActive(c: Customer) {
    const { error } = await createClient()
      .from('customers')
      .update({ is_active: !c.is_active })
      .eq('id', c.id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(c.is_active ? 'Customer deactivated' : 'Customer activated')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${rows.length} customer${rows.length === 1 ? '' : 's'}`}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New customer
          </Button>
        }
      />

      <div className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by name, phone, GSTIN…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={rows.length === 0 ? 'No customers yet' : 'No matches'}
          description={
            rows.length === 0
              ? 'Add your first customer to start creating invoices.'
              : 'Try a different search term.'
          }
          action={
            rows.length === 0 ? (
              <Button onClick={openCreate}>+ New customer</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Contact</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Invoices</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Total Spent</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Balance Due</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/customers/${c.id}`} className="hover:text-brand-700 hover:underline">
                      {c.name}
                    </Link>
                    {c.gstin && <p className="text-[10px] font-mono text-slate-400 mt-0.5">{c.gstin}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.phone && <div className="flex items-center gap-1 text-slate-700"><Phone className="h-3 w-3 text-slate-400" /> {c.phone}</div>}
                    {c.email && <div className="flex items-center gap-1 text-slate-500 mt-0.5"><Mail className="h-3 w-3 text-slate-400" /> {c.email}</div>}
                    {!c.phone && !c.email && <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">{c.total_invoices}</td>
                  <td className="px-4 py-3 text-right tabular text-slate-900">Rs. {fmtMoney(c.total_invoiced)}</td>
                  <td className="px-4 py-3 text-right tabular font-bold">
                    <span className={Number(c.balance_due) > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      Rs. {fmtMoney(c.balance_due)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                        c.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'
                      }`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link href={`/customers/${c.id}`}>
                      <Button variant="ghost" size="sm" className="gap-1 text-brand-600 hover:bg-brand-50 mr-1">
                        Ledger <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(c)} className={c.is_active ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}>
                      {c.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{editing ? 'Edit customer' : 'New customer'}</DialogTitle>
              <DialogDescription>Details shown on the invoice.</DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Pincode</Label>
                <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>GSTIN</Label>
                <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} className="font-mono" maxLength={15} />
              </div>
              <div className="space-y-1">
                <Label>PAN</Label>
                <Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} className="font-mono" maxLength={10} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              Active
            </label>
            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Customer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}