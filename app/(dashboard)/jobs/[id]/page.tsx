import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { JobActions } from './job-actions'
import { SetPurityButton } from './set-purity-button'
import { SetMakingChargeButton } from './set-making-charge-button'
import {
  computeMakingCharge,
  weightedAverageMetalRate,
  type MakingChargeType,
} from '@/lib/making-charge'
import {
  Printer,
  Target,
  Gem,
  AlertTriangle,
  IndianRupee,
  Wallet,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtG = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}
const fmtCt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '—'
}
const fmtMoney = (v: unknown) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// ★ stone_items stores cost_per_carat / selling_per_carat (rates), not totals
function deriveStoneCost(stone: any): number | null {
  if (!stone) return null
  const rate = stone.cost_per_carat != null ? Number(stone.cost_per_carat) : null
  const carat = Number(stone.carat ?? 0)
  if (rate == null) return null
  return rate * carat
}

function describeMakingCharge(type: string, value: number): string {
  switch (type) {
    case 'fixed':
      return `₹${value.toLocaleString('en-IN')} flat`
    case 'per_gram':
      return `₹${value.toLocaleString('en-IN')}/g`
    case 'percent_of_metal':
      return `${value}% of metal`
    case 'percent_of_total':
      return `${value}% of total`
    default:
      return `${value}`
  }
}

type StoneStatus = 'mounted' | 'returned' | 'on_job'

function stoneStatusLabel(status: StoneStatus): {
  label: string
  className: string
} {
  switch (status) {
    case 'mounted':
      return {
        label: 'Mounted',
        className:
          'inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200',
      }
    case 'returned':
      return {
        label: 'Returned',
        className:
          'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200',
      }
    case 'on_job':
      return {
        label: 'On job',
        className:
          'inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200',
      }
  }
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [
    { data: job, error },
    { data: craftsmen },
    { data: designs },
    { data: lots },
    { data: availableStones, error: availableStonesError },
    { data: metalTxns },
    { data: stoneIssues, error: stoneIssuesError },
    { data: stoneReturns },
    { data: purities },
    { data: jobPayments, error: jobPaymentsError },
  ] = await Promise.all([
    supabase.from('craftsman_jobs').select('*').eq('id', id).single(),
    supabase.from('craftsmen').select('id, name, code'),
    supabase
      .from('product_designs')
      .select(
        'id, name, design_code, product_type, making_charge_type, making_charge_value',
      ),
    supabase.from('v_metal_lot_balances').select('*'),
    // ★ cost_per_carat / selling_per_carat, not cost_price
    supabase
      .from('stone_items')
      .select(
        'id, inventory_tag, carat, shape, color, clarity, cut, cost_per_carat, selling_per_carat',
      )
      .eq('status', 'available')
      .order('inventory_tag')
      .limit(500),
    supabase
      .from('metal_transactions')
      .select('*')
      .eq('reference_id', id)
      .order('created_at', { ascending: false }),
    // ★ same fix on the joined stone_items
    supabase
      .from('craftsman_job_stone_issues')
      .select(
        '*, stone_items(id, inventory_tag, carat, shape, color, clarity, cut, cost_per_carat, selling_per_carat, status)',
      )
      .eq('job_id', id)
      .order('issued_at', { ascending: false }),
    supabase
      .from('craftsman_job_stone_returns')
      .select('stone_item_id')
      .eq('job_id', id),
    supabase
      .from('metal_purities')
      .select('id, code, purity_percent')
      .eq('is_active', true)
      .order('code'),
    supabase
      .from('craftsman_job_payments')
      .select('amount')
      .eq('job_id', id)
      .is('voided_at', null),
  ])

  if (error || !job) notFound()

  // Surface payment schema issues
  if (
    jobPaymentsError &&
    jobPaymentsError.message &&
    jobPaymentsError.message.includes('voided_at')
  ) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Payments table missing columns</p>
        <p className="mt-1">
          The <code>craftsman_job_payments</code> table doesn&apos;t have a{' '}
          <code>voided_at</code> column. Run the SQL from the setup message to
          add <code>voided_at</code>, <code>voided_by</code>,{' '}
          <code>void_reason</code>, <code>payment_date</code>,{' '}
          <code>payment_method</code>, <code>reference</code>,{' '}
          <code>updated_at</code>. Once those exist, this page will render
          normally.
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs">
          {jobPaymentsError.message}
        </pre>
      </div>
    )
  }

  // ★ Surface stone schema issues — otherwise the "Issue stones" button
  // silently disables and nobody knows why.
  if (availableStonesError || stoneIssuesError) {
    return (
      <div className="space-y-3">
        <div className="rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-semibold">Stone query failed</p>
          <p className="mt-1 text-xs">
            The page can&apos;t load stones — this is why the &quot;Issue
            stones&quot; button is disabled. Check the error below.
          </p>
          {availableStonesError && (
            <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs">
              available stones: {availableStonesError.message}
            </pre>
          )}
          {stoneIssuesError && (
            <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs">
              stone issues: {stoneIssuesError.message}
            </pre>
          )}
        </div>
      </div>
    )
  }

  const craftsmanMap: Record<string, { name: string; code: string }> =
    Object.fromEntries(
      (craftsmen ?? []).map((c) => [c.id, { name: c.name, code: c.code }]),
    )
  const designMap: Record<
    string,
    {
      name: string
      design_code: string
      product_type: string
      making_charge_type: string
      making_charge_value: number | string
    }
  > = Object.fromEntries(
    (designs ?? []).map((d) => [
      d.id,
      {
        name: d.name,
        design_code: d.design_code,
        product_type: d.product_type,
        making_charge_type: d.making_charge_type,
        making_charge_value: d.making_charge_value,
      },
    ]),
  )
  const purityMap: Record<string, string> = Object.fromEntries(
    (purities ?? []).map((p) => [p.id, p.code]),
  )
  const purityPercentMap: Record<string, number> = Object.fromEntries(
    (purities ?? []).map((p) => [p.id, Number(p.purity_percent) || 0]),
  )
  const purityOptions = (purities ?? []).map((p) => ({
    id: p.id,
    label: p.code,
  }))

  const craftsman = craftsmanMap[job.craftsman_id]
  const design = job.design_id ? designMap[job.design_id] : null
  const plannedPurityId =
    (job.planned_finished_purity_id as string | null) ?? null
  const plannedPurityLabel = plannedPurityId ? purityMap[plannedPurityId] : null
  const plannedPurityPercent = plannedPurityId
    ? (purityPercentMap[plannedPurityId] ?? 0)
    : 0

  const metalLotMap: Record<
    string,
    { lot_number: string; purity_code: string | null }
  > = Object.fromEntries(
    (lots ?? []).map((l) => [
      l.metal_lot_id,
      { lot_number: l.lot_number, purity_code: l.purity_code },
    ]),
  )

  const lotOptions = (lots ?? [])
    .filter((l) => Number(l.balance_fine_g) > 0)
    .map((l) => ({
      id: l.metal_lot_id as string,
      label: `${l.lot_number} · ${l.purity_code ?? '?'} · ${Number(l.balance_fine_g).toFixed(3)}g avail`,
      purity_percent: l.purity_percent as number | string | null,
    }))

  // ★ derive cost_price from cost_per_carat × carat
  const availableStoneOptions = (availableStones ?? []).map((s) => {
    const carat = Number(s.carat)
    return {
      id: s.id,
      label: `${s.inventory_tag} · ${carat.toFixed(3)} ct · ${s.shape ?? ''} ${s.color ?? ''} ${s.clarity ?? ''}`.trim(),
      carat,
      shape: s.shape,
      color: s.color,
      clarity: s.clarity,
      cut: s.cut,
      cost_price: deriveStoneCost(s),
    }
  })

  const returnedIds = new Set((stoneReturns ?? []).map((r) => r.stone_item_id))

  type EnrichedStone = {
    stone_item_id: string
    issued_at: string
    inventory_tag: string
    carat: number
    shape: string | null
    color: string | null
    clarity: string | null
    cut: string | null
    cost_price: number | null
    display_status: StoneStatus
  }

  const allIssuedStones: EnrichedStone[] = (stoneIssues ?? []).map((iss) => {
    const stone = iss.stone_items as Record<string, unknown> | null
    const rawStatus = String(stone?.status ?? '')
    const isReturned = returnedIds.has(iss.stone_item_id)
    const display_status: StoneStatus = isReturned
      ? 'returned'
      : rawStatus === 'mounted'
        ? 'mounted'
        : 'on_job'
    return {
      stone_item_id: iss.stone_item_id as string,
      issued_at: iss.issued_at as string,
      inventory_tag: String(stone?.inventory_tag ?? '—'),
      carat: Number(stone?.carat ?? 0),
      shape: (stone?.shape as string | null) ?? null,
      color: (stone?.color as string | null) ?? null,
      clarity: (stone?.clarity as string | null) ?? null,
      cut: (stone?.cut as string | null) ?? null,
      cost_price: deriveStoneCost(stone),
      display_status,
    }
  })

  const stonesOnJob = allIssuedStones
    .filter((s) => s.display_status === 'on_job')
    .map((s) => ({
      stone_item_id: s.stone_item_id,
      issued_at: s.issued_at,
      inventory_tag: s.inventory_tag,
      carat: s.carat,
      shape: s.shape,
      color: s.color,
      clarity: s.clarity,
      cut: s.cut,
      cost_price: s.cost_price,
    }))

  const mountedCount = allIssuedStones.filter(
    (s) => s.display_status === 'mounted',
  ).length
  const returnedCount = allIssuedStones.filter(
    (s) => s.display_status === 'returned',
  ).length
  const onJobCount = allIssuedStones.filter(
    (s) => s.display_status === 'on_job',
  ).length

  const issuedFine = Number(job.issued_fine_g) || 0
  const returnedFine = Number(job.returned_fine_g) || 0
  const finishedFine = Number(job.finished_fine_g) || 0
  const wastageFine = Number(job.wastage_fine_g) || 0
  const expectedFinished =
    job.expected_finished_weight_g != null
      ? Number(job.expected_finished_weight_g)
      : null

  const isTerminal =
    job.status === 'completed' ||
    job.status === 'delivered' ||
    job.status === 'cancelled'

  const wipFine = isTerminal ? 0 : issuedFine - returnedFine - finishedFine

  const wastagePct =
    issuedFine > 0 ? (wastageFine / issuedFine) * 100 : null

  const lotRateMap: Record<string, number> = Object.fromEntries(
    (lots ?? []).map((l) => [l.metal_lot_id, Number(l.rate_per_gram) || 0]),
  )
  const metalIssues = (metalTxns ?? []).filter(
    (t) => t.txn_type === 'issue_to_job',
  )
  const weightedRatePerG = weightedAverageMetalRate(
    metalIssues.map((t) => ({
      fine_g: Math.abs(Number(t.fine_weight_change_g) || 0),
      rate_per_g: lotRateMap[t.metal_lot_id as string] ?? 0,
    })),
  )
  const hasMetalIssued = metalIssues.length > 0

  // ★ cost_price is now derived, so this sums correctly
  const mountedStoneValue = allIssuedStones
    .filter((s) => s.display_status === 'mounted')
    .reduce((sum, s) => sum + Number(s.cost_price ?? 0), 0)

  const jobMakingChargeType = job.making_charge_type as string | null
  const jobMakingChargeValue =
    job.making_charge_value != null ? Number(job.making_charge_value) : null

  const makingChargeType: MakingChargeType =
    ((jobMakingChargeType ?? design?.making_charge_type) as
      | MakingChargeType
      | undefined) ?? 'fixed'
  const makingChargeValue =
    jobMakingChargeValue != null
      ? jobMakingChargeValue
      : Number(design?.making_charge_value ?? 0)
  const makingChargeSource: 'job' | 'design' | 'none' =
    jobMakingChargeValue != null
      ? 'job'
      : design?.making_charge_value != null
        ? 'design'
        : 'none'

  const existingMakingCharge =
    job.making_charge_amount != null
      ? Number(job.making_charge_amount)
      : null

  const ruleMakingCharge =
    finishedFine > 0
      ? computeMakingCharge(
          { type: makingChargeType, value: makingChargeValue },
          {
            netMetalFineG: finishedFine,
            metalRatePerG: weightedRatePerG,
            stoneValue: 0,
          },
        ).amount
      : 0

  const paidOnJob = (jobPayments ?? []).reduce(
    (sum, p) => sum + Number(p.amount ?? 0),
    0,
  )
  const jobPaymentBalance =
    existingMakingCharge != null ? existingMakingCharge - paidOnJob : 0
  const jobSettled = Math.abs(jobPaymentBalance) < 0.01

  const variance =
    expectedFinished != null && finishedFine > 0
      ? finishedFine - expectedFinished
      : null
  const varianceClass =
    variance == null
      ? ''
      : Math.abs(variance) < 0.05
        ? 'text-emerald-700'
        : Math.abs(variance) < 0.5
          ? 'text-amber-700'
          : 'text-rose-700'

  return (
    <div className="space-y-6">
      <div>
        <Link href="/jobs" className="text-sm text-slate-500 hover:underline">
          ← Back to jobs
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">{job.job_number}</h1>
          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {humanize(job.job_type)}
          </span>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">
            {job.status.replace(/_/g, ' ')}
          </span>
          {plannedPurityLabel ? (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              <Gem className="h-3 w-3" /> {plannedPurityLabel}
            </span>
          ) : (
            !isTerminal && (
              <SetPurityButton
                jobId={job.id}
                currentPurityId={plannedPurityId}
                purityOptions={purityOptions}
                label="Set purity"
              />
            )
          )}
          {!isTerminal && makingChargeSource !== 'none' && (
            <SetMakingChargeButton
              jobId={job.id}
              currentType={jobMakingChargeType}
              currentValue={jobMakingChargeValue}
              defaultType={design?.making_charge_type ?? null}
              defaultValue={
                design?.making_charge_value != null
                  ? Number(design.making_charge_value)
                  : null
              }
              label={
                makingChargeSource === 'job'
                  ? `Making: ${describeMakingCharge(makingChargeType, makingChargeValue)}`
                  : `Making (design default): ${describeMakingCharge(makingChargeType, makingChargeValue)}`
              }
            />
          )}
          {isTerminal && makingChargeSource !== 'none' && (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              <IndianRupee className="h-3 w-3" />{' '}
              {existingMakingCharge != null &&
              existingMakingCharge > 0 &&
              ruleMakingCharge > 0 &&
              Math.abs(existingMakingCharge - ruleMakingCharge) > 1
                ? `₹${fmtMoney(existingMakingCharge)} recorded (rule: ${describeMakingCharge(makingChargeType, makingChargeValue)})`
                : describeMakingCharge(makingChargeType, makingChargeValue)}
            </span>
          )}
          {expectedFinished != null && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
              <Target className="h-3 w-3" />
              Target: {fmtG(expectedFinished)} g
            </span>
          )}
          <a
            href={`/job-cards/${job.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" /> Print job card
          </a>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {design ? (
            <>
              {design.name} ·{' '}
              <span className="font-mono">{design.design_code}</span>
            </>
          ) : (
            'No design linked'
          )}
          {craftsman && (
            <>
              {' '}
              · Craftsman:{' '}
              <Link
                href={`/craftsmen/${job.craftsman_id}`}
                className="text-brand-700 hover:underline"
              >
                {craftsman.name}
              </Link>{' '}
              <span className="font-mono text-xs">({craftsman.code})</span>
            </>
          )}
        </p>
      </div>

      {!plannedPurityId && !isTerminal && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-rose-900">
                No planned finished purity set
              </p>
              <p className="mt-0.5 text-rose-800">
                The completion RPC needs this to record the finished inventory
                piece&apos;s metal purity. Set it before completing.
              </p>
            </div>
            <SetPurityButton
              jobId={job.id}
              currentPurityId={plannedPurityId}
              purityOptions={purityOptions}
              variant="default"
              label="Set purity"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Issued fine
          </p>
          <p className="mt-1 text-2xl font-semibold tabular">
            {fmtG(issuedFine)}
            <span className="ml-1 text-sm font-normal text-slate-500">g</span>
          </p>
          {expectedFinished != null && issuedFine > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">
              Buffer: {fmtG(issuedFine - expectedFinished)} g
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Returned fine
          </p>
          <p className="mt-1 text-2xl font-semibold tabular">
            {fmtG(returnedFine)}
            <span className="ml-1 text-sm font-normal text-slate-500">g</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Finished fine
          </p>
          <p className="mt-1 text-2xl font-semibold tabular text-brand-700">
            {fmtG(finishedFine)}
            <span className="ml-1 text-sm font-normal text-slate-500">g</span>
          </p>
          {expectedFinished != null ? (
            variance != null ? (
              <p className={`mt-0.5 text-xs font-medium ${varianceClass}`}>
                {variance > 0 ? '+' : variance < 0 ? '−' : ''}
                {Math.abs(variance).toFixed(3)} g vs target
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-500">
                Target: {fmtG(expectedFinished)} g
              </p>
            )
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">No target set</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Wastage fine
          </p>
          <p className="mt-1 text-2xl font-semibold tabular text-rose-600">
            {fmtG(wastageFine)}
            <span className="ml-1 text-sm font-normal text-slate-500">g</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {isTerminal
              ? `Written off at completion${wastagePct != null ? ` · ${wastagePct.toFixed(1)}% of issued` : ''}`
              : `WIP: ${fmtG(wipFine)} g`}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-brand-700" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isTerminal ? 'Costing summary' : 'Pricing estimate'}
          </p>
        </div>
        {(() => {
          const netForCalc =
            isTerminal && finishedFine > 0
              ? finishedFine
              : expectedFinished != null
                ? expectedFinished
                : issuedFine - returnedFine

          const storedMaking = existingMakingCharge
          const computed = computeMakingCharge(
            { type: makingChargeType, value: makingChargeValue },
            {
              netMetalFineG: netForCalc,
              metalRatePerG: weightedRatePerG,
              stoneValue: mountedStoneValue,
            },
          )
          const makingAmount =
            storedMaking != null ? storedMaking : computed.amount
          const metalValue = netForCalc * weightedRatePerG
          const stoneValue = mountedStoneValue
          const totalCost = metalValue + stoneValue + makingAmount

          return (
            <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
              <div>
                <dt className="text-xs text-slate-500">Metal value</dt>
                <dd className="tabular font-medium">
                  {hasMetalIssued ? `₹ ${fmtMoney(metalValue)}` : 'Pending issue'}
                </dd>
                <dd className="text-[10px] text-slate-400">
                  {hasMetalIssued
                    ? `${netForCalc.toFixed(3)} g × ₹${fmtMoney(weightedRatePerG)}/g`
                    : 'Rate applies once metal is issued'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Stones</dt>
                <dd className="tabular font-medium">
                  {mountedCount > 0 ? `₹ ${fmtMoney(stoneValue)}` : 'Pending mount'}
                </dd>
                <dd className="text-[10px] text-slate-400">
                  {mountedCount} mounted
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">
                  Making charge
                  {makingChargeSource === 'design' && (
                    <span className="ml-1 text-amber-700">(design default)</span>
                  )}
                </dt>
                <dd className="tabular font-medium">
                  ₹ {fmtMoney(makingAmount)}
                </dd>
                <dd className="text-[10px] text-slate-400">
                  {storedMaking != null
                    ? 'Recorded at completion'
                    : computed.formula}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Rate / g</dt>
                <dd className="tabular font-medium">
                  {hasMetalIssued ? `₹ ${fmtMoney(weightedRatePerG)}` : '—'}
                </dd>
                <dd className="text-[10px] text-slate-400">
                  {hasMetalIssued ? 'weighted avg' : 'pending issue'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">
                  {isTerminal ? 'Total cost' : 'Est. total cost'}
                </dt>
                <dd className="tabular text-base font-semibold text-brand-700">
                  ₹ {fmtMoney(totalCost)}
                </dd>
              </div>
            </dl>
          )
        })()}
      </div>

      {isTerminal &&
        job.status !== 'cancelled' &&
        existingMakingCharge != null &&
        existingMakingCharge > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-brand-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Craftsman payment
                </p>
              </div>
              {craftsman && (
                <Link
                  href={`/craftsmen/${job.craftsman_id}`}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Open craftsman ledger →
                </Link>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-500">Craftsman earns</dt>
                <dd className="tabular font-medium">
                  ₹ {fmtMoney(existingMakingCharge)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Paid on this job</dt>
                <dd className="tabular font-medium text-emerald-700">
                  ₹ {fmtMoney(paidOnJob)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Balance</dt>
                <dd
                  className={`tabular font-semibold ${
                    jobSettled ? 'text-slate-400' : 'text-amber-700'
                  }`}
                >
                  {jobSettled ? '✓ settled' : `₹ ${fmtMoney(jobPaymentBalance)}`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Settlement</dt>
                <dd className="text-sm">
                  {jobSettled ? 'Complete' : 'Pending'}
                </dd>
              </div>
            </dl>
          </div>
        )}

      <JobActions
        jobId={job.id}
        status={job.status}
        jobNumber={job.job_number}
        issuedFine={issuedFine}
        returnedFine={returnedFine}
        expectedFinished={expectedFinished}
        plannedPurityId={plannedPurityId}
        plannedPurityPercent={plannedPurityPercent}
        hasVariant={Boolean(job.variant_id || job.design_id)}
        lotOptions={lotOptions}
        availableStoneOptions={availableStoneOptions}
        stonesOnJob={stonesOnJob}
        makingChargeType={makingChargeType}
        makingChargeValue={makingChargeValue}
        metalRatePerG={weightedRatePerG}
        currentStoneValue={mountedStoneValue}
        existingMakingCharge={existingMakingCharge}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Metal ledger</h2>
        {(metalTxns ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No metal movements on this job yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Type
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Lot
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Fine change
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {(metalTxns ?? []).map((t) => {
                  const n = Number(t.fine_weight_change_g)
                  const positive = n > 0
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                        {new Date(t.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {humanize(t.txn_type)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                        {metalLotMap[t.metal_lot_id]?.lot_number ?? '—'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular ${
                          positive
                            ? 'text-emerald-700'
                            : n < 0
                              ? 'text-rose-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {positive ? '+' : n < 0 ? '−' : ''}
                        {Math.abs(n).toFixed(3)} g
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {t.notes ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Stones</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {mountedCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-brand-700 ring-1 ring-inset ring-brand-200">
                {mountedCount} mounted
              </span>
            )}
            {onJobCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-sky-700 ring-1 ring-inset ring-sky-200">
                {onJobCount} on job
              </span>
            )}
            {returnedCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 ring-1 ring-inset ring-slate-200">
                {returnedCount} returned
              </span>
            )}
          </div>
        </div>

        {allIssuedStones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            No stones issued to this job yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Tag
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    4Cs
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Carat
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Issued
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {allIssuedStones.map((s) => {
                  const summary =
                    [s.shape, s.color, s.clarity, s.cut && s.cut !== 'N/A' ? s.cut : null]
                      .filter((p): p is string => Boolean(p))
                      .join(' · ') || '—'
                  const badge = stoneStatusLabel(s.display_status)
                  const isDim = s.display_status === 'returned'
                  return (
                    <tr
                      key={s.stone_item_id}
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                        isDim ? 'bg-slate-50/40' : ''
                      }`}
                    >
                      <td
                        className={`px-4 py-2.5 font-mono text-xs ${
                          isDim ? 'text-slate-500' : ''
                        }`}
                      >
                        {s.inventory_tag}
                      </td>
                      <td
                        className={`px-4 py-2.5 ${
                          isDim ? 'text-slate-500' : 'text-slate-600'
                        }`}
                      >
                        {summary}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular ${
                          isDim ? 'text-slate-500' : 'font-semibold'
                        }`}
                      >
                        {fmtCt(s.carat)} ct
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-2.5 ${
                          isDim ? 'text-slate-500' : 'text-slate-600'
                        }`}
                      >
                        {new Date(s.issued_at).toLocaleDateString('en-IN', {
                          dateStyle: 'medium',
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={badge.className}>{badge.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Job timeline</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd>{new Date(job.created_at).toLocaleDateString('en-IN')}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Started</dt>
            <dd>
              {job.start_date
                ? new Date(job.start_date).toLocaleDateString('en-IN')
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Due</dt>
            <dd>
              {job.due_date
                ? new Date(job.due_date).toLocaleDateString('en-IN')
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Completed</dt>
            <dd>
              {job.completed_at
                ? new Date(job.completed_at).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '—'}
            </dd>
          </div>
        </dl>
        {job.notes && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <dt className="text-xs font-medium text-slate-500">Notes</dt>
            <dd className="mt-1 text-sm text-slate-700">{job.notes}</dd>
          </div>
        )}
      </div>
    </div>
  )
} 