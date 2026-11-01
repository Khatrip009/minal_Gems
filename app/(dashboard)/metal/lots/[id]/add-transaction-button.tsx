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
import { Plus } from 'lucide-react'

const MANUAL_TYPES = ['adjustment', 'purchase', 'scrap', 'loss'] as const
type ManualType = (typeof MANUAL_TYPES)[number]

export function AddTransactionButton({
  lotId,
  defaultLocationId,
}: {
  lotId: string
  defaultLocationId: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    txn_type: 'adjustment' as ManualType,
    fine_weight_change_g: '',
    notes: '',
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const weight = Number(form.fine_weight_change_g)
    if (!Number.isFinite(weight) || weight === 0) {
      toast.error('Fine weight change cannot be zero', { duration: 6000 })
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('metal_transactions').insert({
      metal_lot_id: lotId,
      txn_type: form.txn_type,
      fine_weight_change_g: weight,
      location_id: defaultLocationId,
      notes: form.notes.trim() || null,
      performed_by: user?.id ?? null,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 10000 })
      return
    }
    toast.success('Transaction recorded')
    setOpen(false)
    setForm({ txn_type: 'adjustment', fine_weight_change_g: '', notes: '' })
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" /> Add transaction
      </Button>
      <DialogContent>
        <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Manual ledger entry. Job-related issues and receipts will use the RPCs.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>Type <span className="text-red-500">*</span></Label>
            <select
              required
              value={form.txn_type}
              onChange={(e) => setForm({ ...form, txn_type: e.target.value as ManualType })}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {MANUAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Fine weight change (g) <span className="text-red-500">*</span></Label>
            <Input
              required
              type="number"
              step="0.0001"
              value={form.fine_weight_change_g}
              onChange={(e) => setForm({ ...form, fine_weight_change_g: e.target.value })}
              placeholder="e.g. 5.000 for +5g, -0.500 for −0.5g"
            />
            <p className="text-xs text-slate-500">
              Positive adds metal to the lot, negative removes it.
            </p>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Physical count reconciliation"
            />
          </div>

          <DialogFooter className="!mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}