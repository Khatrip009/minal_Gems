'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Wrench, CheckCircle2, Truck, Loader2, Wallet } from 'lucide-react'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}

export function RepairActions({
  job,
  allCraftsmen,
  alreadyPaid = 0,
}: {
  job: any
  allCraftsmen: any[]
  alreadyPaid?: number
}) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [paying, setPaying] = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)

  const [craftsmanId, setCraftsmanId] = useState(job.craftsman_id || '')
  const [returnedWeight, setReturnedWeight] = useState(
    job.returned_fine_g || job.intake_weight_g,
  )
  const [customerCharge, setCustomerCharge] = useState(
    job.making_charge_amount || 0,
  )
  const [craftsmanCost, setCraftsmanCost] = useState(
    job.craftsman_cost_amount || 0,
  )
  const [taxRate, setTaxRate] = useState(18)

  const costNum = Number(job.craftsman_cost_amount || 0)
  const remaining = Math.max(0, costNum - Number(alreadyPaid))
  const [payAmount, setPayAmount] = useState(remaining || costNum)

  async function updateStatus(newStatus: string, extraData: any = {}) {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('craftsman_jobs')
        .update({ status: newStatus, ...extraData })
        .eq('id', job.id)
      if (error) throw error
      toast.success(`Job marked as ${newStatus.replace('_', ' ')}`)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAssign() {
    if (!craftsmanId) return toast.error('Select a craftsman first')
    await updateStatus('in_progress', { craftsman_id: craftsmanId })
  }

  async function handleComplete() {
    if (!returnedWeight || Number(returnedWeight) <= 0)
      return toast.error('Enter the final weight returned')
    await updateStatus('completed', {
      returned_fine_g: Number(returnedWeight),
      making_charge_amount: Number(customerCharge),
      craftsman_cost_amount: Number(craftsmanCost),
      completed_at: new Date().toISOString(),
    })
  }

  async function handleDeliverAndBill() {
    setSaving(true)
    try {
      // Atomic: invoice + sale journal + craftsman accrual + job status
      const { data: invoiceId, error: rpcErr } = await supabase.rpc(
        'rpc_deliver_repair',
        {
          p_job_id: job.id,
          p_tax_rate: Number(taxRate) || 18,
        },
      )
      if (rpcErr) throw rpcErr
      if (!invoiceId) throw new Error('Delivery returned no invoice id')

      toast.success('Job delivered and invoice created')
      router.push(`/invoices/${invoiceId}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handlePayCraftsman() {
    if (!payAmount || Number(payAmount) <= 0)
      return toast.error('Enter a valid amount')
    setPaying(true)
    try {
      const { error } = await supabase.rpc('rpc_pay_craftsman', {
        p_job_id: job.id,
        p_craftsman_id: job.craftsman_id,
        p_amount: Number(payAmount),
        p_method: 'cash',
      })
      if (error) throw error
      toast.success('Craftsman payment recorded')
      setShowPayForm(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="space-y-4 sticky top-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Job Actions</h2>

        {job.status === 'pending' && (
          <div className="space-y-4">
            <div>
              <Label>Assign Craftsman</Label>
              <select
                value={craftsmanId}
                onChange={(e) => setCraftsmanId(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— Select —</option>
                {allCraftsmen.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleAssign}
              disabled={saving || !craftsmanId}
              className="w-full gap-2"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wrench className="h-4 w-4" />
              )}
              Start Repair
            </Button>
          </div>
        )}

        {job.status === 'in_progress' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Returned Weight (g)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={returnedWeight}
                  onChange={(e) => setReturnedWeight(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Customer Charge</Label>
                <Input
                  type="number"
                  value={customerCharge}
                  onChange={(e) => setCustomerCharge(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Craftsman Cost</Label>
              <Input
                type="number"
                value={craftsmanCost}
                onChange={(e) => setCraftsmanCost(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleComplete}
              disabled={saving}
              className="w-full gap-2 bg-sky-600 hover:bg-sky-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Mark Repaired
            </Button>
          </div>
        )}

        {job.status === 'completed' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">GST % on Repair</Label>
              <select
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value={0}>0% (exempt)</option>
                <option value={5}>5%</option>
                <option value={18}>18% (standard service)</option>
              </select>
            </div>
            <div className="rounded-md bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Charge</span>
                <span className="tabular-nums">
                  Rs. {fmtMoney(customerCharge)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GST ({taxRate}%)</span>
                <span className="tabular-nums">
                  Rs. {fmtMoney(Number(customerCharge) * taxRate / 100)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
                <span>Invoice Total</span>
                <span className="tabular-nums text-emerald-700">
                  Rs.{' '}
                  {fmtMoney(
                    Number(customerCharge) * (1 + taxRate / 100),
                  )}
                </span>
              </div>
            </div>
            <Button
              onClick={handleDeliverAndBill}
              disabled={saving}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Truck className="h-4 w-4" />
              )}
              Deliver & Create Invoice
            </Button>
          </div>
        )}

        {job.status === 'delivered' && (
          <div className="rounded-md bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-800">
            This job has been delivered.
          </div>
        )}
      </div>

      {/* Pay craftsman — only if assigned and remaining > 0 */}
      {job.craftsman_id && costNum > 0 && remaining > 0.01 && !showPayForm && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900 mb-2">
            Craftsman Payment
          </h2>
          <p className="text-xs text-amber-700 mb-3">
            Owed to {job.craftsmen?.name}: Rs. {fmtMoney(remaining)}
            {alreadyPaid > 0 && (
              <>
                {' '}(paid so far: Rs. {fmtMoney(alreadyPaid)})
              </>
            )}
          </p>
          <Button
            onClick={() => {
              setPayAmount(remaining)
              setShowPayForm(true)
            }}
            variant="outline"
            className="w-full gap-2 border-amber-300 hover:bg-amber-100"
          >
            <Wallet className="h-4 w-4" /> Record Payment
          </Button>
        </div>
      )}

      {showPayForm && (
        <div className="rounded-xl border border-amber-300 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            Pay Craftsman
          </h2>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">
                Amount (Rs.) — remaining {fmtMoney(remaining)}
              </Label>
              <Input
                type="number"
                max={remaining}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPayForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePayCraftsman}
                disabled={paying}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {paying ? 'Saving...' : 'Confirm Pay'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}