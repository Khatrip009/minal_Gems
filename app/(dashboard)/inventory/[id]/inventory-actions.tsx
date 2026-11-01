'use client'
import { useState } from 'react'
import Link from 'next/link'
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
import { Tag, Truck, Undo2, FileText } from 'lucide-react'

type Action = 'reserve' | 'deliver' | 'unreserve' | null

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}

export function InventoryActions({
  itemId,
  inventoryTag,
  status,
  floorPrice,
  totalCost,
  isTerminal,
}: {
  itemId: string
  inventoryTag: string
  status: string
  floorPrice: number | null
  totalCost: number
  isTerminal: boolean
}) {
  const router = useRouter()
  const [action, setAction] = useState<Action>(null)
  const [saving, setSaving] = useState(false)

  const [reserveForm, setReserveForm] = useState({
    reserved_for: '',
    notes: '',
  })

  async function writeTransaction(
    txn_type: string,
    statusFrom: string,
    statusTo: string,
    notes: string | null,
    reference_type: string | null = null,
    reference_id: string | null = null,
  ) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase.from('inventory_transactions').insert({
      inventory_item_id: itemId,
      txn_type,
      status_from: statusFrom,
      status_to: statusTo,
      reference_type,
      reference_id,
      notes,
      performed_by: user?.id ?? null,
    })
    return error
  }

  async function doReserve(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()

    // NOTE: inventory_transactions.txn_type enum has no 'reserve' or 'unreserve'.
    // 'adjustment' is the closest valid enum value; status_from/status_to carry
    // the semantic difference. If distinct types are needed, add them to the
    // CHECK constraint on inventory_transactions.txn_type via a migration.
    const txnErr = await writeTransaction(
      'adjustment',
      'available',
      'reserved',
      [
        reserveForm.reserved_for && `Reserved for ${reserveForm.reserved_for}`,
        reserveForm.notes,
      ]
        .filter(Boolean)
        .join(' · ') || null,
    )

    const { error: itemErr } = await supabase
      .from('inventory_items')
      .update({ status: 'reserved' })
      .eq('id', itemId)

    setSaving(false)
    if (itemErr) {
      toast.error(itemErr.message, { duration: 12000 })
      return
    }
    if (txnErr) {
      toast.warning(`Status updated, but log entry failed: ${txnErr.message}`, {
        duration: 12000,
      })
    } else {
      toast.success('Piece reserved')
    }
    setAction(null)
    router.refresh()
  }

  async function doUnreserve(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()

    const txnErr = await writeTransaction(
      'adjustment',
      'reserved',
      'available',
      'Reservation released',
    )

    const { error: itemErr } = await supabase
      .from('inventory_items')
      .update({ status: 'available' })
      .eq('id', itemId)

    setSaving(false)
    if (itemErr) {
      toast.error(itemErr.message, { duration: 12000 })
      return
    }
    if (txnErr) {
      toast.warning(`Status updated, but log entry failed: ${txnErr.message}`, {
        duration: 12000,
      })
    } else {
      toast.success('Reservation released')
    }
    setAction(null)
    router.refresh()
  }

  async function doDeliver(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    // NOTE: inventory_items.status enum has no 'delivered' value.
    // 'sold' is the terminal status. This action logs the physical handover
    // as a 'sale' event without changing status. If you need a distinct
    // 'delivered' state, add it to the CHECK constraint via migration and
    // restore the status update below.
    const txnErr = await writeTransaction(
      'sale',
      'sold',
      'sold',
      'Handed over to customer',
    )

    setSaving(false)
    if (txnErr) {
      toast.error(txnErr.message, { duration: 12000 })
      return
    }
    toast.success('Handover recorded')
    setAction(null)
    router.refresh()
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Actions</p>
          {!isTerminal && status !== 'sold' && (
            <p className="text-xs text-slate-500">
              Cost ₹{fmtMoney(totalCost)}
              {floorPrice != null && (
                <>
                  {' '}
                  · Floor ₹{fmtMoney(floorPrice)}
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {status === 'available' && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setReserveForm({ reserved_for: '', notes: '' })
                  setAction('reserve')
                }}
                className="gap-2"
              >
                <Tag className="h-4 w-4" /> Reserve
              </Button>
              <Link href={`/invoices/new?inventory=${itemId}`}>
                <Button className="gap-2">
                  <FileText className="h-4 w-4" /> Create invoice
                </Button>
              </Link>
            </>
          )}

          {status === 'reserved' && (
            <>
              <Link href={`/invoices/new?inventory=${itemId}`}>
                <Button className="gap-2">
                  <FileText className="h-4 w-4" /> Create invoice
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setAction('unreserve')}
                className="gap-2"
              >
                <Undo2 className="h-4 w-4" /> Release reservation
              </Button>
            </>
          )}

          {status === 'sold' && (
            <Button onClick={() => setAction('deliver')} className="gap-2">
              <Truck className="h-4 w-4" /> Record handover
            </Button>
          )}

          {isTerminal && status !== 'sold' && (
            <p className="text-sm text-slate-500">
              This piece is {status.replace(/_/g, ' ')} — no further actions.
            </p>
          )}
        </div>

        {status === 'available' && (
          <p className="mt-3 text-xs text-slate-500">
            Selling goes through an invoice — reserve first if the customer needs
            time, or create the invoice directly to flip this piece to{' '}
            <strong>sold</strong> and record handover once delivered.
          </p>
        )}
      </div>

      {/* Reserve dialog */}
      <Dialog
        open={action === 'reserve'}
        onOpenChange={(o) => !o && setAction(null)}
      >
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Reserve piece</DialogTitle>
              <DialogDescription>
                Mark {inventoryTag} as reserved. Removes it from available stock
                until the invoice is created or the reservation is released.
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={doReserve} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Reserved for</Label>
              <Input
                value={reserveForm.reserved_for}
                onChange={(e) =>
                  setReserveForm({
                    ...reserveForm,
                    reserved_for: e.target.value,
                  })
                }
                placeholder="Customer name (optional)"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={reserveForm.notes}
                onChange={(e) =>
                  setReserveForm({ ...reserveForm, notes: e.target.value })
                }
                placeholder="Optional"
              />
            </div>
            <DialogFooter className="!mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAction(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Reserving…' : 'Reserve'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Unreserve dialog */}
      <Dialog
        open={action === 'unreserve'}
        onOpenChange={(o) => !o && setAction(null)}
      >
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Undo2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Release reservation</DialogTitle>
              <DialogDescription>
                Return {inventoryTag} to available stock. Customer will be
                notified if applicable.
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={doUnreserve} className="space-y-4 pt-2">
            <DialogFooter className="!mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAction(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Releasing…' : 'Release reservation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delivery / handover dialog */}
      <Dialog
        open={action === 'deliver'}
        onOpenChange={(o) => !o && setAction(null)}
      >
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Record handover</DialogTitle>
              <DialogDescription>
                Confirm handover of {inventoryTag} to the customer. Records the
                event in the movement history. The status stays{' '}
                <strong>sold</strong> — the invoice already closed the sale.
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={doDeliver} className="space-y-4 pt-2">
            <DialogFooter className="!mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAction(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Recording…' : 'Record handover'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}