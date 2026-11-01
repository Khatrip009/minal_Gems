'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Wallet } from 'lucide-react'

export function RecordPaymentDialog({
  jobId, craftsmanId, craftsmanName, maxAmount, currentPaid
}: {
  jobId: string
  craftsmanId: string
  craftsmanName: string
  maxAmount: number
  currentPaid: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [amount, setAmount] = useState(maxAmount > 0 ? maxAmount.toFixed(2) : '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const payAmount = Number(amount)

    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return toast.error('Enter a valid amount')
    }

    // Strict Frontend Validation
    if (payAmount > maxAmount) {
      return toast.error(`Cannot pay more than the remaining balance (Rs. ${maxAmount.toFixed(2)})`)
    }

    setSaving(true)
    const supabase = createClient()
    
    try {
      // Use the Double-Entry RPC
      const { error } = await supabase.rpc('rpc_pay_craftsman', {
        p_job_id: jobId,
        p_craftsman_id: craftsmanId,
        p_amount: payAmount
      })

      if (error) throw error

      toast.success(`Rs. ${payAmount.toLocaleString('en-IN')} paid to ${craftsmanName}`)
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message, { duration: 12000 })
    } finally {
      setSaving(false)
    }
  }

  if (maxAmount <= 0) {
    return <div className="text-xs font-medium text-emerald-600">✓ Fully Settled</div>
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Wallet className="h-3.5 w-3.5" /> Pay Craftsman
      </Button>
      <DialogContent>
        <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Wallet className="h-5 w-5" /></div>
          <div>
            <DialogTitle>Pay Craftsman</DialogTitle>
            <DialogDescription>Record payment for this job. Automatically posts to General Ledger.</DialogDescription>
          </div>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="rounded-md bg-slate-50 p-3 text-sm border border-slate-200">
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Total Earned:</span>
              <span className="font-semibold">Rs. {(maxAmount + currentPaid).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 mb-1">
              <span>Already Paid:</span>
              <span className="font-semibold text-rose-600">- Rs. {currentPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-900">
              <span>Remaining Balance:</span>
              <span>Rs. {maxAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Payment Amount (Rs.) <span className="text-red-500">*</span></Label>
            <Input 
              required 
              type="number" 
              min="0.01" 
              step="0.01" 
              max={maxAmount} // HTML5 limitation
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
            />
          </div>

          <DialogFooter className="!mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Recording…' : 'Confirm Payment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}