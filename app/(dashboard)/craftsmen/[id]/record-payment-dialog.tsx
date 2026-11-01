'use client'
import { useState } from 'react'
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
import { Wallet } from 'lucide-react'

type JobOption = { id: string; job_number: string; balance: number }

type Props = {
  craftsmanId: string
  craftsmanName: string
  jobs: JobOption[]
  presetJobId?: string
  presetAmount?: number
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm'
  label?: string
}

// Must match the CHECK constraint on craftsman_job_payments.payment_method
const PAYMENT_METHODS = ['cash', 'upi', 'bank', 'cheque', 'card', 'adjustment', 'other'] as const

const today = () => new Date().toISOString().slice(0, 10)

export function RecordPaymentDialog({
  craftsmanId,
  craftsmanName,
  jobs,
  presetJobId,
  presetAmount,
  variant = 'default',
  size = 'default',
  label = 'Record payment',
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    job_id: presetJobId ?? '',
    amount: presetAmount != null ? String(presetAmount) : '',
    payment_date: today(),
    payment_method: 'cash' as string,
    reference: '',
    notes: '',
  })

  const selectedJob = form.job_id ? jobs.find((j) => j.id === form.job_id) : undefined
  const maxAllowed = selectedJob ? selectedJob.balance : Infinity

  function reset() {
    setForm({
      job_id: presetJobId ?? '',
      amount: presetAmount != null ? String(presetAmount) : '',
      payment_date: today(),
      payment_method: 'cash',
      reference: '',
      notes: '',
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Amount must be a positive number')
      return
    }
    if (form.job_id && amount > maxAllowed) {
      toast.error(`Cannot pay more than the job balance (₹${maxAllowed.toFixed(2)})`)
      return
    }

    setSaving(true)
    const { error } = await supabase.rpc('rpc_pay_craftsman', {
      p_job_id: form.job_id || null,
      p_craftsman_id: craftsmanId,
      p_amount: amount,
      // NEW params — must exist on the DB function (see SQL below)
      p_payment_date: form.payment_date,
      p_payment_method: form.payment_method,
      p_reference: form.reference.trim() || null,
      p_notes: form.notes.trim() || null,
    })
    setSaving(false)

    if (error) {
      toast.error(error.message, { duration: 12000 })
      return
    }
    toast.success(`₹${amount.toLocaleString('en-IN')} paid to ${craftsmanName}`)
    setOpen(false)
    reset()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} className="gap-2">
        <Wallet className="h-4 w-4" /> {label}
      </Button>
      <DialogContent>
        <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Payment to {craftsmanName}. Automatically posts to General Ledger.
            </DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>
              Apply to job <span className="text-slate-400">(optional)</span>
            </Label>
            <select
              value={form.job_id}
              onChange={(e) => {
                const selectedJobId = e.target.value
                const job = jobs.find((j) => j.id === selectedJobId)
                setForm({
                  ...form,
                  job_id: selectedJobId,
                  amount: job ? job.balance.toFixed(2) : form.amount,
                })
              }}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— General advance (no specific job) —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_number} · ₹{j.balance.toFixed(2)} balance
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                Amount (₹) <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                type="number"
                min="0.01"
                step="0.01"
                max={selectedJob ? maxAllowed : undefined}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              {selectedJob && (
                <p className="text-xs text-amber-600">Max: ₹{maxAllowed.toFixed(2)}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                type="date"
                value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Method</Label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="UPI ref, cheque no."
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter className="!mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Recording…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}