'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Settings2 } from 'lucide-react'

type Option = { id: string; label: string }

export function SetPurityButton({
  jobId,
  currentPurityId,
  purityOptions,
  variant = 'outline',
  label = 'Set purity',
}: {
  jobId: string
  currentPurityId: string | null
  purityOptions: Option[]
  variant?: 'outline' | 'default'
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState(currentPurityId ?? '')

  async function save() {
    if (!selectedId) {
      toast.error('Select a purity', { duration: 5000 })
      return
    }
    setSaving(true)
    const { error } = await createClient()
      .from('craftsman_jobs')
      .update({ planned_finished_purity_id: selectedId })
      .eq('id', jobId)
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 12000 })
      return
    }
    toast.success('Planned purity set')
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Settings2 className="h-3.5 w-3.5" /> {label}
      </Button>
      <DialogContent>
        <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle>Set planned purity</DialogTitle>
            <DialogDescription>
              The purity the finished piece will be. Required by the completion RPC to
              record the finished inventory item correctly.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label>
              Purity <span className="text-red-500">*</span>
            </Label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">— Select purity —</option>
              {purityOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter className="!mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !selectedId}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}