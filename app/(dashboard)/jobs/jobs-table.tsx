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
import { StatusBadge, statusVariant } from '@/components/primitives/status-badge'
import { Wrench, Plus } from 'lucide-react'

type Option = { id: string; label: string }
type DesignOption = {
  id: string
  label: string
  default_making_charge_type: string | null
  default_making_charge_value: number | string | null
}
type PurityOption = {
  id: string
  label: string
  purity_percent: number
}

export type JobRow = {
  id: string
  job_number: string
  craftsman_id: string
  job_type: string
  design_id: string | null
  status: string
  making_charge_type: string | null
  making_charge_value: number | string | null
  expected_finished_weight_g: number | string | null
  issued_fine_g: number | string
  returned_fine_g: number | string
  finished_fine_g: number | string
  wastage_fine_g: number | string
  start_date: string | null
  due_date: string | null
  created_at: string
  [key: string]: unknown
}

const JOB_TYPES = [
  'production',
  'repair',
  'alteration',
  'polishing',
  'stone_setting',
  'custom_order',
  'other',
] as const

const STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'delivered',
  'cancelled',
] as const

const MAKING_CHARGE_TYPES = [
  'fixed',
  'per_gram',
  'percent_of_metal',
  'percent_of_total',
] as const

const fmtG = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}

const todayISO = () => new Date().toISOString().slice(0, 10)

const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export function JobsTable({
  jobs,
  craftsmanMap,
  designMap,
  craftsmanOptions,
  designOptions,
  purityOptions,
}: {
  jobs: JobRow[]
  craftsmanMap: Record<string, { name: string; code: string }>
  designMap: Record<string, { name: string; code: string; product_type: string }>
  craftsmanOptions: Option[]
  designOptions: DesignOption[]
  purityOptions: PurityOption[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    craftsman_id: craftsmanOptions[0]?.id ?? '',
    design_id: '',
    job_type: 'production',
    status: 'pending',
    planned_finished_purity_id: purityOptions[0]?.id ?? '',
    making_charge_type: 'fixed' as string,
    making_charge_value: '',
    expected_finished_weight_g: '',
    start_date: todayISO(),
    due_date: '',
    notes: '',
  })

  const uniqueStatuses = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.status))).sort(),
    [jobs],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs.filter((j) => {
      if (statusFilter && j.status !== statusFilter) return false
      if (!q) return true
      const c = craftsmanMap[j.craftsman_id]
      const d = j.design_id ? designMap[j.design_id] : null
      return (
        j.job_number.toLowerCase().includes(q) ||
        (c?.name ?? '').toLowerCase().includes(q) ||
        (c?.code ?? '').toLowerCase().includes(q) ||
        (d?.name ?? '').toLowerCase().includes(q) ||
        (d?.code ?? '').toLowerCase().includes(q)
      )
    })
  }, [jobs, query, statusFilter, craftsmanMap, designMap])

  function openCreate() {
    setForm({
      craftsman_id: craftsmanOptions[0]?.id ?? '',
      design_id: '',
      job_type: 'production',
      status: 'pending',
      planned_finished_purity_id: purityOptions[0]?.id ?? '',
      making_charge_type: 'fixed',
      making_charge_value: '',
      expected_finished_weight_g: '',
      start_date: todayISO(),
      due_date: '',
      notes: '',
    })
    setOpen(true)
  }

  function onDesignChange(newDesignId: string) {
    const designOpt = designOptions.find((d) => d.id === newDesignId)
    setForm((prev) => ({
      ...prev,
      design_id: newDesignId,
      making_charge_type:
        designOpt?.default_making_charge_type ?? prev.making_charge_type,
      making_charge_value:
        designOpt?.default_making_charge_value != null
          ? String(designOpt.default_making_charge_value)
          : prev.making_charge_value,
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.craftsman_id) {
      toast.error('Select a craftsman', { duration: 5000 })
      return
    }
    if (!form.planned_finished_purity_id) {
      toast.error('Select the planned finished purity', { duration: 5000 })
      return
    }
    setSaving(true)
    const payload: Record<string, unknown> = {
      craftsman_id: form.craftsman_id,
      design_id: form.design_id || null,
      job_type: form.job_type.trim(),
      status: form.status.trim(),
      planned_finished_purity_id: form.planned_finished_purity_id || null,
      making_charge_type: form.making_charge_type || null,
      making_charge_value: form.making_charge_value
        ? Number(form.making_charge_value)
        : null,
      expected_finished_weight_g: form.expected_finished_weight_g
        ? Number(form.expected_finished_weight_g)
        : null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    }
    const { data, error } = await createClient()
      .from('craftsman_jobs')
      .insert(payload)
      .select('job_number')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 12000 })
      return
    }
    toast.success(`Job ${data?.job_number ?? ''} created`.trim())
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description={`${jobs.length} job${jobs.length === 1 ? '' : 's'} · ${
          jobs.filter((j) => j.status === 'pending' || j.status === 'in_progress').length
        } active`}
        actions={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New job
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by job #, design, craftsman…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {uniqueStatuses.length > 1 && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All statuses</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={jobs.length === 0 ? 'No jobs yet' : 'No matches'}
          description={
            jobs.length === 0
              ? 'Create the first job to issue metal and stones to a craftsman.'
              : 'Try a different search term or filter.'
          }
          action={
            jobs.length === 0 ? <Button onClick={openCreate}>+ New job</Button> : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Job</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Design</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Craftsman</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Issued g</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Returned g</th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">Finished g</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Due</th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((j) => {
                const c = craftsmanMap[j.craftsman_id]
                const d = j.design_id ? designMap[j.design_id] : null
                const overdue =
                  j.due_date &&
                  ['completed', 'delivered', 'cancelled'].indexOf(j.status) === -1 &&
                  new Date(j.due_date) < new Date()
                return (
                  <tr
                    key={j.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link
                        href={`/jobs/${j.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {j.job_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {d ? (
                        <div>
                          <div className="text-slate-900">{d.name}</div>
                          <div className="font-mono text-xs text-slate-500">{d.code}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {c ? (
                        <div>
                          <div className="text-slate-900">{c.name}</div>
                          <div className="font-mono text-xs text-slate-500">{c.code}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge variant="neutral">{humanize(j.job_type)}</StatusBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {fmtG(j.issued_fine_g)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {fmtG(j.returned_fine_g)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular font-semibold">
                      {fmtG(j.finished_fine_g)}
                    </td>
                    <td
                      className={`px-4 py-2.5 ${
                        overdue ? 'font-medium text-red-600' : 'text-slate-600'
                      }`}
                    >
                      {j.due_date
                        ? new Date(j.due_date).toLocaleDateString('en-IN', {
                            dateStyle: 'medium',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge variant={statusVariant(j.status)}>
                        {humanize(j.status)}
                      </StatusBadge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>New Job</DialogTitle>
              <DialogDescription>
                Create a job card. Job number is generated automatically. Metal and
                stones are issued on the detail page. Making charge is set here and
                carried to the finished piece.
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>
                Craftsman <span className="text-red-500">*</span>
              </Label>
              <select
                required
                value={form.craftsman_id}
                onChange={(e) => setForm({ ...form, craftsman_id: e.target.value })}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {craftsmanOptions.length === 0 && (
                  <option value="">No active craftsmen</option>
                )}
                {craftsmanOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Design</Label>
              <select
                value={form.design_id}
                onChange={(e) => onDesignChange(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">— None —</option>
                {designOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Picking a design prefills the making charge below.
              </p>
            </div>

            <div className="space-y-1">
              <Label>
                Planned finished purity <span className="text-red-500">*</span>
              </Label>
              <select
                required
                value={form.planned_finished_purity_id}
                onChange={(e) =>
                  setForm({ ...form, planned_finished_purity_id: e.target.value })
                }
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {purityOptions.length === 0 ? (
                  <option value="">No active purities configured</option>
                ) : (
                  <>
                    <option value="">— Select purity —</option>
                    {purityOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} ({p.purity_percent.toFixed(2)}%)
                      </option>
                    ))}
                  </>
                )}
              </select>
              {purityOptions.length === 0 && (
                <p className="text-xs text-amber-700">
                  Add purities under{' '}
                  <Link href="/settings/metal" className="underline">
                    Settings → Metal
                  </Link>{' '}
                  first.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  Making charge
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <select
                    value={form.making_charge_type}
                    onChange={(e) =>
                      setForm({ ...form, making_charge_type: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {MAKING_CHARGE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {humanize(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Value</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.making_charge_value}
                    onChange={(e) =>
                      setForm({ ...form, making_charge_value: e.target.value })
                    }
                    placeholder={
                      form.making_charge_type === 'per_gram'
                        ? '₹/gram'
                        : form.making_charge_type === 'fixed'
                          ? '₹ flat'
                          : '%'
                    }
                  />
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                Locked in when the job is created. Editable on the job detail page
                until completion. Persisted to the inventory piece on completion.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  Job type <span className="text-red-500">*</span>
                </Label>
                <select
                  required
                  value={form.job_type}
                  onChange={(e) => setForm({ ...form, job_type: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {JOB_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {humanize(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>
                  Initial status <span className="text-red-500">*</span>
                </Label>
                <select
                  required
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Expected finished weight (g)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.expected_finished_weight_g}
                  onChange={(e) =>
                    setForm({ ...form, expected_finished_weight_g: e.target.value })
                  }
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Start date</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything the craftsman needs to know"
              />
            </div>

            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creating…' : 'Create Job'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}