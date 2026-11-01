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
import { Database, Plus } from 'lucide-react'

export type RefField = {
  name: string
  label: string
  type?: 'text' | 'number' | 'checkbox' | 'select' | 'textarea'
  required?: boolean
  step?: string
  default?: unknown
  options?: { value: string | number; label: string }[]
  transform?: (v: unknown) => unknown
  help?: string
}

export type RefColumn = {
  key: string
  label: string
  align?: 'left' | 'right'
  boolean?: boolean
  format?: (row: Record<string, unknown>) => React.ReactNode
}

type Props = {
  title: string
  singular: string
  table: string
  columns: RefColumn[]
  fields: RefField[]
  rows: Record<string, unknown>[]
  canCreate?: boolean
  canEdit?: boolean
  canDelete?: boolean
  rowIdKey?: string
  canSearch?: boolean
}

export function ReferenceTable({
  title,
  singular,
  table,
  columns,
  fields,
  rows,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  rowIdKey = 'id',
  canSearch = true,
}: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Record<string, unknown>>({})

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      columns.some((c) => {
        const v = row[c.key]
        return v != null && String(v).toLowerCase().includes(q)
      }),
    )
  }, [rows, query, columns])

  function defaults() {
    const v: Record<string, unknown> = {}
    fields.forEach((f) => {
      v[f.name] = f.default ?? (f.type === 'checkbox' ? true : '')
    })
    return v
  }

  function openCreate() {
    setValues(defaults())
    setEditing(null)
    setOpen(true)
  }
  function openEdit(row: Record<string, unknown>) {
    const v: Record<string, unknown> = {}
    fields.forEach((f) => {
      v[f.name] = row[f.name] ?? f.default ?? (f.type === 'checkbox' ? false : '')
    })
    setValues(v)
    setEditing(row)
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload: Record<string, unknown> = {}
    fields.forEach((f) => {
      const raw = values[f.name]
      payload[f.name] = f.transform ? f.transform(raw) : raw
    })
    const sb = createClient()
    const { error } = editing
      ? await sb.from(table).update(payload).eq(rowIdKey, editing[rowIdKey])
      : await sb.from(table).insert(payload)
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 8000 })
      return
    }
    toast.success(editing ? `${singular} updated` : `${singular} created`)
    setOpen(false)
    router.refresh()
  }

  async function remove(row: Record<string, unknown>) {
    if (!confirm(`Delete this ${singular.toLowerCase()}?`)) return
    const { error } = await createClient()
      .from(table)
      .delete()
      .eq(rowIdKey, row[rowIdKey])
    if (error) {
      toast.error(error.message, { duration: 8000 })
      return
    }
    toast.success(`${singular} deleted`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={`${rows.length} ${rows.length === 1 ? singular.toLowerCase() : title.toLowerCase()}`}
        actions={
          canCreate ? (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> New {singular.toLowerCase()}
            </Button>
          ) : null
        }
      />

      {canSearch && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-72">
            <Input
              placeholder={`Search ${title.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? `No ${title.toLowerCase()} yet` : 'No matches'}
          description={
            rows.length === 0
              ? `Add the first ${singular.toLowerCase()} to get started.`
              : 'Try a different search term.'
          }
          action={
            rows.length === 0 && canCreate ? (
              <Button onClick={openCreate}>+ New {singular.toLowerCase()}</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`px-4 py-2.5 font-medium text-slate-600 text-${c.align ?? 'left'}`}
                  >
                    {c.label}
                  </th>
                ))}
                {(canEdit || canDelete) && <th className="w-1 px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={String(row[rowIdKey])}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-4 py-2.5 text-${c.align ?? 'left'}`}
                    >
                      {c.boolean
                        ? row[c.key]
                          ? '✓'
                          : '—'
                        : c.format
                          ? c.format(row)
                          : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => remove(row)}
                        >
                          Delete
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>
                {editing ? `Edit ${singular}` : `New ${singular}`}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? `Update the details for this ${singular.toLowerCase()}.`
                  : `Add a new ${singular.toLowerCase()} to the system.`}
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-4 pt-2">
            {fields.map((f) => (
              <div key={f.name} className="space-y-1">
                {f.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      checked={!!values[f.name]}
                      onChange={(e) =>
                        setValues({ ...values, [f.name]: e.target.checked })
                      }
                    />
                    {f.label}
                  </label>
                ) : (
                  <>
                    <Label>
                      {f.label}{' '}
                      {f.required && <span className="text-red-500">*</span>}
                    </Label>
                    {f.type === 'select' ? (
                      <select
                        required={f.required}
                        value={String(values[f.name] ?? '')}
                        onChange={(e) =>
                          setValues({ ...values, [f.name]: e.target.value })
                        }
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">Select…</option>
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea
                        required={f.required}
                        value={String(values[f.name] ?? '')}
                        onChange={(e) =>
                          setValues({ ...values, [f.name]: e.target.value })
                        }
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        rows={3}
                      />
                    ) : (
                      <Input
                        required={f.required}
                        type={f.type ?? 'text'}
                        step={f.step}
                        value={String(values[f.name] ?? '')}
                        onChange={(e) =>
                          setValues({ ...values, [f.name]: e.target.value })
                        }
                      />
                    )}
                    {f.help && (
                      <p className="mt-1 text-xs text-slate-500">{f.help}</p>
                    )}
                  </>
                )}
              </div>
            ))}

            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : `Create ${singular}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}