'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, Truck, Package, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  confirmOnlinePayment,
  markOrderShipped,
  markOrderDelivered,
  cancelOnlineOrder,
} from '@/lib/dashboard/online-orders'

type Modal =
  | { kind: 'none' }
  | { kind: 'confirm_payment' }
  | { kind: 'ship' }
  | { kind: 'deliver' }
  | { kind: 'cancel' }

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
] as const

export function OrderActions({
  orderId,
  orderNumber,
  status,
}: {
  orderId: string
  orderNumber: string
  status: string
}) {
  const [pending] = useTransition()
  const [modal, setModal] = useState<Modal>({ kind: 'none' })

  function close() {
    setModal({ kind: 'none' })
  }

  const canConfirm = status === 'pending_payment' || status === 'pending'
  const canShip = status === 'paid'
  const canDeliver = status === 'shipped'
  const canCancel = !['cancelled', 'refunded', 'delivered'].includes(status)

  return (
    <>
      <div className="mt-5 pt-5 border-t border-slate-200 flex flex-wrap gap-2">
        {canConfirm && (
          <button
            onClick={() => setModal({ kind: 'confirm_payment' })}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" /> Confirm payment
          </button>
        )}
        {canShip && (
          <button
            onClick={() => setModal({ kind: 'ship' })}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <Truck className="h-4 w-4" /> Mark shipped
          </button>
        )}
        {canDeliver && (
          <button
            onClick={() => setModal({ kind: 'deliver' })}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <Package className="h-4 w-4" /> Mark delivered
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => setModal({ kind: 'cancel' })}
            disabled={pending}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-rose-300 hover:border-rose-400 text-rose-700 hover:bg-rose-50 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" /> Cancel order
          </button>
        )}
      </div>

      {modal.kind === 'confirm_payment' && (
        <ConfirmPaymentModal
          orderId={orderId}
          orderNumber={orderNumber}
          onClose={close}
        />
      )}
      {modal.kind === 'ship' && (
        <ShipModal orderId={orderId} onClose={close} />
      )}
      {modal.kind === 'deliver' && (
        <DeliverModal orderId={orderId} onClose={close} />
      )}
      {modal.kind === 'cancel' && (
        <CancelModal orderId={orderId} onClose={close} />
      )}
    </>
  )
}

// ── Confirm payment modal ─────────────────────────────────────────
function ConfirmPaymentModal({
  orderId,
  orderNumber,
  onClose,
}: {
  orderId: string
  orderNumber: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState({
    payment_method:
      'bank_transfer' as (typeof PAYMENT_METHODS)[number]['value'],
    reference: '',
    notes: '',
  })

  function submit() {
    startTransition(async () => {
      const res = await confirmOnlinePayment({
        order_id: orderId,
        payment_method: form.payment_method,
        reference: form.reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }

      // ★ Receipt URL must use invoice_id, not orderId
      const invoiceId = res.invoice_id
      if (invoiceId) {
        toast.success(`Payment confirmed for ${orderNumber}`, {
          action: {
            label: 'Print receipt',
            onClick: () => {
              window.open(
                `/invoice-print/${invoiceId}/receipt`,
                '_blank',
                'noopener,noreferrer',
              )
            },
          },
          duration: 8000,
        })
      } else {
        // Order was confirmed but no invoice linked (edge case) — plain toast
        toast.success(`Payment confirmed for ${orderNumber}`)
      }

      onClose()
      router.refresh()
    })
  }

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-base font-semibold text-slate-900">
        Confirm payment
      </h3>
      <p className="text-xs text-slate-500 mt-1">
        Records the payment on the invoice, marks the order paid, and
        releases the reserved inventory as sold.
      </p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600">
            Payment method *
          </span>
          <select
            value={form.payment_method}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                payment_method: e.target
                  .value as typeof f.payment_method,
              }))
            }
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">
            Reference / txn ID
          </span>
          <input
            type="text"
            value={form.reference}
            onChange={(e) =>
              setForm((f) => ({ ...f, reference: e.target.value }))
            }
            placeholder="UTR, cheque no., UPI ref…"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600">Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
            rows={2}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>
      <ModalButtons
        onCancel={onClose}
        onSubmit={submit}
        pending={pending}
        submitLabel="Confirm payment"
        submitClass="bg-emerald-600 hover:bg-emerald-700 text-white"
      />
    </Overlay>
  )
}

// ── Ship modal ────────────────────────────────────────────────────
function ShipModal({
  orderId,
  onClose,
}: {
  orderId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tracking, setTracking] = useState('')

  function submit() {
    startTransition(async () => {
      const res = await markOrderShipped({
        order_id: orderId,
        tracking_info: tracking.trim() || undefined,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Order marked as shipped')
      onClose()
      router.refresh()
    })
  }

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-base font-semibold text-slate-900">
        Mark order shipped
      </h3>
      <p className="text-xs text-slate-500 mt-1">
        Customer will see the updated status on their order page.
      </p>
      <label className="block mt-4">
        <span className="text-xs font-medium text-slate-600">
          Tracking info (optional)
        </span>
        <input
          type="text"
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="e.g. Blue Dart AWB 12345"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <ModalButtons
        onCancel={onClose}
        onSubmit={submit}
        pending={pending}
        submitLabel="Mark shipped"
        submitClass="bg-indigo-600 hover:bg-indigo-700 text-white"
      />
    </Overlay>
  )
}

// ── Deliver modal ─────────────────────────────────────────────────
function DeliverModal({
  orderId,
  onClose,
}: {
  orderId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      const res = await markOrderDelivered({ order_id: orderId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Order marked as delivered')
      onClose()
      router.refresh()
    })
  }

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-base font-semibold text-slate-900">
        Mark order delivered?
      </h3>
      <p className="text-xs text-slate-500 mt-1">
        Only do this once the customer has actually received the order.
      </p>
      <ModalButtons
        onCancel={onClose}
        onSubmit={submit}
        pending={pending}
        submitLabel="Mark delivered"
        submitClass="bg-stone-900 hover:bg-stone-800 text-white"
      />
    </Overlay>
  )
}

// ── Cancel modal ──────────────────────────────────────────────────
function CancelModal({
  orderId,
  onClose,
}: {
  orderId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [releaseInventory, setReleaseInventory] = useState(true)

  function submit() {
    if (!reason.trim()) {
      toast.error('Cancellation reason is required')
      return
    }
    startTransition(async () => {
      const res = await cancelOnlineOrder({
        order_id: orderId,
        reason,
        release_inventory: releaseInventory,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Order cancelled')
      onClose()
      router.refresh()
    })
  }

  return (
    <Overlay onClose={onClose}>
      <h3 className="text-base font-semibold text-slate-900">
        Cancel order
      </h3>
      <p className="text-xs text-slate-500 mt-1">
        Reserved inventory returns to available, pending craftsman jobs are
        cancelled, and the unpaid invoice (if any) is voided.
      </p>
      <label className="block mt-4">
        <span className="text-xs font-medium text-slate-600">
          Cancellation reason *
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="e.g. Customer requested cancellation"
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 mt-3 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={releaseInventory}
          onChange={(e) => setReleaseInventory(e.target.checked)}
        />
        Release reserved inventory back to available
      </label>
      <ModalButtons
        onCancel={onClose}
        onSubmit={submit}
        pending={pending}
        submitLabel="Cancel order"
        submitClass="bg-rose-600 hover:bg-rose-700 text-white"
      />
    </Overlay>
  )
}

// ── Shared shell ──────────────────────────────────────────────────
function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function ModalButtons({
  onCancel,
  onSubmit,
  pending,
  submitLabel,
  submitClass,
}: {
  onCancel: () => void
  onSubmit: () => void
  pending: boolean
  submitLabel: string
  submitClass: string
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="inline-flex items-center rounded-full border border-slate-300 hover:border-slate-400 px-4 py-2 text-sm font-medium text-slate-700"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${submitClass}`}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? 'Working…' : submitLabel}
      </button>
    </div>
  )
}