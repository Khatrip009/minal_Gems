'use client'
import { useMemo, useState } from 'react'
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
import {
  computeMakingCharge,
  type MakingChargeType,
} from '@/lib/making-charge'
import { Coins, Gem, CheckCircle2, AlertTriangle, Search } from 'lucide-react'

type LotOption = {
  id: string
  label: string
  purity_percent: number | string | null
}

type AvailableStone = {
  id: string
  label: string
  carat: number
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
  cost_price: number | string | null
}

type StoneOnJob = {
  stone_item_id: string
  issued_at: string
  inventory_tag: string
  carat: number
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
  cost_price: number | string | null
}

type Action =
  | 'issue_metal'
  | 'return_metal'
  | 'issue_stone'
  | 'return_stone'
  | 'complete'
  | null

const RETURN_KINDS = ['unused', 'scrap', 'wastage', 'damaged', 'rejected']
const STONE_CONDITIONS = ['loose', 'mounted', 'broken', 'damaged', 'lost']

const fmtG = (v: number) => v.toFixed(3)
const fmtMoney = (v: number) =>
  v.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function JobActions({
  jobId,
  status,
  jobNumber,
  issuedFine,
  returnedFine,
  expectedFinished,
  plannedPurityId,
  hasVariant,
  lotOptions,
  availableStoneOptions,
  stonesOnJob,
  makingChargeType,
  makingChargeValue,
  metalRatePerG,
  currentStoneValue,
  existingMakingCharge,
}: {
  jobId: string
  status: string
  jobNumber: string
  issuedFine: number
  returnedFine: number
  expectedFinished: number | null
  plannedPurityId: string | null
  hasVariant: boolean
  lotOptions: LotOption[]
  availableStoneOptions: AvailableStone[]
  stonesOnJob: StoneOnJob[]
  makingChargeType: MakingChargeType
  makingChargeValue: number
  metalRatePerG: number
  currentStoneValue: number
  existingMakingCharge: number | null
}) {
  const router = useRouter()
  const [action, setAction] = useState<Action>(null)
  const [saving, setSaving] = useState(false)

  // Metal form
  const [metalForm, setMetalForm] = useState({
    lot_id: lotOptions[0]?.id ?? '',
    gross_weight_g: '',
    purity_percent: String(lotOptions[0]?.purity_percent ?? ''),
    return_kind: 'unused',
    notes: '',
  })

  // ── Stone issue: multi-select ──
  const [issueSearch, setIssueSearch] = useState('')
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([])
  const [issueNotes, setIssueNotes] = useState('')

  // ── Stone return: multi-select ──
  const [returnSearch, setReturnSearch] = useState('')
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([])
  const [returnCondition, setReturnCondition] = useState('loose')
  const [returnNotes, setReturnNotes] = useState('')

  // Complete form
  const availableMetal = Math.max(0, issuedFine - returnedFine)
  const targetNet =
    expectedFinished != null && expectedFinished > 0
      ? Math.min(expectedFinished, availableMetal)
      : availableMetal

  // Helper: gross = net + (mounted carats × 0.2 g/ct)
  // Takes explicit stone ids to avoid stale closure on mountedCaratTotal
  function computeGrossFromStones(netStr: string, stoneIds: string[]): string {
    const net = Number(netStr)
    if (!Number.isFinite(net) || net < 0) return ''
    const stonesG =
      stonesOnJob
        .filter((s) => stoneIds.includes(s.stone_item_id))
        .reduce((sum, s) => sum + s.carat, 0) * 0.2
    return (net + stonesG).toFixed(3)
  }

  const initialNetStr = fmtG(targetNet)
  const initialStoneIds = stonesOnJob.map((s) => s.stone_item_id)

  const [completeForm, setCompleteForm] = useState({
    inventory_tag: `INV-${jobNumber}`,
    net_metal_weight_g: initialNetStr,
    gross_weight_g: computeGrossFromStones(initialNetStr, initialStoneIds),
    mounted_stones: initialStoneIds,
    notes: '',
  })
  const [grossTouched, setGrossTouched] = useState(false)
  const [makingChargeOverride, setMakingChargeOverride] = useState('')
  const [makingChargeTouched, setMakingChargeTouched] = useState(false)

  // Sum of all mounted stone carats (for display only)
  const mountedCaratTotal = useMemo(() => {
    return stonesOnJob
      .filter((s) => completeForm.mounted_stones.includes(s.stone_item_id))
      .reduce((sum, s) => sum + s.carat, 0)
  }, [stonesOnJob, completeForm.mounted_stones])

  // Sum of cost_price for selected (mounted) stones
  const selectedMountedStoneValue = useMemo(() => {
    return stonesOnJob
      .filter((s) => completeForm.mounted_stones.includes(s.stone_item_id))
      .reduce((sum, s) => sum + Number(s.cost_price ?? 0), 0)
  }, [stonesOnJob, completeForm.mounted_stones])

  // Making charge based on current net-metal entry
  const computedMakingCharge = useMemo(() => {
    const net = Number(completeForm.net_metal_weight_g)
    if (!Number.isFinite(net) || net < 0) {
      return { amount: 0, basis: '', formula: '' }
    }
    return computeMakingCharge(
      { type: makingChargeType, value: makingChargeValue },
      {
        netMetalFineG: net,
        metalRatePerG,
        stoneValue: selectedMountedStoneValue,
      },
    )
  }, [
    completeForm.net_metal_weight_g,
    makingChargeType,
    makingChargeValue,
    metalRatePerG,
    selectedMountedStoneValue,
  ])

  // Effective making charge — override takes precedence when touched
  const effectiveMakingCharge = makingChargeTouched
    ? Math.max(0, Number(makingChargeOverride) || 0)
    : computedMakingCharge.amount

  // Deviation from target for the soft warning
  const deviationPct = useMemo(() => {
    if (expectedFinished == null || targetNet <= 0) return null
    const entered = Number(completeForm.net_metal_weight_g)
    if (!Number.isFinite(entered)) return null
    return ((entered - targetNet) / targetNet) * 100
  }, [completeForm.net_metal_weight_g, expectedFinished, targetNet])

  const showDeviationWarning =
    deviationPct != null && Math.abs(deviationPct) >= 2

  // Filtered lists
  const filteredAvailableStones = useMemo(() => {
    const q = issueSearch.trim().toLowerCase()
    if (!q) return availableStoneOptions
    return availableStoneOptions.filter((s) => s.label.toLowerCase().includes(q))
  }, [availableStoneOptions, issueSearch])

  const filteredStonesOnJob = useMemo(() => {
    const q = returnSearch.trim().toLowerCase()
    if (!q) return stonesOnJob
    return stonesOnJob.filter(
      (s) =>
        s.inventory_tag.toLowerCase().includes(q) ||
        [s.shape, s.color, s.clarity]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
  }, [stonesOnJob, returnSearch])

  const issueSelectedCarat = useMemo(
    () =>
      availableStoneOptions
        .filter((s) => selectedIssueIds.includes(s.id))
        .reduce((sum, s) => sum + s.carat, 0),
    [availableStoneOptions, selectedIssueIds],
  )

  const returnSelectedCarat = useMemo(
    () =>
      stonesOnJob
        .filter((s) => selectedReturnIds.includes(s.stone_item_id))
        .reduce((sum, s) => sum + s.carat, 0),
    [stonesOnJob, selectedReturnIds],
  )

  function resetMetalForm() {
    const first = lotOptions[0]
    setMetalForm({
      lot_id: first?.id ?? '',
      gross_weight_g: '',
      purity_percent: String(first?.purity_percent ?? ''),
      return_kind: 'unused',
      notes: '',
    })
  }

  function resetIssueStone() {
    setIssueSearch('')
    setSelectedIssueIds([])
    setIssueNotes('')
  }

  function resetReturnStone() {
    setReturnSearch('')
    setSelectedReturnIds(stonesOnJob.map((s) => s.stone_item_id))
    setReturnCondition('loose')
    setReturnNotes('')
  }

  function resetCompleteForm() {
    const netStr = fmtG(targetNet)
    const allIds = stonesOnJob.map((s) => s.stone_item_id)
    setCompleteForm({
      inventory_tag: `INV-${jobNumber}`,
      net_metal_weight_g: netStr,
      gross_weight_g: computeGrossFromStones(netStr, allIds),
      mounted_stones: allIds,
      notes: '',
    })
    setGrossTouched(false)
    setMakingChargeOverride('')
    setMakingChargeTouched(false)
  }

  async function runRpc(
    name: string,
    args: Record<string, unknown>,
    successMsg: string,
  ) {
    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.rpc(name, {
      ...args,
      p_performed_by: user?.id ?? null,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message, { duration: 12000 })
      return false
    }
    toast.success(successMsg)
    router.refresh()
    return true
  }

  async function submitIssueMetal(e: React.FormEvent) {
    e.preventDefault()
    if (!metalForm.lot_id) {
      toast.error('Select a metal lot', { duration: 5000 })
      return
    }
    const ok = await runRpc(
      'fn_issue_metal_to_job',
      {
        p_job_id: jobId,
        p_metal_lot_id: metalForm.lot_id,
        p_gross_weight_g: Number(metalForm.gross_weight_g),
        p_purity_percent: Number(metalForm.purity_percent),
        p_notes: metalForm.notes.trim() || null,
      },
      'Metal issued to job',
    )
    if (ok) {
      setAction(null)
      resetMetalForm()
    }
  }

  async function submitReturnMetal(e: React.FormEvent) {
    e.preventDefault()
    if (!metalForm.lot_id) {
      toast.error('Select a metal lot', { duration: 5000 })
      return
    }
    const ok = await runRpc(
      'fn_return_metal_from_job',
      {
        p_job_id: jobId,
        p_metal_lot_id: metalForm.lot_id,
        p_gross_weight_g: Number(metalForm.gross_weight_g),
        p_purity_percent: Number(metalForm.purity_percent),
        p_return_kind: metalForm.return_kind,
        p_notes: metalForm.notes.trim() || null,
      },
      'Metal returned from job',
    )
    if (ok) {
      setAction(null)
      resetMetalForm()
    }
  }

  async function submitIssueStones(e: React.FormEvent) {
    e.preventDefault()
    if (selectedIssueIds.length === 0) {
      toast.error('Select at least one stone', { duration: 5000 })
      return
    }

    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const results = await Promise.all(
      selectedIssueIds.map((stoneId) =>
        supabase.rpc('fn_issue_stone_to_job', {
          p_job_id: jobId,
          p_stone_item_id: stoneId,
          p_notes: issueNotes.trim() || null,
          p_performed_by: user?.id ?? null,
        }),
      ),
    )

    setSaving(false)

    const errors = results
      .map((r, i) => ({ ...r, stoneId: selectedIssueIds[i] }))
      .filter((r) => r.error)

    if (errors.length > 0) {
      toast.error(
        `${errors.length} of ${selectedIssueIds.length} stones failed. First error: ${errors[0].error?.message}`,
        { duration: 12000 },
      )
      router.refresh()
      return
    }

    const successful = selectedIssueIds.length - errors.length
    toast.success(
      `${successful} stone${successful === 1 ? '' : 's'} issued to job`,
    )
    setAction(null)
    resetIssueStone()
    router.refresh()
  }

  async function submitReturnStones(e: React.FormEvent) {
    e.preventDefault()
    if (selectedReturnIds.length === 0) {
      toast.error('Select at least one stone to return', { duration: 5000 })
      return
    }

    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const results = await Promise.all(
      selectedReturnIds.map((stoneId) => {
        const stone = stonesOnJob.find((s) => s.stone_item_id === stoneId)
        return supabase.rpc('fn_return_stone_from_job', {
          p_job_id: jobId,
          p_stone_item_id: stoneId,
          p_condition: returnCondition,
          p_carat_returned: stone?.carat ?? null,
          p_notes: returnNotes.trim() || null,
          p_performed_by: user?.id ?? null,
        })
      }),
    )

    setSaving(false)

    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      toast.error(
        `${errors.length} of ${selectedReturnIds.length} returns failed. First error: ${errors[0].error?.message}`,
        { duration: 12000 },
      )
      router.refresh()
      return
    }

    const successful = selectedReturnIds.length - errors.length
    toast.success(
      `${successful} stone${successful === 1 ? '' : 's'} returned from job`,
    )
    setAction(null)
    resetReturnStone()
    router.refresh()
  }

  async function submitComplete(e: React.FormEvent) {
    e.preventDefault()

    if (!completeForm.inventory_tag.trim()) {
      toast.error('Inventory tag is required', { duration: 5000 })
      return
    }
    const netMetal = Number(completeForm.net_metal_weight_g)
    const gross = Number(completeForm.gross_weight_g)

    if (!Number.isFinite(netMetal) || netMetal < 0) {
      toast.error('Net metal weight must be a positive number', { duration: 5000 })
      return
    }
    if (!Number.isFinite(gross) || gross < netMetal) {
      toast.error(
        `Gross weight (${gross}) cannot be less than net metal (${netMetal})`,
        { duration: 6000 },
      )
      return
    }
    if (netMetal > availableMetal + 0.001) {
      toast.error(
        `Cannot complete: net metal ${netMetal.toFixed(3)} g exceeds available ${availableMetal.toFixed(3)} g (issued ${issuedFine.toFixed(3)} − returned ${returnedFine.toFixed(3)}).`,
        { duration: 12000 },
      )
      return
    }
    if (!plannedPurityId) {
      toast.error(
        'This job has no planned finished purity set. Close this dialog and click "Set purity" on the job header, then try again.',
        { duration: 12000 },
      )
      return
    }

    setSaving(true)
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Call RPC — capture returned inventory id
    const { data, error } = await supabase.rpc('fn_complete_job', {
      p_job_id: jobId,
      p_inventory_tag: completeForm.inventory_tag.trim(),
      p_net_metal_weight_g: netMetal,
      p_gross_weight_g: gross,
      p_stone_item_ids: completeForm.mounted_stones,
      p_notes: completeForm.notes.trim() || null,
      p_performed_by: user?.id ?? null,
    })

    if (error) {
      setSaving(false)
      toast.error(error.message, { duration: 12000 })
      return
    }

    const invId = data as unknown as string | null
    if (!invId) {
      setSaving(false)
      toast.error('Job completion did not return an inventory id', {
        duration: 12000,
      })
      return
    }

    // Persist making charge to both tables
    const persistAmount = Number(effectiveMakingCharge.toFixed(2))
    const [jobUpdate, invUpdate] = await Promise.all([
      supabase
        .from('craftsman_jobs')
        .update({ making_charge_amount: persistAmount })
        .eq('id', jobId),
      supabase
        .from('inventory_items')
        .update({ making_charge_amount: persistAmount })
        .eq('id', invId),
    ])

    setSaving(false)

    if (jobUpdate.error || invUpdate.error) {
      toast.warning(
        `Job completed, but making-charge persistence failed: ${
          jobUpdate.error?.message ?? invUpdate.error?.message
        }`,
        { duration: 12000 },
      )
      router.refresh()
      setAction(null)
      resetCompleteForm()
      return
    }

    toast.success('Job completed — finished piece created')
    setAction(null)
    resetCompleteForm()
    router.refresh()
  }

  const isCompleted =
    status === 'completed' || status === 'delivered' || status === 'cancelled'

  // For pricing display in complete dialog
  const enteredNet = Number(completeForm.net_metal_weight_g) || 0
  const enteredMetalValue = enteredNet * metalRatePerG
  const enteredTotalCost =
    enteredMetalValue + selectedMountedStoneValue + effectiveMakingCharge

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Actions
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetMetalForm()
              setAction('issue_metal')
            }}
            className="gap-2"
            disabled={isCompleted}
          >
            <Coins className="h-4 w-4" /> Issue metal
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetMetalForm()
              setAction('return_metal')
            }}
            className="gap-2"
            disabled={isCompleted}
          >
            <Coins className="h-4 w-4" /> Return metal
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetIssueStone()
              setAction('issue_stone')
            }}
            className="gap-2"
            disabled={isCompleted || availableStoneOptions.length === 0}
          >
            <Gem className="h-4 w-4" /> Issue stones
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetReturnStone()
              setAction('return_stone')
            }}
            className="gap-2"
            disabled={isCompleted || stonesOnJob.length === 0}
          >
            <Gem className="h-4 w-4" /> Return stones
          </Button>
          <Button
            onClick={() => {
              resetCompleteForm()
              setAction('complete')
            }}
            className="gap-2"
            disabled={isCompleted}
          >
            <CheckCircle2 className="h-4 w-4" /> Complete job
          </Button>
        </div>
      </div>

      {/* ─── Issue metal ─── */}
      <Dialog open={action === 'issue_metal'} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Issue metal to job</DialogTitle>
              <DialogDescription>
                Move metal from a lot to this job. Fine weight = gross × purity.
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={submitIssueMetal} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>
                Metal lot <span className="text-red-500">*</span>
              </Label>
              <select
                required
                value={metalForm.lot_id}
                onChange={(e) => {
                  const lot = lotOptions.find((l) => l.id === e.target.value)
                  setMetalForm({
                    ...metalForm,
                    lot_id: e.target.value,
                    purity_percent: String(lot?.purity_percent ?? ''),
                  })
                }}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {lotOptions.length === 0 && <option value="">No lots with balance</option>}
                {lotOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  Gross weight (g) <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  value={metalForm.gross_weight_g}
                  onChange={(e) =>
                    setMetalForm({ ...metalForm, gross_weight_g: e.target.value })
                  }
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Purity % <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={metalForm.purity_percent}
                  onChange={(e) =>
                    setMetalForm({ ...metalForm, purity_percent: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={metalForm.notes}
                onChange={(e) => setMetalForm({ ...metalForm, notes: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setAction(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Issuing…' : 'Issue metal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Return metal ─── */}
      <Dialog open={action === 'return_metal'} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Return metal from job</DialogTitle>
              <DialogDescription>
                Return unused or scrap metal back to a lot.
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={submitReturnMetal} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>
                Metal lot <span className="text-red-500">*</span>
              </Label>
              <select
                required
                value={metalForm.lot_id}
                onChange={(e) => {
                  const lot = lotOptions.find((l) => l.id === e.target.value)
                  setMetalForm({
                    ...metalForm,
                    lot_id: e.target.value,
                    purity_percent: String(lot?.purity_percent ?? ''),
                  })
                }}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {lotOptions.length === 0 && <option value="">No lots</option>}
                {lotOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>
                  Gross weight (g) <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  value={metalForm.gross_weight_g}
                  onChange={(e) =>
                    setMetalForm({ ...metalForm, gross_weight_g: e.target.value })
                  }
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-1">
                <Label>
                  Purity % <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={metalForm.purity_percent}
                  onChange={(e) =>
                    setMetalForm({ ...metalForm, purity_percent: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Kind</Label>
                <select
                  value={metalForm.return_kind}
                  onChange={(e) =>
                    setMetalForm({ ...metalForm, return_kind: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {RETURN_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={metalForm.notes}
                onChange={(e) => setMetalForm({ ...metalForm, notes: e.target.value })}
              />
            </div>
            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setAction(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Returning…' : 'Return metal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Issue stones (multi-select) ─── */}
      <Dialog open={action === 'issue_stone'} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Gem className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Issue stones to job</DialogTitle>
              <DialogDescription>
                Select one or more available stones. Each is issued separately.
              </DialogDescription>
            </div>
          </DialogHeader>
          <form onSubmit={submitIssueStones} className="space-y-4 pt-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
                placeholder="Search by tag, 4Cs…"
                className="pl-9"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                {filteredAvailableStones.length} of {availableStoneOptions.length}{' '}
                available
              </span>
              <button
                type="button"
                onClick={() => {
                  const all = filteredAvailableStones.map((s) => s.id)
                  const anyMissing = all.some((id) => !selectedIssueIds.includes(id))
                  if (anyMissing) {
                    setSelectedIssueIds(
                      Array.from(new Set([...selectedIssueIds, ...all])),
                    )
                  } else {
                    setSelectedIssueIds(
                      selectedIssueIds.filter((id) => !all.includes(id)),
                    )
                  }
                }}
                className="font-medium text-brand-700 hover:underline"
              >
                {filteredAvailableStones.every((s) => selectedIssueIds.includes(s.id)) &&
                filteredAvailableStones.length > 0
                  ? 'Deselect all'
                  : 'Select all'}
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border border-slate-200">
              {filteredAvailableStones.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-500">
                  No stones match your search.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredAvailableStones.map((s) => {
                    const checked = selectedIssueIds.includes(s.id)
                    const summary =
                      [s.shape, s.color, s.clarity, s.cut && s.cut !== 'N/A' ? s.cut : null]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    return (
                      <li
                        key={s.id}
                        className={`flex items-center gap-3 px-3 py-2 hover:bg-slate-50 ${
                          checked ? 'bg-brand-50/40' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIssueIds([...selectedIssueIds, s.id])
                            } else {
                              setSelectedIssueIds(
                                selectedIssueIds.filter((id) => id !== s.id),
                              )
                            }
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-slate-500">
                              {s.label.split(' · ')[0]}
                            </span>
                            <span className="tabular text-sm font-semibold">
                              {s.carat.toFixed(3)} ct
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-600">{summary}</div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {selectedIssueIds.length > 0 && (
              <div className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
                <strong>{selectedIssueIds.length}</strong> selected ·{' '}
                <strong>{issueSelectedCarat.toFixed(3)} ct</strong> total
              </div>
            )}

            <div className="space-y-1">
              <Label>Notes (applied to all)</Label>
              <Input
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setAction(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || selectedIssueIds.length === 0}
              >
                {saving
                  ? `Issuing ${selectedIssueIds.length}…`
                  : `Issue ${selectedIssueIds.length || ''} stone${selectedIssueIds.length === 1 ? '' : 's'}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Return stones (multi-select) ─── */}
      <Dialog open={action === 'return_stone'} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Gem className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Return stones from job</DialogTitle>
              <DialogDescription>
                Only stones currently issued to this job are shown. All selected stones
                get the same condition.
              </DialogDescription>
            </div>
          </DialogHeader>

          {stonesOnJob.length === 0 ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No stones are currently issued to this job.
            </div>
          ) : (
            <form onSubmit={submitReturnStones} className="space-y-4 pt-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={returnSearch}
                  onChange={(e) => setReturnSearch(e.target.value)}
                  placeholder="Search by tag, 4Cs…"
                  className="pl-9"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {filteredStonesOnJob.length} of {stonesOnJob.length} on job
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const all = filteredStonesOnJob.map((s) => s.stone_item_id)
                    const allSelected = all.every((id) => selectedReturnIds.includes(id))
                    if (allSelected) {
                      setSelectedReturnIds(
                        selectedReturnIds.filter((id) => !all.includes(id)),
                      )
                    } else {
                      setSelectedReturnIds(
                        Array.from(new Set([...selectedReturnIds, ...all])),
                      )
                    }
                  }}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {filteredStonesOnJob.every((s) =>
                    selectedReturnIds.includes(s.stone_item_id),
                  )
                    ? 'Deselect all'
                    : 'Select all'}
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200">
                <ul className="divide-y divide-slate-100">
                  {filteredStonesOnJob.map((s) => {
                    const checked = selectedReturnIds.includes(s.stone_item_id)
                    const summary =
                      [s.shape, s.color, s.clarity, s.cut && s.cut !== 'N/A' ? s.cut : null]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    return (
                      <li
                        key={s.stone_item_id}
                        className={`flex items-center gap-3 px-3 py-2 hover:bg-slate-50 ${
                          checked ? 'bg-brand-50/40' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReturnIds([
                                ...selectedReturnIds,
                                s.stone_item_id,
                              ])
                            } else {
                              setSelectedReturnIds(
                                selectedReturnIds.filter((id) => id !== s.stone_item_id),
                              )
                            }
                          }}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs">
                              {s.inventory_tag}
                            </span>
                            <span className="tabular text-sm font-semibold">
                              {s.carat.toFixed(3)} ct
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-600">{summary}</div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {selectedReturnIds.length > 0 && (
                <div className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
                  <strong>{selectedReturnIds.length}</strong> selected ·{' '}
                  <strong>{returnSelectedCarat.toFixed(3)} ct</strong> total
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Condition (all)</Label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value)}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  >
                    {STONE_CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Notes (applied to all)</Label>
                  <Input
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <DialogFooter className="!mt-6">
                <Button type="button" variant="outline" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || selectedReturnIds.length === 0}
                >
                  {saving
                    ? `Returning ${selectedReturnIds.length}…`
                    : `Return ${selectedReturnIds.length || ''} stone${selectedReturnIds.length === 1 ? '' : 's'}`}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Complete job ─── */}
      <Dialog open={action === 'complete'} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Complete job</DialogTitle>
              <DialogDescription>
                Create the finished inventory piece. Net metal cannot exceed what&apos;s
                on the job (issued − returned).
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={submitComplete} className="space-y-4 pt-2">
            {/* Missing purity warning */}
            {!plannedPurityId && (
              <div className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertTriangle className="mb-1 inline h-3.5 w-3.5" /> No planned
                finished purity set. Close this dialog and click{' '}
                <strong>Set purity</strong> on the job header. The RPC will reject
                completion until it&apos;s set.
              </div>
            )}

            {/* Target-aware summary */}
            <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-brand-900">
                  {expectedFinished != null ? 'Target net weight' : 'Net weight'}
                </span>
                <span className="font-semibold tabular text-brand-900">
                  {targetNet.toFixed(3)} g
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Issued</span>
                  <span className="tabular">{issuedFine.toFixed(3)} g</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Returned</span>
                  <span className="tabular">{returnedFine.toFixed(3)} g</span>
                </div>
                <div className="flex justify-between border-t border-brand-200 pt-1 font-medium text-slate-700">
                  <span>Available for finish</span>
                  <span className="tabular">{availableMetal.toFixed(3)} g</span>
                </div>
                {expectedFinished != null && availableMetal > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>Expected wastage</span>
                    <span className="tabular">
                      {(availableMetal - targetNet).toFixed(3)} g (
                      {(((availableMetal - targetNet) / availableMetal) * 100).toFixed(
                        1,
                      )}
                      %)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Variant / design soft warning */}
            {!hasVariant && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mb-1 inline h-3.5 w-3.5" /> No design
                linked. The finished piece won&apos;t reference a design — but
                completion still works.
              </div>
            )}

            <div className="space-y-1">
              <Label>
                Finished inventory tag <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                value={completeForm.inventory_tag}
                onChange={(e) =>
                  setCompleteForm({ ...completeForm, inventory_tag: e.target.value })
                }
                className="font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>
                  Net metal weight (g) <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  value={completeForm.net_metal_weight_g}
                  onChange={(e) => {
                    const next = {
                      ...completeForm,
                      net_metal_weight_g: e.target.value,
                    }
                    if (!grossTouched) {
                      next.gross_weight_g = computeGrossFromStones(
                        e.target.value,
                        completeForm.mounted_stones,
                      )
                    }
                    setCompleteForm(next)
                  }}
                />
                <p className="text-xs text-slate-500">
                  Max {availableMetal.toFixed(3)} g
                  {expectedFinished != null && ` · Target ${targetNet.toFixed(3)} g`}
                </p>
              </div>
              <div className="space-y-1">
                <Label>
                  Gross weight (g) <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  type="number"
                  step="0.001"
                  min="0"
                  value={completeForm.gross_weight_g}
                  onChange={(e) => {
                    setGrossTouched(true)
                    setCompleteForm({ ...completeForm, gross_weight_g: e.target.value })
                  }}
                />
                <p className="text-xs text-slate-500">
                  Net + stones ({mountedCaratTotal.toFixed(3)} ct × 0.2 g)
                </p>
              </div>
            </div>

            {/* Soft deviation from target */}
            {showDeviationWarning && deviationPct != null && (
              <div
                className={`rounded-md border p-3 text-xs ${
                  deviationPct > 0
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-sky-200 bg-sky-50 text-sky-800'
                }`}
              >
                <AlertTriangle className="mb-1 inline h-3.5 w-3.5" />
                {deviationPct > 0 ? (
                  <>
                    You entered{' '}
                    <strong>{deviationPct.toFixed(1)}% more</strong> than target (
                    {enteredNet.toFixed(3)} vs {targetNet.toFixed(3)} g). This
                    leaves less wastage than expected.
                  </>
                ) : (
                  <>
                    You entered{' '}
                    <strong>{Math.abs(deviationPct).toFixed(1)}% less</strong> than
                    target ({enteredNet.toFixed(3)} vs {targetNet.toFixed(3)} g).
                    Wastage will be higher than expected.
                  </>
                )}
              </div>
            )}

            {/* ── Costing panel ── */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Costing
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>
                    Metal ({enteredNet.toFixed(3)} g × ₹{fmtMoney(metalRatePerG)}/g)
                  </span>
                  <span className="tabular">₹ {fmtMoney(enteredMetalValue)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Stones ({completeForm.mounted_stones.length} mounted ·{' '}
                    {mountedCaratTotal.toFixed(3)} ct)
                  </span>
                  <span className="tabular">
                    ₹ {fmtMoney(selectedMountedStoneValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    Making charge{' '}
                    <span className="text-slate-400">
                      ({makingChargeTouched ? 'manual' : computedMakingCharge.basis})
                    </span>
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      makingChargeTouched
                        ? makingChargeOverride
                        : computedMakingCharge.amount.toFixed(2)
                    }
                    onChange={(e) => {
                      setMakingChargeTouched(true)
                      setMakingChargeOverride(e.target.value)
                    }}
                    className="h-7 w-28 text-right tabular text-xs"
                  />
                </div>
                {!makingChargeTouched && computedMakingCharge.formula && (
                  <p className="text-[10px] text-slate-400">
                    {computedMakingCharge.formula}
                  </p>
                )}
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
                  <span className="text-slate-900">Total cost</span>
                  <span className="tabular text-brand-700">
                    ₹ {fmtMoney(enteredTotalCost)}
                  </span>
                </div>
              </div>
            </div>

            {stonesOnJob.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label>Stones to mount</Label>
                  <span className="text-xs text-slate-500">
                    {completeForm.mounted_stones.length} of {stonesOnJob.length} selected
                  </span>
                </div>
                <ul className="space-y-1">
                  {stonesOnJob.map((s) => {
                    const checked = completeForm.mounted_stones.includes(s.stone_item_id)
                    return (
                      <li
                        key={s.stone_item_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <label className="flex flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...completeForm.mounted_stones, s.stone_item_id]
                                : completeForm.mounted_stones.filter(
                                    (id) => id !== s.stone_item_id,
                                  )
                              const update = { ...completeForm, mounted_stones: next }
                              if (!grossTouched) {
                                update.gross_weight_g = computeGrossFromStones(
                                  completeForm.net_metal_weight_g,
                                  next,
                                )
                              }
                              setCompleteForm(update)
                            }}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="font-mono text-xs">{s.inventory_tag}</span>
                          <span className="text-slate-600">
                            {s.carat.toFixed(3)} ct ·{' '}
                            {[s.shape, s.color, s.clarity, s.cut]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  Unchecked stones remain on the job. Return them separately if not
                  used.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={completeForm.notes}
                onChange={(e) =>
                  setCompleteForm({ ...completeForm, notes: e.target.value })
                }
              />
            </div>

            <DialogFooter className="!mt-6">
              <Button type="button" variant="outline" onClick={() => setAction(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !plannedPurityId}
                className="gap-2"
              >
                {saving ? 'Completing…' : 'Complete job'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}