'use client'
import { useState } from 'react'
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
import { IndianRupee } from 'lucide-react'

const MAKING_CHARGE_TYPES = [
  'fixed',
  'per_gram',
  'percent_of_metal',
  'percent_of_total',
] as const

const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export function SetMakingChargeButton({
  jobId,
  currentType,
  currentValue,
  defaultType,
  defaultValue,
  variant = 'outline',
  label = 'Edit making charge',
}: {
  jobId: string
  currentType: string | null
  currentValue: number | null
  defaultType: string | null
  defaultValue: number | null
  variant?: 'outline' | 'default'
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [type, setType] = useState(
    currentType ?? defaultType ?? 'fixed',
  )
  const [value, setValue] = useState(
    currentValue != null
      ? String(currentValue)
      : defaultValue != null
        ? String(defaultValue)
        : '',
  )

  async function save() {
    if (!value || Number(value) < 0) {
      toast.error('Enter a valid making charge value', { duration: 5000 })
      return
    }
    setSaving(true)
    const { error } = await createClient()
      .from('craftsman_jobs')
      .update({
        making_charge_type: type,
        making_charge_value: Number(value),
      })
      .eq('id', jobId)
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 12000 })
      return
    }
    toast.success('Making charge updated')
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <IndianRupee className="h-3.5 w-3.5" /> {label}
      </Button>
      <DialogContent>
        <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle>Making charge for this job</DialogTitle>
            <DialogDescription>
              Locked in at job creation. Editable until completion. Persists to the
              finished inventory piece.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
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
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="!mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}