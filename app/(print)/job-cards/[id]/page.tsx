import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { requireRole } from '@/lib/guard'
import { PrintButton } from './print-button'
import { weightedAverageMetalRate } from '@/lib/making-charge'
import { getCompanySettings, formatAddress } from '@/lib/company-settings'

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
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

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

export default async function JobCardPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  // ★ Load company profile
  const company = await getCompanySettings(supabase)
  const companyAddress = formatAddress(company)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: job, error } = await supabase
    .from('craftsman_jobs')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !job) notFound()

  const [
    craftsmanRes,
    designRes,
    metalTxnsRes,
    stoneIssuesRes,
    stoneReturnsRes,
    lotsRes,
    paymentsRes,
    profileRes,
  ] = await Promise.all([
    supabase.from('craftsmen').select('*').eq('id', job.craftsman_id).single(),
    job.design_id
      ? supabase.from('product_designs').select('*').eq('id', job.design_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('metal_transactions')
      .select('*')
      .eq('reference_id', id)
      .order('created_at'),
    supabase
      .from('craftsman_job_stone_issues')
      .select(
        '*, stone_items(inventory_tag, carat, shape, color, clarity, cut, cost_per_carat, selling_per_carat, status, location_id)',
      )
      .eq('job_id', id)
      .order('issued_at'),
    supabase
      .from('craftsman_job_stone_returns')
      .select(
        '*, stone_items(inventory_tag, carat, shape, color, clarity, cut)',
      )
      .eq('job_id', id)
      .order('received_at'),
    supabase
      .from('v_metal_lot_balances')
      .select('metal_lot_id, lot_number, purity_code, rate_per_gram'),
    supabase
      .from('craftsman_job_payments')
      .select('id, amount, payment_method, reference, payment_date, voided_at')
      .eq('job_id', id)
      .order('payment_date', { ascending: false }),
    user
      ? supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (stoneIssuesRes.error) {
    console.error('[job-card] stone issues query failed:', stoneIssuesRes.error)
  }
  if (metalTxnsRes.error) {
    console.error('[job-card] metal transactions query failed:', metalTxnsRes.error)
  }
  if (paymentsRes.error) {
    console.error('[job-card] payments query failed:', paymentsRes.error)
  }

  const craftsman = craftsmanRes.data
  const design = designRes.data
  const metalTxns = metalTxnsRes.data ?? []
  const stoneIssues = stoneIssuesRes.data ?? []
  const stoneReturns = stoneReturnsRes.data ?? []
  const lots = lotsRes.data ?? []
  const payments = paymentsRes.data ?? []
  const profile = profileRes.data

  const lotMap: Record<
    string,
    { lot_number: string; purity_code: string | null; rate_per_gram: number }
  > = Object.fromEntries(
    lots.map((l) => [
      l.metal_lot_id,
      {
        lot_number: l.lot_number,
        purity_code: l.purity_code,
        rate_per_gram: Number((l as any).rate_per_gram ?? 0),
      },
    ]),
  )

  const metalIssued = metalTxns.filter((t) => t.txn_type === 'issue_to_job')
  const metalReturned = metalTxns.filter((t) => t.txn_type === 'return_from_job')
  const returnedIds = new Set(stoneReturns.map((r) => r.stone_item_id))

  const issuedFine = metalIssued.reduce(
    (s, t) => s + Math.abs(Number(t.fine_weight_change_g) || 0),
    0,
  )
  const returnedFine = metalReturned.reduce(
    (s, t) => s + Math.abs(Number(t.fine_weight_change_g) || 0),
    0,
  )
  const finishedFine = Number(job.finished_fine_g) || 0
  const wastageFine = Number(job.wastage_fine_g) || 0
  const expectedFinished =
    job.expected_finished_weight_g != null
      ? Number(job.expected_finished_weight_g)
      : null
  const wipFine = issuedFine - returnedFine - finishedFine

  const jobIsComplete =
    job.status === 'completed' || job.status === 'delivered'
  const jobIsCancelled = job.status === 'cancelled'

  const jobMCT = (job.making_charge_type as string | null) ?? null
  const jobMCV =
    job.making_charge_value != null ? Number(job.making_charge_value) : null
  const designMCT =
    design?.making_charge_type != null
      ? String(design.making_charge_type)
      : null
  const designMCV =
    design?.making_charge_value != null
      ? Number(design.making_charge_value)
      : null
  const makingChargeType = jobMCT ?? designMCT ?? null
  const makingChargeValue = jobMCV ?? designMCV ?? null
  const makingChargeAmount =
    job.making_charge_amount != null
      ? Number(job.making_charge_amount)
      : null
  const makingChargeRuleText =
    makingChargeType && makingChargeValue != null
      ? describeMakingCharge(makingChargeType, makingChargeValue)
      : null

  const metalIssuesForRate = metalIssued.map((t) => ({
    fine_g: Math.abs(Number(t.fine_weight_change_g) || 0),
    rate_per_g: lotMap[t.metal_lot_id]?.rate_per_gram ?? 0,
  }))
  const weightedRatePerG =
    metalIssuesForRate.length > 0
      ? weightedAverageMetalRate(metalIssuesForRate)
      : 0

  const netForCalc =
    jobIsComplete && finishedFine > 0
      ? finishedFine
      : expectedFinished != null
        ? expectedFinished
        : issuedFine - returnedFine

  const metalValue = netForCalc * weightedRatePerG

  const mountedStoneIssues = stoneIssues.filter((si) => {
    const stone = si.stone_items as Record<string, unknown> | null
    return String(stone?.status ?? '') === 'mounted'
  })
  const mountedStoneCount = mountedStoneIssues.length
  const stoneValue = mountedStoneIssues.reduce((sum, si) => {
    const stone = si.stone_items as Record<string, unknown> | null
    const cost = deriveStoneCost(stone)
    return sum + (cost ?? 0)
  }, 0)

  const totalCost =
    metalValue + stoneValue + (makingChargeAmount ?? 0)

  const activePayments = payments.filter((p: any) => !p.voided_at)
  const paidAmount = activePayments.reduce(
    (s: number, p: any) => s + Number(p.amount ?? 0),
    0,
  )
  const paymentBalance =
    makingChargeAmount != null ? makingChargeAmount - paidAmount : 0
  const paymentSettled = Math.abs(paymentBalance) < 0.01

  const showPaymentSection =
    (makingChargeAmount != null && makingChargeAmount > 0) ||
    payments.length > 0

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 print:hidden">
        <Link href={`/jobs/${job.id}`} className="text-sm text-slate-600 hover:underline">
          ← Back to job
        </Link>
        <PrintButton filename={`Job Card ${job.job_number}`} />
      </div>

      <div className="mx-auto my-6 max-w-[210mm] bg-white p-8 text-sm text-slate-900 shadow-lg print:my-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <Image
              src={company.logo_url || '/logo_minalgems.png'}
              alt={company.name}
              width={150}
              height={150}
              className="rounded"
              priority
            />
            <div>
              <p className="text-lg font-bold leading-tight">{company.name}</p>
              <p className="text-xs text-slate-600">Jewellery Manufacturing</p>
              {companyAddress && (
                <p className="text-[10px] text-slate-500">{companyAddress}</p>
              )}
              {company.phone && (
                <p className="text-[10px] text-slate-500">{company.phone}</p>
              )}
              {company.gstin && (
                <p className="text-[10px] text-slate-500">
                  GSTIN: {company.gstin}
                  {company.pan && <> · PAN: {company.pan}</>}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-widest">JOB CARD</p>
            <p className="mt-1 font-mono text-base font-semibold">{job.job_number}</p>
            <p className="text-xs text-slate-600">Issued: {fmtDate(job.created_at)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 border-b border-slate-300 py-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              To (Craftsman)
            </p>
            <p className="text-base font-semibold">{craftsman?.name ?? '—'}</p>
            <p className="text-xs">
              Code: <span className="font-mono">{craftsman?.code ?? '—'}</span>
            </p>
            {craftsman?.phone && <p className="text-xs">Phone: {craftsman.phone}</p>}
            {craftsman?.skill_type && (
              <p className="text-xs">Skill: {craftsman.skill_type}</p>
            )}
            <p className="text-xs">
              Type: {craftsman?.is_inhouse ? 'In-house' : 'Outsource'}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Job details
            </p>
            <p className="text-base font-semibold">{design?.name ?? 'No design linked'}</p>
            {design && <p className="text-xs font-mono">{design.design_code}</p>}
            <p className="text-xs">Job type: {humanize(job.job_type)}</p>
            {design && <p className="text-xs">Product: {humanize(design.product_type)}</p>}
            {job.due_date && (
              <p className="text-xs font-semibold text-rose-700">
                Due: {fmtDate(job.due_date)}
              </p>
            )}
            {expectedFinished != null && (
              <p className="text-xs font-semibold text-amber-800">
                Target finish: {fmtG(expectedFinished)} g
              </p>
            )}
            {makingChargeRuleText && (
              <p className="text-xs font-semibold text-emerald-800">
                Making charge rule: {makingChargeRuleText}
              </p>
            )}
          </div>
        </div>

        <div className="border-b border-slate-300 py-4 avoid-break">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Metal issued
          </p>
          {metalIssued.length === 0 ? (
            <p className="text-xs italic text-slate-500">No metal issued yet.</p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-400 text-left">
                  <th className="py-1 font-semibold">#</th>
                  <th className="py-1 font-semibold">Lot</th>
                  <th className="py-1 font-semibold">Purity</th>
                  <th className="py-1 text-right font-semibold">Fine (g)</th>
                  <th className="py-1 font-semibold">Issued on</th>
                  <th className="py-1 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {metalIssued.map((t, i) => {
                  const lot = lotMap[t.metal_lot_id]
                  const fine = Math.abs(Number(t.fine_weight_change_g))
                  return (
                    <tr key={t.id} className="border-b border-slate-200">
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1 font-mono">{lot?.lot_number ?? '—'}</td>
                      <td className="py-1">{lot?.purity_code ?? '—'}</td>
                      <td className="py-1 text-right font-mono tabular">
                        {fine.toFixed(3)}
                      </td>
                      <td className="py-1">{fmtDate(t.created_at)}</td>
                      <td className="py-1 text-slate-600">{t.notes ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-400 font-semibold">
                  <td colSpan={3} className="py-1 text-right">
                    Total issued fine
                  </td>
                  <td className="py-1 text-right font-mono tabular">
                    {issuedFine.toFixed(3)} g
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="border-b border-slate-300 py-4 avoid-break">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Stones issued
          </p>
          {stoneIssues.length === 0 ? (
            <p className="text-xs italic text-slate-500">No stones issued yet.</p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-400 text-left">
                  <th className="py-1 font-semibold">#</th>
                  <th className="py-1 font-semibold">Tag</th>
                  <th className="py-1 text-right font-semibold">Carat</th>
                  <th className="py-1 font-semibold">4Cs</th>
                  <th className="py-1 text-right font-semibold">Cost</th>
                  <th className="py-1 font-semibold">Issued on</th>
                  <th className="py-1 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {stoneIssues.map((si, i) => {
                  const stone = si.stone_items as Record<string, unknown> | null
                  const stoneStatus = String(stone?.status ?? '')
                  const isReturned = returnedIds.has(si.stone_item_id)
                  const summary =
                    [
                      stone?.shape,
                      stone?.color,
                      stone?.clarity,
                      stone?.cut && stone.cut !== 'N/A' ? stone.cut : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  const cost = deriveStoneCost(stone)
                  return (
                    <tr key={si.id} className="border-b border-slate-200">
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1 font-mono">
                        {String(stone?.inventory_tag ?? '—')}
                      </td>
                      <td className="py-1 text-right font-mono tabular">
                        {fmtCt(stone?.carat)}
                      </td>
                      <td className="py-1">{summary}</td>
                      <td className="py-1 text-right font-mono tabular">
                        {cost != null ? `₹${fmtMoney(cost)}` : '—'}
                      </td>
                      <td className="py-1">{fmtDate(si.issued_at)}</td>
                      <td className="py-1">
                        {isReturned ? (
                          <span className="font-semibold text-emerald-700">Returned</span>
                        ) : stoneStatus === 'mounted' ? (
                          <span className="font-semibold text-brand-700">Mounted</span>
                        ) : stoneStatus === 'sold' ? (
                          <span className="font-semibold text-slate-700">Sold</span>
                        ) : stoneStatus === 'lost' ? (
                          <span className="font-semibold text-rose-700">Lost</span>
                        ) : stoneStatus === 'damaged' ? (
                          <span className="font-semibold text-amber-700">Damaged</span>
                        ) : (
                          <span className="font-semibold text-amber-700">On job</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-400 font-semibold">
                  <td colSpan={2} className="py-1 text-right">
                    Total stones
                  </td>
                  <td className="py-1 text-right font-mono tabular">
                    {stoneIssues
                      .reduce(
                        (s, si) =>
                          s + Number((si.stone_items as any)?.carat ?? 0),
                        0,
                      )
                      .toFixed(3)}{' '}
                    ct
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        <div className="grid grid-cols-2 gap-12 border-b border-slate-300 py-4">
          <div>
            <div className="mt-10 h-10 border-b border-slate-800" />
            <p className="mt-1 text-[10px] text-slate-600">Issued by (signature)</p>
            <p className="text-[10px] text-slate-500">{profile?.full_name ?? '—'}</p>
          </div>
          <div>
            <div className="mt-10 h-10 border-b border-slate-800" />
            <p className="mt-1 text-[10px] text-slate-600">
              Received by (craftsman signature)
            </p>
            <p className="text-[10px] text-slate-500">{craftsman?.name ?? '—'}</p>
          </div>
        </div>

        <div className="py-4 avoid-break">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Return summary
          </p>

          <div className="mb-3 grid grid-cols-4 gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs">
            <div>
              <p className="text-[10px] uppercase text-slate-500">Issued fine</p>
              <p className="font-mono font-semibold">{issuedFine.toFixed(3)} g</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Returned fine</p>
              <p className="font-mono font-semibold">{returnedFine.toFixed(3)} g</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Finished fine</p>
              <p className="font-mono font-semibold text-brand-700">
                {finishedFine.toFixed(3)} g
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Wastage fine</p>
              <p className="font-mono font-semibold text-rose-700">
                {wastageFine.toFixed(3)} g
              </p>
            </div>
          </div>

          {metalReturned.length > 0 && (
            <>
              <p className="mb-1 mt-3 text-xs font-semibold">Metal returned</p>
              <table className="mb-3 w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-400 text-left">
                    <th className="py-1 font-semibold">#</th>
                    <th className="py-1 font-semibold">Lot</th>
                    <th className="py-1 font-semibold">Purity</th>
                    <th className="py-1 text-right font-semibold">Fine (g)</th>
                    <th className="py-1 font-semibold">Returned on</th>
                    <th className="py-1 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {metalReturned.map((t, i) => {
                    const lot = lotMap[t.metal_lot_id]
                    return (
                      <tr key={t.id} className="border-b border-slate-200">
                        <td className="py-1">{i + 1}</td>
                        <td className="py-1 font-mono">{lot?.lot_number ?? '—'}</td>
                        <td className="py-1">{lot?.purity_code ?? '—'}</td>
                        <td className="py-1 text-right font-mono tabular">
                          {Number(t.fine_weight_change_g).toFixed(3)}
                        </td>
                        <td className="py-1">{fmtDate(t.created_at)}</td>
                        <td className="py-1 text-slate-600">{t.notes ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}

          {stoneReturns.length > 0 && (
            <>
              <p className="mb-1 text-xs font-semibold">Stones returned</p>
              <table className="mb-3 w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-400 text-left">
                    <th className="py-1 font-semibold">#</th>
                    <th className="py-1 font-semibold">Tag</th>
                    <th className="py-1 text-right font-semibold">Carat</th>
                    <th className="py-1 font-semibold">Condition</th>
                    <th className="py-1 font-semibold">Returned on</th>
                  </tr>
                </thead>
                <tbody>
                  {stoneReturns.map((sr, i) => {
                    const stone = sr.stone_items as Record<string, unknown> | null
                    return (
                      <tr key={sr.id} className="border-b border-slate-200">
                        <td className="py-1">{i + 1}</td>
                        <td className="py-1 font-mono">
                          {String(stone?.inventory_tag ?? '—')}
                        </td>
                        <td className="py-1 text-right font-mono tabular">
                          {fmtCt(sr.carat_returned ?? stone?.carat)}
                        </td>
                        <td className="py-1">{sr.return_condition ?? '—'}</td>
                        <td className="py-1">{fmtDate(sr.received_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}

          {metalReturned.length === 0 && stoneReturns.length === 0 && (
            <>
              {jobIsComplete ? (
                <p className="my-3 text-xs text-emerald-700">
                  Job completed — all issued material is accounted for as finished
                  metal ({finishedFine.toFixed(3)} g), wastage ({wastageFine.toFixed(3)}{' '}
                  g), or mounted stones.
                </p>
              ) : jobIsCancelled ? (
                <p className="my-3 text-xs text-slate-600">
                  Job cancelled — return any issued material to the vault and record
                  below.
                </p>
              ) : (
                <p className="my-3 text-xs italic text-slate-500">
                  No material returned yet. Fill in manually on physical return.
                </p>
              )}
            </>
          )}

          <div className="mt-6 grid grid-cols-2 gap-12">
            <div>
              <div className="mt-10 h-10 border-b border-slate-800" />
              <p className="mt-1 text-[10px] text-slate-600">
                Returned by (craftsman signature)
              </p>
              <p className="text-[10px] text-slate-500">Date: ____________</p>
            </div>
            <div>
              <div className="mt-10 h-10 border-b border-slate-800" />
              <p className="mt-1 text-[10px] text-slate-600">
                Received by (office signature)
              </p>
              <p className="text-[10px] text-slate-500">Date: ____________</p>
            </div>
          </div>
        </div>

        {showPaymentSection && (
          <div className="border-t border-slate-300 py-4 avoid-break">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Costing &amp; payment
            </p>

            <div className="mb-3 grid grid-cols-2 gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div>
                <p className="text-[10px] uppercase text-slate-500">Metal value</p>
                <p className="font-semibold tabular">₹ {fmtMoney(metalValue)}</p>
                <p className="text-[10px] text-slate-500">
                  {netForCalc.toFixed(3)} g × ₹ {fmtMoney(weightedRatePerG)}/g
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Stones</p>
                <p className="font-semibold tabular">₹ {fmtMoney(stoneValue)}</p>
                <p className="text-[10px] text-slate-500">
                  {mountedStoneCount} mounted
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Making charge</p>
                <p className="font-semibold tabular">
                  ₹ {fmtMoney(makingChargeAmount ?? 0)}
                </p>
                {makingChargeRuleText && (
                  <p className="text-[10px] text-slate-500">
                    Rule: {makingChargeRuleText}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Total cost</p>
                <p className="font-semibold tabular text-brand-700">
                  ₹ {fmtMoney(totalCost)}
                </p>
              </div>
            </div>

            <div className="mb-3 grid grid-cols-4 gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <div>
                <p className="text-[10px] uppercase text-slate-500">Craftsman earns</p>
                <p className="font-semibold tabular">
                  ₹ {fmtMoney(makingChargeAmount ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">
                  Paid on this job
                </p>
                <p className="font-semibold tabular text-emerald-700">
                  ₹ {fmtMoney(paidAmount)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Balance</p>
                <p
                  className={`font-semibold tabular ${
                    paymentSettled ? 'text-slate-400' : 'text-amber-700'
                  }`}
                >
                  {paymentSettled ? '✓ settled' : `₹ ${fmtMoney(paymentBalance)}`}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Settlement</p>
                <p
                  className={`font-semibold ${
                    paymentSettled ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {paymentSettled ? 'Complete' : 'Pending'}
                </p>
              </div>
            </div>

            {payments.length > 0 && (
              <>
                <p className="mb-1 text-xs font-semibold">Payment history</p>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-400 text-left">
                      <th className="py-1 font-semibold">#</th>
                      <th className="py-1 font-semibold">Date</th>
                      <th className="py-1 font-semibold">Method</th>
                      <th className="py-1 font-semibold">Reference</th>
                      <th className="py-1 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any, i: number) => (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-200 ${
                          p.voided_at ? 'text-slate-400 line-through' : ''
                        }`}
                      >
                        <td className="py-1">{i + 1}</td>
                        <td className="py-1">{fmtDate(p.payment_date)}</td>
                        <td className="py-1 capitalize">
                          {String(p.payment_method ?? '').replace(/_/g, ' ')}
                        </td>
                        <td className="py-1 font-mono text-[10px]">
                          {p.reference ?? '—'}
                        </td>
                        <td className="py-1 text-right font-mono tabular">
                          ₹ {fmtMoney(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
          <div className="flex justify-between">
            <span>
              {company.gstin && <>GSTIN: {company.gstin} · </>}
              Printed {fmtDateTime(new Date().toISOString())}
              {profile?.full_name && <> by {profile.full_name}</>}
            </span>
            <span>
              {wipFine > 0
                ? `WIP with craftsman: ${wipFine.toFixed(3)} g`
                : `Job ${humanize(job.status)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}