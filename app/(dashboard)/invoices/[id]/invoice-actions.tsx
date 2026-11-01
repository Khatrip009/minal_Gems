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
import { Wallet, X } from 'lucide-react'

// Keep in sync with new-invoice-form.tsx and any CHECK constraint on
// invoice_payments.payment_method. 'gold_exchange' is handled by the
// new-invoice flow; it is not selectable from this dialog.
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank', 'cheque'] as const
type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function InvoiceActions({
  invoiceId,
  invoiceNumber,
  total,
  amountPaid,
  balance,
  status,
}: {
  invoiceId: string
  invoiceNumber: string
  total: number
  amountPaid: number
  balance: number
  status: string
}) {
  const router = useRouter()
  const [payOpen, setPayOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payForm, setPayForm] = useState({
    amount: balance > 0 ? balance.toFixed(2) : '',
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'cash' as PaymentMethod,
    reference: '',
    notes: '',
  })
  const [voidReason, setVoidReason] = useState('')

  const isVoid = status === 'voided'
  const isPaid = balance < 0.01

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault()
    const amt = Number(payForm.amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Amount must be positive')
      return
    }
    if (amt > balance + 0.01) {
      toast.error(`Amount cannot exceed balance ₹${balance.toFixed(2)}`)
      return
    }

    setSaving(true)
    const supabase = createClient()

    // rpc_record_payment is expected to (atomically):
    //   1. INSERT invoice_payments
    //   2. UPDATE invoices.amount_paid / balance / payment_status
    //   3. POST the journal entry (Dr Cash/Bank, Cr AR)
    // If your RPC does not post the journal, extend it — do not do this
    // client-side.
    const { error: payErr } = await supabase.rpc('rpc_record_payment', {
      p_invoice_id: invoiceId,
      p_amount: amt,
      p_method: payForm.payment_method,
      // Optional params — drop these two lines if your function signature
      // does not include them yet:
      p_payment_date: payForm.payment_date,
      p_reference: payForm.reference.trim() || null,
    })

    setSaving(false)

    if (payErr) {
      toast.error(payErr.message, { duration: 12000 })
      return
    }

    toast.success(`₹${amt.toFixed(2)} recorded`)
    setPayOpen(false)
    router.refresh()
  }

  async function submitVoid(e: React.FormEvent) {
    e.preventDefault()
    if (!voidReason.trim()) {
      toast.error('Reason is required')
      return
    }
    if (amountPaid > 0.01) {
      const ok = window.confirm(
        'This invoice has payments recorded. Voiding will reverse them. Continue?',
      )
      if (!ok) return
    }

    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // fn_void_invoice is expected to (atomically):
    //   1. UPDATE invoices.status = 'voided' + void_* metadata
    //   2. Void invoice_payments rows for this invoice
    //   3. POST the reversal journal (Dr Sales, Dr GST, Cr AR)
    //   4. Return inventory items to available
    // If it does not do all four, fix the function — do not replicate
    // any of it on the client.
    const { error } = await supabase.rpc('fn_void_invoice', {
      p_invoice_id: invoiceId,
      p_reason: voidReason.trim(),
      p_voided_by: user?.id ?? null,
    })

    setSaving(false)

    if (error) {
      toast.error(error.message, { duration: 12000 })
      return
    }
    toast.success('Invoice voided')
    setVoidOpen(false)
    router.refresh()
  }

  if (isVoid) return null

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!isPaid && (
          <Button
            onClick={() => {
              setPayForm({
                amount: balance.toFixed(2),
                payment_date: new Date().toISOString().slice(0, 10),
                payment_method: 'cash',
                reference: '',
                notes: '',
              })
              setPayOpen(true)
            }}
            className="gap-2"
          >
            <Wallet className="h-4 w-4" /> Record payment
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => setVoidOpen(true)}
          className="gap-2 text-rose-600 hover:text-rose-700"
        >
          <X className="h-4 w-4" /> Void invoice
        </Button>
      </div>

      {/* Record payment */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Record payment</DialogTitle>
              <DialogDescription>
                {invoiceNumber} · Balance ₹{balance.toFixed(2)}
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={recordPayment} className="space-y-3 pt-2">
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
                  max={balance}
                  value={payForm.amount}
                  onChange={(e) =>
                    setPayForm({ ...payForm, amount: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="date"
                  value={payForm.payment_date}
                  onChange={(e) =>
                    setPayForm({ ...payForm, payment_date: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Method</Label>
                <select
                  value={payForm.payment_method}
                  onChange={(e) =>
                    setPayForm({
                      ...payForm,
                      payment_method: e.target.value as PaymentMethod,
                    })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm capitalize"
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
                  value={payForm.reference}
                  onChange={(e) =>
                    setPayForm({ ...payForm, reference: e.target.value })
                  }
                  placeholder="UPI ref, cheque no."
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={payForm.notes}
                onChange={(e) =>
                  setPayForm({ ...payForm, notes: e.target.value })
                }
              />
            </div>
            <DialogFooter className="!mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Recording…' : 'Record payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Void invoice */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <X className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Void invoice</DialogTitle>
              <DialogDescription>
                The invoice stays in records but is marked void. The original
                journal entry is reversed and any finished pieces go back to
                available stock.
                {amountPaid > 0.01 && (
                  <span className="mt-1 block font-medium text-rose-700">
                    This invoice has ₹{amountPaid.toFixed(2)} of recorded
                    payments. They will be reversed.
                  </span>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={submitVoid} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>
                Reason <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. customer cancelled, wrong entry"
              />
            </div>
            <DialogFooter className="!mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVoidOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-rose-600 hover:bg-rose-700"
              >
                {saving ? 'Voiding…' : 'Void invoice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}