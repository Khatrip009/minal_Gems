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
import { EmptyState } from '@/components/primitives/empty-state'
import { Wallet, X } from 'lucide-react'

type Payment = {
  id: string
  amount: number | string
  payment_date: string
  payment_method: string
  reference: string | null
  notes: string | null
  job_id: string | null
  voided_at: string | null
  void_reason: string | null
  created_at: string
}

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—'
}
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export function PaymentsTable({
  payments,
  jobNumberById,
}: {
  payments: Payment[]
  jobNumberById: Record<string, string>
}) {
  const router = useRouter()
  const [voiding, setVoiding] = useState<Payment | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

async function submitVoid(e: React.FormEvent) {
  e.preventDefault()
  if (!voiding) return
  if (!reason.trim()) {
    toast.error('Enter a reason for the void')
    return
  }
  setSaving(true)
  const { error } = await supabase.rpc('rpc_void_craftsman_payment', {
    p_payment_id: voiding.id,
    p_reason: reason.trim(),
  })
  setSaving(false)
  if (error) {
    toast.error(error.message, { duration: 12000 })
    return
  }
  toast.success('Payment voided')
  setVoiding(null)
  setReason('')
  router.refresh()
}

  if (payments.length === 0) {
    return (
      <EmptyState
        icon={<Wallet className="h-5 w-5" />}
        title="No payments recorded"
        description="Use the Record payment button to log the first one."
      />
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Date</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Job</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Method</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Reference</th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">Amount</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Notes</th>
              <th className="w-1 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const isVoided = p.voided_at != null
              const amount = Number(p.amount)
              return (
                <tr
                  key={p.id}
                  className={`border-b border-slate-100 last:border-0 ${
                    isVoided ? 'bg-slate-50/60' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td
                    className={`whitespace-nowrap px-4 py-2.5 ${
                      isVoided ? 'text-slate-400 line-through' : 'text-slate-600'
                    }`}
                  >
                    {fmtDate(p.payment_date)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {p.job_id ? (
                      <span className={isVoided ? 'text-slate-400 line-through' : 'text-slate-700'}>
                        {jobNumberById[p.job_id] ?? '—'}
                      </span>
                    ) : (
                      <span className="text-xs italic text-slate-500">advance</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 capitalize ${
                      isVoided ? 'text-slate-400 line-through' : 'text-slate-600'
                    }`}
                  >
                    {humanize(p.payment_method)}
                  </td>
                  <td
                    className={`px-4 py-2.5 font-mono text-xs ${
                      isVoided ? 'text-slate-400 line-through' : 'text-slate-600'
                    }`}
                  >
                    {p.reference ?? '—'}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tabular font-semibold ${
                      isVoided ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}
                  >
                    ₹ {fmtMoney(amount)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-xs ${
                      isVoided ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {isVoided ? (
                      <span className="italic">Voided: {p.void_reason}</span>
                    ) : (
                      p.notes ?? '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!isVoided && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700"
                        onClick={() => {
                          setVoiding(p)
                          setReason('')
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog
        open={voiding != null}
        onOpenChange={(o) => !o && setVoiding(null)}
      >
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <X className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Void payment</DialogTitle>
              <DialogDescription>
                Voiding preserves the audit trail. The row stays in the ledger but
                is excluded from totals.
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={submitVoid} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>
                Reason <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. entered wrong amount, duplicate entry"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVoiding(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-rose-600 hover:bg-rose-700">
                {saving ? 'Voiding…' : 'Void payment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}