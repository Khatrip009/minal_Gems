import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { FileText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'
}
const fmtG = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}
const fmtCt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

type Summary = {
  id: string
  code: string
  name: string
  phone: string | null
  skill_type: string | null
  is_inhouse: boolean
  is_active: boolean
  openingGoldFine: number
  openingLabourPayable: number
  metalIssuedFine: number
  metalReturnedFine: number
  metalFinishedFine: number
  metalHeldFine: number
  stonesIssuedCarat: number
  stonesReturnedCarat: number
  stonesMountedCarat: number
  stonesHeldCarat: number
  jobsOpen: number
  jobsCompleted: number
  jobsCancelled: number
  jobsTotal: number
  labourEarned: number
  labourPaid: number
  labourOwed: number
}

type Job = {
  id: string
  job_number: string
  job_type: string
  status: string
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  item_description: string | null
  expected_finished_weight_g: number
  finished_fine_g: number
  making_charge_amount: number
  craftsman_cost_amount: number
}

type MetalMovement = {
  kind: 'issue' | 'return'
  date: string
  job_number: string
  job_id: string
  lot_number: string
  purity_code: string
  gross_g: number
  fine_g: number
  settlement_fine_g: number | null
  notes: string | null
}

type StoneMovement = {
  kind: 'issue' | 'return'
  date: string
  job_number: string
  job_id: string
  inventory_tag: string
  carat: number
  condition: string | null
  notes: string | null
}

type Payment = {
  id: string
  payment_date: string
  payment_method: string
  reference: string | null
  amount: number
  job_number: string | null
  notes: string | null
}

export default async function CraftsmanLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ craftsman?: string }>
}) {
  const sp = await searchParams
  const selectedId = sp.craftsman ?? ''

  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [
    craftsmenRes,
    jobsRes,
    metalIssuesRes,
    metalReturnsRes,
    stoneIssuesRes,
    stoneReturnsRes,
    paymentsRes,
    lotsRes,
    puritiesRes,
  ] = await Promise.all([
    supabase.from('craftsmen').select('*').order('code'),
    supabase
      .from('craftsman_jobs')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('craftsman_job_metal_issues')
      .select('*')
      .order('issued_at', { ascending: false }),
    supabase
      .from('craftsman_job_metal_returns')
      .select('*')
      .order('received_at', { ascending: false }),
    supabase
      .from('craftsman_job_stone_issues')
      .select('*')
      .order('issued_at', { ascending: false }),
    supabase
      .from('craftsman_job_stone_returns')
      .select('*')
      .order('received_at', { ascending: false }),
    supabase
      .from('craftsman_job_payments')
      .select('*')
      .is('voided_at', null)
      .order('payment_date', { ascending: false }),
    supabase.from('metal_lots').select('id, lot_number, purity_id'),
    supabase.from('metal_purities').select('id, code, purity_percent'),
  ])

  if (craftsmenRes.error || jobsRes.error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        {craftsmenRes.error?.message ?? jobsRes.error?.message}
      </div>
    )
  }

  const craftsmen = craftsmenRes.data ?? []
  const jobs = jobsRes.data ?? []
  const metalIssues = metalIssuesRes.data ?? []
  const metalReturns = metalReturnsRes.data ?? []
  const stoneIssues = stoneIssuesRes.data ?? []
  const stoneReturns = stoneReturnsRes.data ?? []
  const payments = paymentsRes.data ?? []

  const lotMap = new Map((lotsRes.data ?? []).map((l: any) => [l.id, l]))
  const purityMap = new Map(
    (puritiesRes.data ?? []).map((p: any) => [p.id, p]),
  )
  const jobMap = new Map(jobs.map((j: any) => [j.id, j]))

  const summaries = new Map<string, Summary>()
  for (const c of craftsmen as any[]) {
    summaries.set(c.id, {
      id: c.id,
      code: c.code,
      name: c.name,
      phone: c.phone,
      skill_type: c.skill_type,
      is_inhouse: c.is_inhouse,
      is_active: c.is_active,
      openingGoldFine: Number(c.opening_gold_fine_g ?? 0),
      openingLabourPayable: Number(c.opening_labour_payable ?? 0),
      metalIssuedFine: 0,
      metalReturnedFine: 0,
      metalFinishedFine: 0,
      metalHeldFine: 0,
      stonesIssuedCarat: 0,
      stonesReturnedCarat: 0,
      stonesMountedCarat: 0,
      stonesHeldCarat: 0,
      jobsOpen: 0,
      jobsCompleted: 0,
      jobsCancelled: 0,
      jobsTotal: 0,
      labourEarned: 0,
      labourPaid: 0,
      labourOwed: 0,
    })
  }

  for (const j of jobs as any[]) {
    const s = summaries.get(j.craftsman_id)
    if (!s) continue
    s.jobsTotal++
    if (j.status === 'pending' || j.status === 'in_progress') s.jobsOpen++
    else if (j.status === 'completed' || j.status === 'delivered') {
      s.jobsCompleted++
      s.metalFinishedFine += Number(j.finished_fine_g ?? 0)
      s.labourEarned += Number(j.making_charge_amount ?? 0)
    } else if (j.status === 'cancelled') s.jobsCancelled++
  }

  for (const i of metalIssues as any[]) {
    const job = jobMap.get(i.job_id) as any
    if (!job) continue
    const s = summaries.get(job.craftsman_id)
    if (!s) continue
    s.metalIssuedFine += Number(i.fine_weight_g ?? 0)
  }

  for (const r of metalReturns as any[]) {
    const job = jobMap.get(r.job_id) as any
    if (!job) continue
    const s = summaries.get(job.craftsman_id)
    if (!s) continue
    s.metalReturnedFine += Number(r.actual_fine_weight_g ?? 0)
  }

  for (const i of stoneIssues as any[]) {
    const job = jobMap.get(i.job_id) as any
    if (!job) continue
    const s = summaries.get(job.craftsman_id)
    if (!s) continue
    s.stonesIssuedCarat += Number(i.carat ?? 0)
  }
  for (const r of stoneReturns as any[]) {
    const job = jobMap.get(r.job_id) as any
    if (!job) continue
    const s = summaries.get(job.craftsman_id)
    if (!s) continue
    s.stonesReturnedCarat += Number(r.carat_returned ?? 0)
  }

  for (const j of jobs as any[]) {
    if (j.status !== 'completed' && j.status !== 'delivered') continue
    const s = summaries.get(j.craftsman_id)
    if (!s) continue
    const iC = stoneIssues
      .filter((i: any) => i.job_id === j.id)
      .reduce((sum, i: any) => sum + Number(i.carat ?? 0), 0)
    const rC = stoneReturns
      .filter((r: any) => r.job_id === j.id)
      .reduce((sum, r: any) => sum + Number(r.carat_returned ?? 0), 0)
    s.stonesMountedCarat += iC - rC
  }

  for (const p of payments as any[]) {
    const s = summaries.get(p.craftsman_id)
    if (!s) continue
    s.labourPaid += Number(p.amount ?? 0)
  }

  for (const s of summaries.values()) {
    s.metalHeldFine =
      s.openingGoldFine +
      s.metalIssuedFine -
      s.metalReturnedFine -
      s.metalFinishedFine
    s.stonesHeldCarat =
      s.stonesIssuedCarat - s.stonesReturnedCarat - s.stonesMountedCarat
    s.labourOwed = s.openingLabourPayable + s.labourEarned - s.labourPaid
  }

  const summaryList = Array.from(summaries.values())
    .filter(
      (s) =>
        s.jobsTotal > 0 ||
        Math.abs(s.metalHeldFine) > 0.005 ||
        Math.abs(s.labourOwed) > 0.01,
    )
    .sort((a, b) => b.metalHeldFine - a.metalHeldFine)

  const selected = selectedId ? summaries.get(selectedId) : null

  let detailJobs: Job[] = []
  let detailMetal: MetalMovement[] = []
  let detailStone: StoneMovement[] = []
  let detailPayments: Payment[] = []

  if (selected) {
    detailJobs = (jobs as any[])
      .filter((j) => j.craftsman_id === selected.id)
      .map((j) => ({
        id: j.id,
        job_number: j.job_number,
        job_type: j.job_type,
        status: j.status,
        start_date: j.start_date,
        due_date: j.due_date,
        completed_at: j.completed_at,
        item_description: j.item_description,
        expected_finished_weight_g: Number(j.expected_finished_weight_g ?? 0),
        finished_fine_g: Number(j.finished_fine_g ?? 0),
        making_charge_amount: Number(j.making_charge_amount ?? 0),
        craftsman_cost_amount: Number(j.craftsman_cost_amount ?? 0),
      }))

    detailMetal = [
      ...(metalIssues as any[])
        .filter((i) => jobMap.get(i.job_id)?.craftsman_id === selected.id)
        .map((i) => {
          const job = jobMap.get(i.job_id) as any
          const lot = lotMap.get(i.metal_lot_id) as any
          const purity = lot ? purityMap.get(lot.purity_id) : null
          return {
            kind: 'issue' as const,
            date: i.issued_at,
            job_number: job?.job_number ?? '—',
            job_id: i.job_id,
            lot_number: lot?.lot_number ?? '—',
            purity_code: purity?.code ?? '—',
            gross_g: Number(i.gross_weight_g ?? 0),
            fine_g: Number(i.fine_weight_g ?? 0),
            settlement_fine_g: null,
            notes: i.notes,
          }
        }),
      ...(metalReturns as any[])
        .filter((r) => jobMap.get(r.job_id)?.craftsman_id === selected.id)
        .map((r) => {
          const job = jobMap.get(r.job_id) as any
          const lot = lotMap.get(r.metal_lot_id) as any
          const purity = lot ? purityMap.get(lot.purity_id) : null
          return {
            kind: 'return' as const,
            date: r.received_at,
            job_number: job?.job_number ?? '—',
            job_id: r.job_id,
            lot_number: lot?.lot_number ?? '—',
            purity_code: purity?.code ?? '—',
            gross_g: Number(r.gross_weight_g ?? 0),
            fine_g: Number(r.actual_fine_weight_g ?? 0),
            settlement_fine_g: Number(r.settlement_fine_weight_g ?? 0),
            notes: r.notes,
          }
        }),
    ].sort((a, b) => b.date.localeCompare(a.date))

    detailStone = [
      ...(stoneIssues as any[])
        .filter((i) => jobMap.get(i.job_id)?.craftsman_id === selected.id)
        .map((i) => {
          const job = jobMap.get(i.job_id) as any
          return {
            kind: 'issue' as const,
            date: i.issued_at,
            job_number: job?.job_number ?? '—',
            job_id: i.job_id,
            inventory_tag: i.stone_item_id
              ? String(i.stone_item_id).slice(0, 8)
              : '—',
            carat: Number(i.carat ?? 0),
            condition: null,
            notes: i.notes,
          }
        }),
      ...(stoneReturns as any[])
        .filter((r) => jobMap.get(r.job_id)?.craftsman_id === selected.id)
        .map((r) => {
          const job = jobMap.get(r.job_id) as any
          return {
            kind: 'return' as const,
            date: r.received_at,
            job_number: job?.job_number ?? '—',
            job_id: r.job_id,
            inventory_tag: r.stone_item_id
              ? String(r.stone_item_id).slice(0, 8)
              : '—',
            carat: Number(r.carat_returned ?? 0),
            condition: r.return_condition,
            notes: r.notes,
          }
        }),
    ].sort((a, b) => b.date.localeCompare(a.date))

    detailPayments = (payments as any[])
      .filter((p) => p.craftsman_id === selected.id)
      .map((p) => {
        const job = p.job_id ? jobMap.get(p.job_id) : null
        return {
          id: p.id,
          payment_date: p.payment_date,
          payment_method: p.payment_method,
          reference: p.reference,
          amount: Number(p.amount ?? 0),
          job_number: (job as any)?.job_number ?? null,
          notes: p.notes,
        }
      })
  }

  const totalGoldHeld = summaryList.reduce((s, c) => s + c.metalHeldFine, 0)
  const totalLabourOwed = summaryList.reduce((s, c) => s + c.labourOwed, 0)
  const totalOpenJobs = summaryList.reduce((s, c) => s + c.jobsOpen, 0)
  const activeCraftsmen = summaryList.filter((c) => c.jobsOpen > 0).length

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          ← Reports
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {selected ? `Ledger · ${selected.name}` : 'Craftsman Ledger'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {selected ? (
                <>
                  <Link
                    href="/reports/craftsman-ledger"
                    className="text-brand-700 hover:underline"
                  >
                    ← All craftsmen
                  </Link>{' '}
                  · Code <span className="font-mono">{selected.code}</span>
                  {selected.phone && <> · {selected.phone}</>}
                  {selected.skill_type && <> · {selected.skill_type}</>}
                  {selected.is_inhouse ? ' · In-house' : ' · Outsource'}
                </>
              ) : (
                'Gold held, stones on hand, and labour balance per karigar — derived from the issue/return event log, not cached columns'
              )}
            </p>
          </div>
          {selected && (
            <a
              href={`/reports/print/craftsman-ledger/${selected.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              <FileText className="h-3.5 w-3.5" /> Print statement
            </a>
          )}
        </div>
      </div>

      {!selected && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="Total gold held"
              value={totalGoldHeld}
              unit="g"
              sub={`${activeCraftsmen} active · ${summaryList.length} total`}
              tone={totalGoldHeld > 0 ? 'amber' : 'slate'}
            />
            <Kpi
              label="Total labour owed"
              value={totalLabourOwed}
              unit="₹"
              sub="Sum of unpaid balance across all karigars"
              tone={totalLabourOwed > 0 ? 'rose' : 'emerald'}
            />
            <Kpi
              label="Open jobs"
              value={totalOpenJobs}
              unit=""
              sub="Pending + in progress"
              tone="sky"
            />
            <Kpi
              label="Craftsmen"
              value={summaryList.length}
              unit=""
              sub={`${summaryList.filter((c) => c.is_inhouse).length} in-house`}
              tone="slate"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Code
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Skill
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Open / total jobs
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Gold held
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Stones held
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Labour owed
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Earned
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Paid
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaryList.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No craftsmen with activity yet.
                    </td>
                  </tr>
                )}
                {summaryList.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link
                        href={`/reports/craftsman-ledger?craftsman=${c.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {c.code}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {c.phone && (
                        <p className="text-[10px] text-slate-500">{c.phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {c.skill_type ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular">
                      {c.jobsOpen} / {c.jobsTotal}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono tabular ${
                        c.metalHeldFine > 0.001
                          ? 'text-amber-700 font-semibold'
                          : c.metalHeldFine < -0.001
                            ? 'text-rose-700 font-semibold'
                            : 'text-slate-500'
                      }`}
                    >
                      {c.metalHeldFine.toFixed(3)} g
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono tabular ${
                        c.stonesHeldCarat > 0.001
                          ? 'text-amber-700 font-semibold'
                          : 'text-slate-500'
                      }`}
                    >
                      {c.stonesHeldCarat.toFixed(3)} ct
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono tabular ${
                        c.labourOwed > 0.01
                          ? 'text-rose-700 font-semibold'
                          : c.labourOwed < -0.01
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                      }`}
                    >
                      {c.labourOwed < -0.01 ? '− ' : ''}₹{' '}
                      {fmtMoney(Math.abs(c.labourOwed))}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular text-slate-600">
                      ₹ {fmtMoney(c.labourEarned)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular text-slate-600">
                      ₹ {fmtMoney(c.labourPaid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-500">
            <strong>Gold held</strong> = opening + issued − returned (physical
            fine) − finished.
            <strong className="ml-2">Stones held</strong> = issued − returned −
            mounted.
            <strong className="ml-2">Labour owed</strong> = opening + earned
            (making charge on completed jobs) − paid. Click a code to see the
            full ledger.
          </p>
        </>
      )}

      {selected && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              label="Gold held"
              value={selected.metalHeldFine}
              unit="g"
              sub={`Opening ${selected.openingGoldFine.toFixed(3)} + ${selected.metalIssuedFine.toFixed(3)} issued − ${selected.metalReturnedFine.toFixed(3)} returned − ${selected.metalFinishedFine.toFixed(3)} finished`}
              tone={selected.metalHeldFine > 0.001 ? 'amber' : 'slate'}
            />
            <Kpi
              label="Stones held"
              value={selected.stonesHeldCarat}
              unit="ct"
              sub={`${selected.stonesIssuedCarat.toFixed(3)} issued − ${selected.stonesReturnedCarat.toFixed(3)} returned − ${selected.stonesMountedCarat.toFixed(3)} mounted`}
              tone={selected.stonesHeldCarat > 0.001 ? 'amber' : 'slate'}
            />
            <Kpi
              label="Labour owed"
              value={selected.labourOwed}
              unit="₹"
              sub={`Opening ₹${fmtMoney(selected.openingLabourPayable)} + earned ₹${fmtMoney(selected.labourEarned)} − paid ₹${fmtMoney(selected.labourPaid)}`}
              tone={selected.labourOwed > 0.01 ? 'rose' : 'emerald'}
            />
            <Kpi
              label="Jobs"
              value={selected.jobsTotal}
              unit=""
              sub={`${selected.jobsOpen} open · ${selected.jobsCompleted} done · ${selected.jobsCancelled} cancelled`}
              tone="sky"
            />
          </div>

          <Section title={`Jobs (${detailJobs.length})`}>
            {detailJobs.length === 0 ? (
              <p className="p-4 text-sm italic text-slate-500">No jobs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Job
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Item
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Due
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">
                      Target
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">
                      Finished
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">
                      Making ₹
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailJobs.map((j) => (
                    <tr
                      key={j.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2 font-mono text-xs">
                        <Link
                          href={`/jobs/${j.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {j.job_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {humanize(j.job_type)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700">
                          {humanize(j.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-700">
                        {j.item_description ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {fmtDate(j.due_date)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular text-xs">
                        {j.expected_finished_weight_g.toFixed(3)} g
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular text-xs">
                        {j.finished_fine_g > 0
                          ? `${j.finished_fine_g.toFixed(3)} g`
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular text-xs">
                        ₹ {fmtMoney(j.making_charge_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title={`Metal movements (${detailMetal.length})`}>
            {detailMetal.length === 0 ? (
              <p className="p-4 text-sm italic text-slate-500">
                No metal issued or returned.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Job
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Lot
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Purity
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">
                      Gross
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">
                      Fine
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailMetal.map((m, i) => (
                    <tr
                      key={`${m.kind}-${i}`}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {fmtDate(m.date)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                            m.kind === 'issue'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {m.kind === 'issue' ? 'Issued' : 'Returned'}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        <Link
                          href={`/jobs/${m.job_id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {m.job_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {m.lot_number}
                      </td>
                      <td className="px-4 py-2 text-xs">{m.purity_code}</td>
                      <td className="px-4 py-2 text-right font-mono tabular">
                        {m.gross_g.toFixed(3)} g
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-mono tabular ${
                          m.kind === 'issue'
                            ? 'text-rose-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {m.kind === 'issue' ? '−' : '+'}
                        {m.fine_g.toFixed(3)} g
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {m.notes ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title={`Stone movements (${detailStone.length})`}>
            {detailStone.length === 0 ? (
              <p className="p-4 text-sm italic text-slate-500">
                No stones issued or returned.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Job
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Tag
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">
                      Carat
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Condition
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailStone.map((m, i) => (
                    <tr
                      key={`${m.kind}-${i}`}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {fmtDate(m.date)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                            m.kind === 'issue'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {m.kind === 'issue' ? 'Issued' : 'Returned'}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        <Link
                          href={`/jobs/${m.job_id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {m.job_number}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {m.inventory_tag}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular">
                        {m.carat.toFixed(3)} ct
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {m.condition ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {m.notes ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title={`Payments (${detailPayments.length})`}>
            {detailPayments.length === 0 ? (
              <p className="p-4 text-sm italic text-slate-500">
                No payments recorded yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Job
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Method
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Reference
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-600">
                      Amount
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-600">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {fmtDate(p.payment_date)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {p.job_number ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs capitalize">
                        {p.payment_method?.replace(/_/g, ' ') ?? '—'}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">
                        {p.reference ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold tabular">
                        ₹ {fmtMoney(p.amount)}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {p.notes ?? '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <td
                      colSpan={4}
                      className="px-4 py-2 text-right text-xs uppercase text-slate-500"
                    >
                      Total paid
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular">
                      ₹ {fmtMoney(selected.labourPaid)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function Kpi({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string
  value: number
  unit: string
  sub?: string
  tone: 'amber' | 'rose' | 'emerald' | 'slate' | 'sky'
}) {
  const cls: Record<typeof tone, string> = {
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    emerald: 'text-emerald-700',
    slate: 'text-slate-700',
    sky: 'text-sky-700',
  }
  const display =
    unit === '₹'
      ? `₹ ${fmtMoney(Math.abs(value))}`
      : unit === 'g'
        ? `${value.toFixed(3)} g`
        : unit === 'ct'
          ? `${value.toFixed(3)} ct`
          : value.toString()
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular ${cls[tone]}`}>
        {value < 0 && unit === '₹' ? '− ' : ''}
        {display}
      </p>
      {sub && (
        <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{sub}</p>
      )}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
          {title}
        </p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}