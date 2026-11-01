'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/primitives/page-header'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  UserPlus,
  Pencil,
  Mail,
  X,
  RefreshCw,
  ShieldCheck,
  User,
  Users,
  Clock,
  Ban,
  ArrowLeft,
} from 'lucide-react'
import {
  inviteUser,
  updateUser,
  resendInvite,
  cancelInvite,
} from '@/lib/actions/users'

type Profile = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: string
  is_active: boolean
  craftsman_id: string | null
  last_sign_in_at: string | null
  created_at: string
}

type Craftsman = {
  id: string
  code: string
  name: string
  is_active: boolean
}

type Invite = {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: string
  craftsman_id: string | null
  status: string
  invited_at: string
  accepted_at: string | null
  invited_by: string | null
}

const STAFF_ROLES = [
  { value: 'admin', label: 'Admin', hint: 'Full access to everything' },
  { value: 'manager', label: 'Manager', hint: 'Operations, inventory, staff' },
  { value: 'accountant', label: 'Accountant', hint: 'Finance, books, reports' },
  { value: 'sales', label: 'Sales', hint: 'POS, invoices, customers' },
  { value: 'viewer', label: 'Viewer', hint: 'Read-only dashboard access' },
  { value: 'craftsman', label: 'Craftsman (in-house)', hint: 'Karigar on payroll' },
  { value: 'karigar', label: 'Karigar (outsourced)', hint: 'External artisan' },
] as const

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-rose-50 text-rose-700 ring-rose-200',
  manager: 'bg-amber-50 text-amber-700 ring-amber-200',
  accountant: 'bg-sky-50 text-sky-700 ring-sky-200',
  sales: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  viewer: 'bg-slate-100 text-slate-700 ring-slate-200',
  craftsman: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  karigar: 'bg-violet-50 text-violet-700 ring-violet-200',
  customer: 'bg-stone-100 text-stone-700 ring-stone-200',
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return 'never'
  return new Date(d).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

type Form = {
  full_name: string
  email: string
  phone: string
  role: string
  craftsman_id: string
  is_active: boolean
  notes: string
}

const emptyForm: Form = {
  full_name: '',
  email: '',
  phone: '',
  role: 'sales',
  craftsman_id: '',
  is_active: true,
  notes: '',
}

export function UsersClient({
  initialProfiles,
  craftsmen,
  initialInvites,
}: {
  initialProfiles: Profile[]
  craftsmen: Craftsman[]
  initialInvites: Invite[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const craftsmanById = new Map(craftsmen.map((c) => [c.id, c]))

  function openInvite() {
    setForm(emptyForm)
    setInviteOpen(true)
  }
  function openEdit(p: Profile) {
    setEditTarget(p)
    setForm({
      full_name: p.full_name,
      email: p.email ?? '',
      phone: p.phone ?? '',
      role: p.role,
      craftsman_id: p.craftsman_id ?? '',
      is_active: p.is_active,
      notes: '',
    })
  }
  function closeDialogs() {
    setInviteOpen(false)
    setEditTarget(null)
    setForm(emptyForm)
  }

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await inviteUser({
      email: form.email.trim(),
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      role: form.role as any,
      craftsman_id: form.craftsman_id || null,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (res.error) {
      toast.error(res.error, { duration: 10000 })
      return
    }
    toast.success(`Invite sent to ${form.email}`)
    closeDialogs()
    router.refresh()
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    const res = await updateUser({
      userId: editTarget.id,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      role: form.role as any,
      is_active: form.is_active,
      craftsman_id: form.craftsman_id || null,
    })
    setSaving(false)
    if (res.error) {
      toast.error(res.error, { duration: 10000 })
      return
    }
    toast.success('User updated')
    closeDialogs()
    router.refresh()
  }

  async function handleResend(invite: Invite) {
    setBusyInviteId(invite.id)
    const res = await resendInvite(invite.id)
    setBusyInviteId(null)
    if (res.error) toast.error(res.error, { duration: 10000 })
    else {
      toast.success(`Invite re-sent to ${invite.email}`)
      router.refresh()
    }
  }

  async function handleCancel(invite: Invite) {
    if (!confirm(`Cancel invite for ${invite.email}?`)) return
    setBusyInviteId(invite.id)
    const res = await cancelInvite(invite.id)
    setBusyInviteId(null)
    if (res.error) toast.error(res.error, { duration: 10000 })
    else {
      toast.success('Invite cancelled')
      router.refresh()
    }
  }

  // ── Filtering ──
  const q = search.trim().toLowerCase()
  const filtered = initialProfiles.filter((p) => {
    if (roleFilter && p.role !== roleFilter) return false
    if (!q) return true
    return (
      p.full_name.toLowerCase().includes(q) ||
      (p.email ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').toLowerCase().includes(q)
    )
  })

  // ── Stats ──
  const activeCount = initialProfiles.filter((p) => p.is_active).length
  const inactiveCount = initialProfiles.length - activeCount
  const roleCounts: Record<string, number> = {}
  for (const p of initialProfiles) {
    roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1
  }

  const needsCraftsmanLink =
    form.role === 'craftsman' || form.role === 'karigar'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Members"
        description="Manage staff accounts and invite new team members."
        actions={
          <div className="flex gap-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All settings
            </Link>
            <Button onClick={openInvite} className="gap-2">
              <UserPlus className="h-4 w-4" /> Invite user
            </Button>
          </div>
        }
      />

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Users} label="Total users" value={String(initialProfiles.length)} tone="slate" />
        <Stat icon={ShieldCheck} label="Active" value={String(activeCount)} tone="emerald" />
        <Stat icon={Ban} label="Inactive" value={String(inactiveCount)} tone="rose" />
        <Stat icon={Clock} label="Pending invites" value={String(initialInvites.length)} tone="amber" />
      </div>

      {/* ── Pending invites ── */}
      {initialInvites.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/40">
          <div className="flex items-center justify-between border-b border-amber-200 px-4 py-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-700" />
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                Pending invites · {initialInvites.length}
              </p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-amber-100/40">
              <tr className="border-b border-amber-200">
                <th className="px-4 py-2 text-left font-medium text-amber-900">Name</th>
                <th className="px-4 py-2 text-left font-medium text-amber-900">Email</th>
                <th className="px-4 py-2 text-left font-medium text-amber-900">Role</th>
                <th className="px-4 py-2 text-left font-medium text-amber-900">Sent</th>
                <th className="px-4 py-2 text-right font-medium text-amber-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {initialInvites.map((inv) => (
                <tr key={inv.id} className="border-b border-amber-200/60 last:border-0">
                  <td className="px-4 py-2 font-medium text-amber-900">{inv.full_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-amber-900">
                    {inv.email}
                  </td>
                  <td className="px-4 py-2">
                    <RoleBadge role={inv.role} />
                  </td>
                  <td className="px-4 py-2 text-xs text-amber-800">{fmtDate(inv.invited_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyInviteId === inv.id}
                        onClick={() => handleResend(inv)}
                        className="gap-1"
                        title="Resend invite"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Resend
                      </Button>
                      <Button
                        type="button"
                        variant="destructive-ghost"
                        size="sm"
                        disabled={busyInviteId === inv.id}
                        onClick={() => handleCancel(inv)}
                        title="Cancel invite"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search by name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All roles</option>
          {STAFF_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label} ({roleCounts[r.value] ?? 0})
            </option>
          ))}
        </select>
      </div>

      {/* ── Users table ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">User</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Email</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Role</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Craftsman</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Last sign-in</th>
              <th className="px-4 py-2.5 text-center font-medium text-slate-600">Status</th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  {initialProfiles.length === 0
                    ? 'No users yet. Click "Invite user" to add your first team member.'
                    : 'No users match your filters.'}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const linked = p.craftsman_id ? craftsmanById.get(p.craftsman_id) : null
              return (
                <tr
                  key={p.id}
                  className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                    !p.is_active ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                        {p.full_name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                      <span className="font-medium text-slate-900">{p.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">
                    {p.email ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <RoleBadge role={p.role} />
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {linked ? (
                      <Link
                        href={`/craftsmen/${linked.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {linked.name} · {linked.code}
                      </Link>
                    ) : p.craftsman_id ? (
                      <span className="text-slate-400">{p.craftsman_id.slice(0, 8)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {fmtDateTime(p.last_sign_in_at)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {p.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-200">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(p)}
                      className="gap-1"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        New members receive a Supabase invite email — they click the link, set a
        password, and land signed in. Craftsman and Karigar roles require a linked
        craftsman record so jobs, metal issues, and payments attach to the right
        person. Deactivating a user signs them out immediately.
      </p>

      {/* ── Invite dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={(o) => !o && closeDialogs()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              We&apos;ll send an invite email. Once they set a password, they land in
              the dashboard with the role you choose.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitInvite} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>
                  Full name <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  placeholder="Rahul Sharma"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="rahul@company.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Role <span className="text-red-500">*</span>
                </Label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  {STAFF_ROLES.find((r) => r.value === form.role)?.hint}
                </p>
              </div>
            </div>

            {needsCraftsmanLink && (
              <div className="space-y-1">
                <Label>
                  Linked craftsman <span className="text-red-500">*</span>
                </Label>
                <select
                  required
                  value={form.craftsman_id}
                  onChange={(e) => set('craftsman_id', e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">— Select craftsman —</option>
                  {craftsmen.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="Optional internal note"
              />
            </div>

            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={closeDialogs}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                <Mail className="h-4 w-4" />
                {saving ? 'Sending…' : 'Send invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && closeDialogs()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Change the user&apos;s role, contact details, or active status.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Full name</Label>
                <Input
                  required
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Email (read-only)</Label>
                <Input value={form.email} disabled className="bg-slate-50 font-mono" />
                <p className="text-[10px] text-slate-500">
                  Email can&apos;t be changed here. Use Supabase Auth admin for that.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {STAFF_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {needsCraftsmanLink && (
              <div className="space-y-1">
                <Label>Linked craftsman</Label>
                <select
                  required
                  value={form.craftsman_id}
                  onChange={(e) => set('craftsman_id', e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">— Select craftsman —</option>
                  {craftsmen.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => set('is_active', e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                Active — user can sign in and use the system
              </label>
              <p className="mt-1 text-[10px] text-slate-500">
                Deactivating signs them out of all sessions immediately.
              </p>
            </div>

            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={closeDialogs}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any
  label: string
  value: string
  tone: 'slate' | 'emerald' | 'rose' | 'amber'
}) {
  const cls: Record<typeof tone, string> = {
    slate: 'text-slate-700 bg-slate-100',
    emerald: 'text-emerald-700 bg-emerald-50',
    rose: 'text-rose-700 bg-rose-50',
    amber: 'text-amber-700 bg-amber-50',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${cls[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular text-slate-900">{value}</p>
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_COLORS[role] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
  const label = STAFF_ROLES.find((r) => r.value === role)?.label ?? role
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  )
}