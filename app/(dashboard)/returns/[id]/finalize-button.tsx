'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'

const PAYMENT_METHODS = ['cash', 'upi', 'bank', 'cheque', 'card'] as const
type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export function FinalizeReturnButton({
  returnId,
  returnType,
}: {
  returnId: string
  returnType: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cash')

  const showMethodPicker = returnType === 'refund'
  const isStoreCredit = returnType === 'store_credit'
  const isExchange = returnType === 'exchange'

  async function handleFinalize() {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('rpc_finalize_return', {
        p_return_id: returnId,
        p_refund_method: showMethodPicker ? method : 'cash',
      })
      if (error) throw error

      toast.success('Return finalized')
      setShowConfirm(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message ?? 'Finalize failed')
    } finally {
      setSaving(false)
    }
  }

  if (!showConfirm) {
    return (
      <Button
        onClick={() => setShowConfirm(true)}
        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <CheckCircle2 className="h-4 w-4" /> Finalize & Approve
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-rose-50 p-2 border border-rose-200">
      {showMethodPicker && (
        <>
          <Label className="text-xs text-rose-700 shrink-0">Refund via</Label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="h-8 rounded border border-rose-300 bg-white px-2 text-xs capitalize"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </>
      )}

      {isStoreCredit && (
        <Label className="text-xs text-rose-700 shrink-0">
          Refund → Store Credit
        </Label>
      )}

      {isExchange && (
        <Label className="text-xs text-rose-700 shrink-0">
          Refund → Gold Exchange
        </Label>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowConfirm(false)}
        disabled={saving}
      >
        Cancel
      </Button>

      <Button
        size="sm"
        onClick={handleFinalize}
        disabled={saving}
        className="bg-rose-600 hover:bg-rose-700 text-white"
      >
        {saving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          'Yes, Finalize'
        )}
      </Button>
    </div>
  )
}