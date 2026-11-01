'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Scale, Info } from 'lucide-react'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}

export function NewReturnForm({
  invoices,
  metalRates,
}: {
  invoices: any[]
  metalRates: any[]
}) {
  const router = useRouter()
  const supabase = createClient()

  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [returnType, setReturnType] = useState<
    'refund' | 'store_credit' | 'gold_exchange'
  >('refund')
  const [notes, setNotes] = useState('')

  // Gold exchange state
  const [goldWeight, setGoldWeight] = useState('')
  const [goldPurityId, setGoldPurityId] = useState('')
  const [goldRate, setGoldRate] = useState('')

  // Per-item selection state
  const [selectedItems, setSelectedItems] = useState<
    Record<
      string,
      { selected: boolean; condition: 'good' | 'melt'; refund: string }
    >
  >({})

  const [saving, setSaving] = useState(false)

  // Auto-fill rate from metal_rates when purity is picked,
  // but leave the input editable
  useEffect(() => {
    if (!goldPurityId) {
      setGoldRate('')
      return
    }
    const rate =
      metalRates.find((r: any) => r.purity_id === goldPurityId)
        ?.rate_per_gram || 0
    setGoldRate(rate > 0 ? String(rate) : '')
  }, [goldPurityId, metalRates])

  const selectedInvoice = invoices.find((inv) => inv.id === selectedInvoiceId)
  const invoiceItems = selectedInvoice?.invoice_items || []

  function toggleItem(itemId: string, defaultRefund: number) {
    setSelectedItems((prev) => {
      const exists = prev[itemId]
      return {
        ...prev,
        [itemId]: exists
          ? { ...exists, selected: !exists.selected }
          : {
              selected: true,
              condition: 'melt',
              refund: defaultRefund.toString(),
            },
      }
    })
  }

  function updateItem(
    itemId: string,
    patch: Partial<{ condition: 'good' | 'melt'; refund: string }>,
  ) {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }))
  }

  const totalRefund = Object.values(selectedItems)
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + Number(i.refund || 0), 0)

  // Gold value = weight × manual rate
  const goldValue = (() => {
    const weight = Number(goldWeight) || 0
    const rate = Number(goldRate) || 0
    if (weight <= 0 || rate <= 0) return 0
    return weight * rate
  })()

  // Whether the selected purity has a published rate in metal_rates
  const purityHasRate =
    !!goldPurityId &&
    (metalRates.find((r: any) => r.purity_id === goldPurityId)?.rate_per_gram ||
      0) > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedInvoiceId) return toast.error('Select an invoice')

    const activeItems = Object.entries(selectedItems).filter(
      ([_, data]) => data.selected,
    )
    if (activeItems.length === 0)
      return toast.error('Select at least one item to return')

    if (returnType === 'gold_exchange') {
      if (!goldWeight || Number(goldWeight) <= 0) {
        return toast.error('Enter the gold weight')
      }
      if (!goldPurityId) {
        return toast.error('Select a purity')
      }
      if (!goldRate || Number(goldRate) <= 0) {
        return toast.error(
          'Enter a rate per gram — no rate is on file for this purity',
        )
      }
    }

    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    try {
      // 1. Create Return Record (pending approval)
      const { data: returnRecord, error: returnErr } = await supabase
        .from('returns')
        .insert({
          invoice_id: selectedInvoiceId,
          customer_id: selectedInvoice.customer_id,
          return_type:
            returnType === 'gold_exchange' ? 'exchange' : returnType,
          total_refund_amount: totalRefund,
          gold_given_weight_g:
            returnType === 'gold_exchange' ? Number(goldWeight) : 0,
          gold_given_purity_id:
            returnType === 'gold_exchange' ? goldPurityId : null,
          gold_given_rate_per_gram:
            returnType === 'gold_exchange' ? Number(goldRate) : null,
          gold_given_value:
            returnType === 'gold_exchange' ? goldValue : 0,
          notes: notes || null,
          performed_by: user?.id,
          status: 'pending',
        })
        .select('id, return_number')
        .single()

      if (returnErr) throw returnErr

      // 2. Save each returned item (intent only — inventory untouched)
      for (const [invoiceItemId, data] of activeItems) {
        const invItem = invoiceItems.find((i: any) => i.id === invoiceItemId)

        await supabase.from('return_items').insert({
          return_id: returnRecord.id,
          invoice_item_id: invoiceItemId,
          inventory_item_id: invItem.inventory_item_id,
          condition: data.condition,
          refund_amount: Number(data.refund),
        })
      }

      toast.success(
        `Return ${returnRecord.return_number} initiated. Pending approval.`,
      )
      router.push(`/returns/${returnRecord.id}`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Submit enablement: for gold_exchange we need BOTH items and gold entered
  const canSubmit =
    !saving &&
    totalRefund > 0 &&
    (returnType !== 'gold_exchange' || goldValue > 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Initiate Return
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a return request. An admin will review and finalize it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3 mb-6">
            <Info className="h-5 w-5 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800">
              <strong>Approval Required:</strong> Submitting this form will not
              change inventory or process a refund immediately. It creates a
              pending request for an Admin or Manager to finalize.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <Label>Select Original Invoice</Label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => {
                setSelectedInvoiceId(e.target.value)
                setSelectedItems({})
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Search Invoice —</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {inv.customers?.name} (Rs.{' '}
                  {fmtMoney(inv.total)})
                </option>
              ))}
            </select>
          </div>

          {selectedInvoiceId && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">
                Select Items to Return
              </h2>
              <div className="space-y-3">
                {invoiceItems.map((item: any) => {
                  const state = selectedItems[item.id]
                  return (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-4 transition ${
                        state?.selected
                          ? 'border-brand-500 bg-brand-50/20'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={state?.selected || false}
                          onChange={() => toggleItem(item.id, item.subtotal)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {item.item_description}
                              </p>
                              <p className="font-mono text-xs text-slate-500">
                                {item.inventory_items?.inventory_tag}
                              </p>
                            </div>
                            <p className="font-semibold text-slate-700">
                              Rs. {fmtMoney(item.subtotal)}
                            </p>
                          </div>

                          {state?.selected && (
                            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-3">
                              <div>
                                <Label className="text-xs">
                                  Item Condition
                                </Label>
                                <select
                                  value={state.condition}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      condition: e.target.value as any,
                                    })
                                  }
                                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                                >
                                  <option value="good">
                                    Good (Restock to Inventory)
                                  </option>
                                  <option value="melt">
                                    Damaged / Scrap (Send to Melting)
                                  </option>
                                </select>
                              </div>
                              <div>
                                <Label className="text-xs">
                                  Refund Amount (Rs.)
                                </Label>
                                <Input
                                  type="number"
                                  value={state.refund}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      refund: e.target.value,
                                    })
                                  }
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sticky top-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Return Summary
            </h2>

            <div className="space-y-4">
              <div>
                <Label>Return Method</Label>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={returnType === 'refund'}
                      onChange={() => setReturnType('refund')}
                    />
                    Cash / Bank Refund
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={returnType === 'store_credit'}
                      onChange={() => setReturnType('store_credit')}
                    />
                    Store Credit (Wallet)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={returnType === 'gold_exchange'}
                      onChange={() => setReturnType('gold_exchange')}
                    />
                    Give Gold in Exchange
                  </label>
                </div>
              </div>

              {/* Gold Exchange Details */}
              {returnType === 'gold_exchange' && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-2">
                    <Scale className="h-4 w-4" /> Gold to Issue
                  </div>

                  <div>
                    <Label className="text-xs">Weight (g)</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={goldWeight}
                      onChange={(e) => setGoldWeight(e.target.value)}
                      className="mt-1 bg-white tabular-nums"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Purity</Label>
                    <select
                      value={goldPurityId}
                      onChange={(e) => setGoldPurityId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">— Select —</option>
                      {metalRates.map((r: any) => (
                        <option key={r.purity_id} value={r.purity_id}>
                          {r.code}
                          {r.rate_per_gram > 0
                            ? ` · ₹${fmtMoney(r.rate_per_gram)}/g`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs">Rate (₹/g)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={goldRate}
                      onChange={(e) => setGoldRate(e.target.value)}
                      className="mt-1 bg-white tabular-nums"
                      placeholder="Enter rate per gram"
                    />
                    {goldPurityId && !purityHasRate && (
                      <p className="mt-1 text-[10px] text-amber-700">
                        No rate on file for this purity — enter the rate
                        manually.
                      </p>
                    )}
                  </div>

                  <div className="border-t border-amber-200 pt-2 flex justify-between items-center">
                    <span className="text-xs font-semibold text-amber-900">
                      Gold Value
                    </span>
                    <span className="text-sm font-bold text-amber-900 tabular-nums">
                      Rs. {fmtMoney(goldValue)}
                    </span>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4">
                <Label>Internal Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for return..."
                  className="mt-1"
                />
              </div>

              <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                <span className="font-semibold text-slate-900">
                  Total Refund
                </span>
                <span className="text-xl font-bold text-rose-600">
                  Rs. {fmtMoney(totalRefund)}
                </span>
              </div>

              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full gap-2 bg-slate-900 hover:bg-slate-800"
              >
                {saving ? 'Initiating...' : 'Initiate Return'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}