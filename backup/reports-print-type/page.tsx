import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { requireRole } from '@/lib/guard'
import { PrintButton } from './print-button'

export const dynamic = 'force-dynamic'

const COMPANY = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Minal Gems',
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS ?? '',
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE ?? '',
  gstin: process.env.NEXT_PUBLIC_COMPANY_GSTIN ?? '',
}

const REPORT_META: Record<
  string,
  { title: string; description: string }
> = {
  settlement: {
    title: 'Craftsman Settlement Report',
    description:
      'Earnings, payments and gold movement per craftsman for the selected period.',
  },
  gold: {
    title: 'Gold Flow Report',
    description:
      'Opening balance, in/out movements and current balance per metal lot.',
  },
  stone: {
    title: 'Stone Flow Report',
    description:
      'Current state of every stone in inventory grouped by status.',
  },
  profitability: {
    title: 'Job Profitability Report',
    description:
      'Cost breakdown for every completed job — metal, stones, labour and floor value.',
  },
  payments: {
    title: 'Payments Ledger',
    description:
      'Every craftsman payment entry in the selected period. Voided rows shown for audit but excluded from totals.',
  },
}

// ── Helpers ──
const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
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
const fmtDateTime = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
const inRange = (d: string | null | undefined, from: string, to: string): boolean => {
  if (!d) return false
  const dateStr = d.slice(0, 10)
  if (from && dateStr < from) return false
  if (to && dateStr > to) return false
  return true
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { type } = await params
  const { from = '', to = '' } = await searchParams
  const meta = REPORT_META[type]
  const rangeLabel =
    from || to ? ` — ${from || 'start'} to ${to || 'today'}` : ''
  return {
    title: `${meta?.title ?? 'Report'}${rangeLabel}`,
  }
}

export default async function ReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { type } = await params
  const { from = '', to = '' } = await searchParams
  const meta = REPORT_META[type]
  if (!meta) notFound()

  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [
    { data: craftsmen },
    { data: jobs },
    { data: payments },
    { data: metalLots },
    { data: metalTxns },
    { data: stoneIssues },
    { data: stoneReturns },
    { data: stoneItems },
    { data: inventory },
    { data: designs },
    profileResult,
  ] = await Promise.all([
    supabase.from('craftsmen').select('id, code, name, is_active, skill_type'),
    supabase
      .from('craftsman_jobs')
      .select(
        'id, job_number, craftsman_id, design_id, status, issued_fine_g, returned_fine_g, finished_fine_g, wastage_fine_g, making_charge_amount, completed_at, created_at, due_date',
      ),
    supabase
      .from('craftsman_job_payments')
      .select(
        'id, craftsman_id, job_id, amount, payment_date, payment_method, reference, notes, voided_at, void_reason, created_at',
      )
      .order('payment_date', { ascending: false }),
    supabase
      .from('v_metal_lot_balances')
      .select(
        'metal_lot_id, lot_number, purity_code, purity_percent, opening_fine_weight_g, txn_fine_g, balance_fine_g, rate_per_gram, location_id',
      ),
    supabase
      .from('metal_transactions')
      .select(
        'id, metal_lot_id, txn_type, fine_weight_change_g, reference_type, reference_id, notes, created_at',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('craftsman_job_stone_issues')
      .select(
        'id, job_id, stone_item_id, issued_at, stone_items(inventory_tag, carat, shape, color, clarity, cut, cost_price, status)',
      ),
    supabase
      .from('craftsman_job_stone_returns')
      .select(
        'id, job_id, stone_item_id, return_condition, carat_returned, received_at',
      ),
    supabase
      .from('stone_items')
      .select(
        'id, inventory_tag, carat, status, shape, color, clarity, cut, cost_price, stone_master_id, stone_lot_id, location_id',
      ),
    supabase
      .from('inventory_items')
      .select(
        'id, inventory_tag, craftsman_job_id, net_fine_weight_g, cost_price, making_charge_amount, floor_price, status, sold_at, created_at',
      ),
    supabase.from('product_designs').select('id, name, design_code'),
    user
      ? supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const profile = profileResult.data
  const craftsmanMap = Object.fromEntries(
    (craftsmen ?? []).map((c) => [c.id, c]),
  )
  const designMap = Object.fromEntries((designs ?? []).map((d) => [d.id, d]))
  const jobMap = Object.fromEntries((jobs ?? []).map((j) => [j.id, j]))

  const rangeLabel =
    from || to
      ? `${from ? fmtDate(from) : 'Start'} → ${to ? fmtDate(to) : 'Today'}`
      : 'All time'

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* Screen-only bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 print:hidden">
        <Link
          href="/reports"
          className="text-sm text-slate-600 hover:underline"
        >
          ← Back to reports
        </Link>
        <PrintButton />
      </div>

      {/* A4 card */}
      <div className="mx-auto my-6 max-w-[210mm] bg-white p-8 text-[11px] text-slate-900 shadow-lg print:my-0 print:p-0 print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 avoid-break">
          <div className="flex items-center gap-4">
            <Image
              src="/logo_minalgems.png"
              alt={COMPANY.name}
              width={56}
              height={56}
              className="rounded"
              priority
            />
            <div>
              <p className="text-lg font-bold leading-tight">{COMPANY.name}</p>
              <p className="text-[10px] text-slate-600">
                Jewellery Manufacturing
              </p>
              {COMPANY.address && (
                <p className="text-[9px] text-slate-500">{COMPANY.address}</p>
              )}
              {COMPANY.phone && (
                <p className="text-[9px] text-slate-500">{COMPANY.phone}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-bold uppercase tracking-widest text-slate-800">
              {meta.title}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-600">{rangeLabel}</p>
            <p className="mt-1 text-[9px] text-slate-500">
              Generated {fmtDateTime(new Date().toISOString())}
              {profile?.full_name && <> by {profile.full_name}</>}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="border-b border-slate-300 py-2 text-[10px] italic text-slate-600">
          {meta.description}
        </p>

        {/* Report body */}
        <div className="pt-4">
          {type === 'settlement' && (
            <SettlementPrint
              craftsmen={craftsmen ?? []}
              jobs={jobs ?? []}
              payments={payments ?? []}
              craftsmanMap={craftsmanMap}
              from={from}
              to={to}
            />
          )}
          {type === 'gold' && (
            <GoldPrint
              metalLots={metalLots ?? []}
              metalTxns={metalTxns ?? []}
              from={from}
              to={to}
            />
          )}
          {type === 'stone' && (
            <StonePrint
              stoneIssues={stoneIssues ?? []}
              stoneReturns={stoneReturns ?? []}
              stoneItems={stoneItems ?? []}
              from={from}
              to={to}
            />
          )}
          {type === 'profitability' && (
            <ProfitabilityPrint
                jobs={jobs ?? []}
                inventory={inventory ?? []}
                designMap={designMap}
                craftsmanMap={craftsmanMap}
                metalTxns={metalTxns ?? []}
                metalLots={metalLots ?? []}
                stoneIssues={stoneIssues ?? []}
                stoneItems={stoneItems ?? []}
                from={from}
                to={to}
            />
            )}
          {type === 'payments' && (
            <PaymentsPrint
              payments={payments ?? []}
              craftsmanMap={craftsmanMap}
              jobs={jobs ?? []}
              jobMap={jobMap}
              from={from}
              to={to}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-slate-300 pt-2 text-[9px] text-slate-500">
          <div className="flex justify-between">
            <span>
              {COMPANY.gstin && <>GSTIN: {COMPANY.gstin} · </>}
              {COMPANY.name} · {meta.title}
            </span>
            <span>
              System-generated · {fmtDateTime(new Date().toISOString())}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Print table atoms
// ═══════════════════════════════════════════════════════
function PrintSummary({
  items,
}: {
  items: Array<{
    label: string
    value: string
    hint?: string
    accent?: 'slate' | 'brand' | 'emerald' | 'amber' | 'rose'
  }>
}) {
  const accentMap = {
    slate: 'text-slate-900',
    brand: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  }
  const cols = items.length
  const gridCols =
    cols === 3
      ? 'grid-cols-3'
      : cols === 4
        ? 'grid-cols-4'
        : cols === 5
          ? 'grid-cols-5'
          : 'grid-cols-4'
  return (
    <div
      className={`mb-4 grid ${gridCols} gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 avoid-break`}
    >
      {items.map((it) => (
        <div key={it.label}>
          <p className="text-[8px] font-medium uppercase tracking-wide text-slate-500">
            {it.label}
          </p>
          <p
            className={`mt-0.5 text-sm font-semibold tabular ${accentMap[it.accent ?? 'slate']}`}
          >
            {it.value}
          </p>
          {it.hint && (
            <p className="text-[8px] text-slate-500">{it.hint}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`border-b border-slate-400 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}
function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td
      className={`border-b border-slate-200 px-1.5 py-1 ${
        align === 'right' ? 'text-right tabular' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  )
}

// ═══════════════════════════════════════════════════════
// 1. Settlement print
// ═══════════════════════════════════════════════════════
function SettlementPrint({
  craftsmen,
  jobs,
  payments,
  craftsmanMap,
  from,
  to,
}: {
  craftsmen: any[]
  jobs: any[]
  payments: any[]
  craftsmanMap: Record<string, any>
  from: string
  to: string
}) {
  const completedJobs = jobs.filter(
    (j) =>
      (j.status === 'completed' || j.status === 'delivered') &&
      inRange(j.completed_at, from, to),
  )
  const validPayments = payments.filter(
    (p) => !p.voided_at && inRange(p.payment_date, from, to),
  )

  const byCraftsman = new Map<
    string,
    {
      jobCount: number
      issuedG: number
      returnedG: number
      finishedG: number
      wastageG: number
      earned: number
      paid: number
    }
  >()

  for (const j of completedJobs) {
    const cur = byCraftsman.get(j.craftsman_id) ?? {
      jobCount: 0,
      issuedG: 0,
      returnedG: 0,
      finishedG: 0,
      wastageG: 0,
      earned: 0,
      paid: 0,
    }
    cur.jobCount += 1
    cur.issuedG += Number(j.issued_fine_g) || 0
    cur.returnedG += Number(j.returned_fine_g) || 0
    cur.finishedG += Number(j.finished_fine_g) || 0
    cur.wastageG += Number(j.wastage_fine_g) || 0
    cur.earned += Number(j.making_charge_amount) || 0
    byCraftsman.set(j.craftsman_id, cur)
  }
  for (const p of validPayments) {
    const cur = byCraftsman.get(p.craftsman_id)
    if (cur) cur.paid += Number(p.amount) || 0
  }

  const rows = Array.from(byCraftsman.entries())
    .map(([cid, m]) => {
      const c = craftsmanMap[cid]
      const wastagePct = m.issuedG > 0 ? (m.wastageG / m.issuedG) * 100 : 0
      return {
        code: c?.code ?? '—',
        name: c?.name ?? '—',
        jobCount: m.jobCount,
        issuedG: m.issuedG,
        returnedG: m.returnedG,
        finishedG: m.finishedG,
        wastageG: m.wastageG,
        wastagePct,
        earned: m.earned,
        paid: m.paid,
        balance: m.earned - m.paid,
      }
    })
    .sort((a, b) => b.balance - a.balance)

  const totals = rows.reduce(
    (a, r) => ({
      jobCount: a.jobCount + r.jobCount,
      issuedG: a.issuedG + r.issuedG,
      returnedG: a.returnedG + r.returnedG,
      finishedG: a.finishedG + r.finishedG,
      wastageG: a.wastageG + r.wastageG,
      earned: a.earned + r.earned,
      paid: a.paid + r.paid,
      balance: a.balance + r.balance,
    }),
    {
      jobCount: 0,
      issuedG: 0,
      returnedG: 0,
      finishedG: 0,
      wastageG: 0,
      earned: 0,
      paid: 0,
      balance: 0,
    },
  )

  return (
    <div>
      <PrintSummary
        items={[
          { label: 'Craftsmen', value: String(rows.length) },
          { label: 'Jobs', value: String(totals.jobCount) },
          { label: 'Issued', value: `${fmtG(totals.issuedG)} g` },
          {
            label: 'Wastage',
            value: `${fmtG(totals.wastageG)} g`,
            hint:
              totals.issuedG > 0
                ? `${((totals.wastageG / totals.issuedG) * 100).toFixed(1)}%`
                : undefined,
            accent: 'rose',
          },
          {
            label: 'Outstanding',
            value: `₹ ${fmtMoney(totals.balance)}`,
            hint: `Earned ₹${fmtMoney(totals.earned)} · Paid ₹${fmtMoney(totals.paid)}`,
            accent: totals.balance > 0.01 ? 'amber' : 'emerald',
          },
        ]}
      />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-slate-500 italic">
          No completed jobs in this range.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>Craftsman</Th>
              <Th align="right">Jobs</Th>
              <Th align="right">Issued g</Th>
              <Th align="right">Returned g</Th>
              <Th align="right">Finished g</Th>
              <Th align="right">Wastage g</Th>
              <Th align="right">Wastage %</Th>
              <Th align="right">Earned</Th>
              <Th align="right">Paid</Th>
              <Th align="right">Balance</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <Td>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-1 font-mono text-[9px] text-slate-500">
                    {r.code}
                  </span>
                </Td>
                <Td align="right">{r.jobCount}</Td>
                <Td align="right">{fmtG(r.issuedG)}</Td>
                <Td align="right">{fmtG(r.returnedG)}</Td>
                <Td align="right" className="font-medium">
                  {fmtG(r.finishedG)}
                </Td>
                <Td align="right" className="text-rose-700">
                  {fmtG(r.wastageG)}
                </Td>
                <Td
                  align="right"
                  className={
                    r.wastagePct > 10
                      ? 'font-semibold text-rose-700'
                      : r.wastagePct > 6
                        ? 'text-amber-700'
                        : ''
                  }
                >
                  {r.wastagePct.toFixed(1)}%
                </Td>
                <Td align="right">₹ {fmtMoney(r.earned)}</Td>
                <Td align="right" className="text-emerald-700">
                  ₹ {fmtMoney(r.paid)}
                </Td>
                <Td
                  align="right"
                  className={
                    r.balance > 0.01
                      ? 'font-semibold text-amber-700'
                      : 'text-slate-400'
                  }
                >
                  {r.balance > 0.01 ? `₹ ${fmtMoney(r.balance)}` : '✓'}
                </Td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-700 bg-slate-100 font-semibold">
              <Td>Total</Td>
              <Td align="right">{totals.jobCount}</Td>
              <Td align="right">{fmtG(totals.issuedG)}</Td>
              <Td align="right">{fmtG(totals.returnedG)}</Td>
              <Td align="right">{fmtG(totals.finishedG)}</Td>
              <Td align="right" className="text-rose-700">
                {fmtG(totals.wastageG)}
              </Td>
              <Td align="right">
                {totals.issuedG > 0
                  ? `${((totals.wastageG / totals.issuedG) * 100).toFixed(1)}%`
                  : '—'}
              </Td>
              <Td align="right">₹ {fmtMoney(totals.earned)}</Td>
              <Td align="right" className="text-emerald-700">
                ₹ {fmtMoney(totals.paid)}
              </Td>
              <Td align="right" className="text-slate-900">
                ₹ {fmtMoney(totals.balance)}
              </Td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 2. Gold Flow print
// ═══════════════════════════════════════════════════════
function GoldPrint({
  metalLots,
  metalTxns,
  from,
  to,
}: {
  metalLots: any[]
  metalTxns: any[]
  from: string
  to: string
}) {
  const filtered = metalTxns.filter((t) => inRange(t.created_at, from, to))

  const rows = metalLots.map((lot) => {
    const lotTxns = filtered.filter((t) => t.metal_lot_id === lot.metal_lot_id)
    const ins = lotTxns
      .filter((t) => Number(t.fine_weight_change_g) > 0)
      .reduce((a, t) => a + Number(t.fine_weight_change_g), 0)
    const outs = lotTxns
      .filter((t) => Number(t.fine_weight_change_g) < 0)
      .reduce((a, t) => a + Number(t.fine_weight_change_g), 0)
    return {
      lot_number: lot.lot_number,
      purity_code: lot.purity_code ?? '—',
      opening: Number(lot.opening_fine_weight_g) || 0,
      in: ins,
      out: outs,
      balance: Number(lot.balance_fine_g) || 0,
      rate: Number(lot.rate_per_gram) || 0,
      txn_count: lotTxns.length,
    }
  })

  const totals = rows.reduce(
    (a, r) => ({
      opening: a.opening + r.opening,
      in: a.in + r.in,
      out: a.out + r.out,
      balance: a.balance + r.balance,
    }),
    { opening: 0, in: 0, out: 0, balance: 0 },
  )

  return (
    <div>
      <PrintSummary
        items={[
          { label: 'Lots', value: String(rows.length) },
          { label: 'Opening total', value: `${fmtG(totals.opening)} g` },
          {
            label: 'Net in',
            value: `+${fmtG(totals.in)} g`,
            accent: 'emerald',
          },
          {
            label: 'Net out',
            value: `${fmtG(totals.out)} g`,
            accent: 'rose',
          },
        ]}
      />
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th>Lot</Th>
            <Th>Purity</Th>
            <Th align="right">Opening g</Th>
            <Th align="right">In g</Th>
            <Th align="right">Out g</Th>
            <Th align="right">Balance g</Th>
            <Th align="right">Rate/g</Th>
            <Th align="right">Movements</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.lot_number}>
              <Td className="font-mono text-[10px]">{r.lot_number}</Td>
              <Td>{r.purity_code}</Td>
              <Td align="right">{fmtG(r.opening)}</Td>
              <Td align="right" className="text-emerald-700">
                {r.in > 0 ? `+${fmtG(r.in)}` : '—'}
              </Td>
              <Td align="right" className="text-rose-700">
                {r.out < 0 ? fmtG(r.out) : '—'}
              </Td>
              <Td align="right" className="font-medium">
                {fmtG(r.balance)}
              </Td>
              <Td align="right">₹ {fmtMoney(r.rate)}</Td>
              <Td align="right" className="text-slate-500">
                {r.txn_count}
              </Td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-700 bg-slate-100 font-semibold">
            <Td>Total</Td>
            <Td></Td>
            <Td align="right">{fmtG(totals.opening)}</Td>
            <Td align="right" className="text-emerald-700">
              +{fmtG(totals.in)}
            </Td>
            <Td align="right" className="text-rose-700">
              {fmtG(totals.out)}
            </Td>
            <Td align="right">{fmtG(totals.balance)}</Td>
            <Td></Td>
            <Td></Td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 3. Stone Flow print
// ═══════════════════════════════════════════════════════
function StonePrint({
  stoneIssues,
  stoneReturns,
  stoneItems,
  from,
  to,
}: {
  stoneIssues: any[]
  stoneReturns: any[]
  stoneItems: any[]
  from: string
  to: string
}) {
  const issuesInRange = stoneIssues.filter((si) => inRange(si.issued_at, from, to))
  const returnsInRange = stoneReturns.filter((sr) =>
    inRange(sr.received_at, from, to),
  )

  const statusGroups = new Map<string, { pcs: number; ct: number; cost: number }>()
  for (const s of stoneItems) {
    const cur = statusGroups.get(s.status) ?? { pcs: 0, ct: 0, cost: 0 }
    cur.pcs += 1
    cur.ct += Number(s.carat) || 0
    cur.cost += Number(s.cost_price) || 0
    statusGroups.set(s.status, cur)
  }
  const rows = Array.from(statusGroups.entries()).sort(
    (a, b) => b[1].pcs - a[1].pcs,
  )

  const issuedCt = issuesInRange.reduce(
    (a, si) => a + Number(si.stone_items?.carat ?? 0),
    0,
  )
  const returnedCt = returnsInRange.reduce(
    (a, sr) => a + Number(sr.carat_returned ?? 0),
    0,
  )

  return (
    <div>
      <PrintSummary
        items={[
          { label: 'Total stones', value: String(stoneItems.length) },
          {
            label: 'Issued in range',
            value: `${issuesInRange.length} pcs`,
            hint: `${fmtCt(issuedCt)} ct`,
          },
          {
            label: 'Returned in range',
            value: `${returnsInRange.length} pcs`,
            hint: `${fmtCt(returnedCt)} ct`,
            accent: 'emerald',
          },
          {
            label: 'Outstanding',
            value: String(
              stoneItems.filter((s) => s.status === 'issued_to_job').length,
            ),
            hint: 'issued, not returned',
            accent: 'amber',
          },
        ]}
      />
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Th>Status</Th>
            <Th align="right">Pieces</Th>
            <Th align="right">Carats</Th>
            <Th align="right">Cost</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([status, s]) => (
            <tr key={status}>
              <Td className="capitalize">{status.replace(/_/g, ' ')}</Td>
              <Td align="right">{s.pcs}</Td>
              <Td align="right">{fmtCt(s.ct)}</Td>
              <Td align="right">₹ {fmtMoney(s.cost)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 4. Profitability print
// ═══════════════════════════════════════════════════════
function ProfitabilityPrint({
  jobs,
  inventory,
  designMap,
  craftsmanMap,
  metalTxns,
  metalLots,
  stoneIssues,
  stoneItems,
  from,
  to,
}: {
  jobs: any[]
  inventory: any[]
  designMap: Record<string, any>
  craftsmanMap: Record<string, any>
  metalTxns: any[]
  metalLots: any[]
  stoneIssues: any[]
  stoneItems: any[]
  from: string
  to: string
}) {
  const enriched = (() => {
    return jobs
      .filter(
        (j) =>
          (j.status === 'completed' || j.status === 'delivered') &&
          inRange(j.completed_at, from, to),
      )
      .map((j) => {
        // ── Metal breakdown (grouped by lot) ──
        const issues = metalTxns.filter(
          (t) => t.txn_type === 'issue_to_job' && t.reference_id === j.id,
        )
        const byLot = new Map<
          string,
          {
            lot_number: string
            purity_code: string
            fine_g: number
            rate: number
            cost: number
          }
        >()
        for (const t of issues) {
          const lot = metalLots.find((l) => l.metal_lot_id === t.metal_lot_id)
          const fine = Math.abs(Number(t.fine_weight_change_g) || 0)
          const rate = Number(lot?.rate_per_gram) || 0
          const cur = byLot.get(t.metal_lot_id) ?? {
            lot_number: lot?.lot_number ?? '—',
            purity_code: lot?.purity_code ?? '—',
            fine_g: 0,
            rate,
            cost: 0,
          }
          cur.fine_g += fine
          cur.cost += fine * rate
          byLot.set(t.metal_lot_id, cur)
        }
        const metalLines = Array.from(byLot.values())
        const totalIssuedFineG = metalLines.reduce((a, l) => a + l.fine_g, 0)
        const totalIssuedCost = metalLines.reduce((a, l) => a + l.cost, 0)
        const weightedRate =
          totalIssuedFineG > 0 ? totalIssuedCost / totalIssuedFineG : 0

        const finishedFineG = Number(j.finished_fine_g) || 0
        const wastageG = Number(j.wastage_fine_g) || 0
        const metalInPieceCost = finishedFineG * weightedRate
        const wastageCost = wastageG * weightedRate

        // ── Stones breakdown (grouped by 4Cs) ──
        const jobStoneIssues = stoneIssues.filter(
          (si) => si.job_id === j.id && si.stone_items?.status === 'mounted',
        )
        const stoneGroups = new Map<
          string,
          {
            shape: string
            color: string
            clarity: string
            cut: string
            pcs: number
            ct: number
            unit_price: number
            total: number
          }
        >()
        for (const si of jobStoneIssues) {
          const s = si.stone_items
          if (!s) continue
          const key = `${s.shape ?? ''}|${s.color ?? ''}|${s.clarity ?? ''}|${s.cut ?? ''}`
          const cur = stoneGroups.get(key) ?? {
            shape: s.shape ?? '—',
            color: s.color ?? '—',
            clarity: s.clarity ?? '—',
            cut: s.cut ?? '—',
            pcs: 0,
            ct: 0,
            unit_price: Number(s.cost_price) || 0,
            total: 0,
          }
          cur.pcs += 1
          cur.ct += Number(s.carat) || 0
          cur.total += Number(s.cost_price) || 0
          stoneGroups.set(key, cur)
        }
        const stoneLines = Array.from(stoneGroups.values())
        const totalStonePcs = stoneLines.reduce((a, g) => a + g.pcs, 0)
        const totalStoneCt = stoneLines.reduce((a, g) => a + g.ct, 0)
        const totalStoneCost = stoneLines.reduce((a, g) => a + g.total, 0)

        // ── Labour + total ──
        const labour = Number(j.making_charge_amount) || 0
        const totalCost = metalInPieceCost + totalStoneCost + labour

        const inv = inventory.find((i) => i.craftsman_job_id === j.id)
        const floor = Number(inv?.floor_price ?? 0)
        const design = j.design_id ? designMap[j.design_id] : null
        const craftsman = craftsmanMap[j.craftsman_id]

        return {
          job_id: j.id,
          job_number: j.job_number,
          design_name: design?.name ?? '—',
          design_code: design?.design_code ?? '—',
          craftsman_name: craftsman?.name ?? '—',
          craftsman_code: craftsman?.code ?? '—',
          completed_at: j.completed_at,
          metal: {
            lines: metalLines,
            finished_fine_g: finishedFineG,
            wastage_g: wastageG,
            weighted_rate: weightedRate,
            in_piece_cost: metalInPieceCost,
            wastage_cost: wastageCost,
          },
          stones: {
            lines: stoneLines,
            total_pcs: totalStonePcs,
            total_ct: totalStoneCt,
            total_cost: totalStoneCost,
          },
          labour,
          total_cost: totalCost,
          floor,
        }
      })
      .sort((a, b) =>
        (b.completed_at ?? '').localeCompare(a.completed_at ?? ''),
      )
  })()

  const totals = enriched.reduce(
    (acc, r) => ({
      jobs: acc.jobs + 1,
      metal: acc.metal + r.metal.in_piece_cost,
      stones: acc.stones + r.stones.total_cost,
      labour: acc.labour + r.labour,
      total: acc.total + r.total_cost,
      wastage_cost: acc.wastage_cost + r.metal.wastage_cost,
      wastage_g: acc.wastage_g + r.metal.wastage_g,
      finished_g: acc.finished_g + r.metal.finished_fine_g,
      floor: acc.floor + r.floor,
    }),
    {
      jobs: 0,
      metal: 0,
      stones: 0,
      labour: 0,
      total: 0,
      wastage_cost: 0,
      wastage_g: 0,
      finished_g: 0,
      floor: 0,
    },
  )

  return (
    <div>
      <PrintSummary
        items={[
          { label: 'Jobs', value: String(totals.jobs) },
          {
            label: 'Metal value',
            value: `₹ ${fmtMoney(totals.metal)}`,
            hint: `${fmtG(totals.finished_g)} g in pieces`,
          },
          {
            label: 'Stones value',
            value: `₹ ${fmtMoney(totals.stones)}`,
          },
          {
            label: 'Labour',
            value: `₹ ${fmtMoney(totals.labour)}`,
          },
          {
            label: 'Total cost',
            value: `₹ ${fmtMoney(totals.total)}`,
            accent: 'brand',
          },
        ]}
      />

      {enriched.length === 0 ? (
        <p className="py-6 text-center italic text-slate-500">
          No completed jobs in this range.
        </p>
      ) : (
        <div className="space-y-3">
          {enriched.map((r) => (
            <div
              key={r.job_id}
              className="avoid-break rounded border border-slate-300"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-300 bg-slate-100 px-3 py-1.5">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[10px] font-semibold text-slate-800">
                    {r.job_number}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-[11px] font-semibold text-slate-900">
                    {r.design_name}
                  </span>
                  {r.design_code && (
                    <span className="font-mono text-[9px] text-slate-500">
                      {r.design_code}
                    </span>
                  )}
                  <span className="text-slate-400">·</span>
                  <span className="text-[10px] text-slate-700">
                    {r.craftsman_name}{' '}
                    <span className="font-mono text-[9px] text-slate-500">
                      ({r.craftsman_code})
                    </span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-600">
                  Completed {fmtDate(r.completed_at)}
                </span>
              </div>

              {/* Body */}
              <div className="divide-y divide-slate-200">
                {/* Metal */}
                <div className="px-3 py-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Metal in piece
                    </span>
                    <span className="tabular text-[11px] font-semibold">
                      ₹ {fmtMoney(r.metal.in_piece_cost)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-600">
                    {fmtG(r.metal.finished_fine_g)} g fine × ₹
                    {fmtMoney(r.metal.weighted_rate)}/g
                  </div>
                  {r.metal.lines.map((l, i) => (
                    <div
                      key={i}
                      className="pl-3 text-[9px] text-slate-500"
                    >
                      • {l.lot_number} · {l.purity_code} ·{' '}
                      {fmtG(l.fine_g)} g issued @ ₹{fmtMoney(l.rate)}/g
                    </div>
                  ))}
                </div>

                {/* Stones */}
                {r.stones.total_pcs > 0 ? (
                  <div className="px-3 py-1.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Stones
                      </span>
                      <span className="tabular text-[11px] font-semibold">
                        ₹ {fmtMoney(r.stones.total_cost)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-600">
                      {r.stones.total_pcs} pcs ·{' '}
                      {fmtCt(r.stones.total_ct)} ct total
                    </div>
                    {r.stones.lines.map((g, i) => (
                      <div
                        key={i}
                        className="flex items-baseline justify-between gap-2 pl-3 text-[9px] text-slate-600"
                      >
                        <span>
                          {fmtCt(g.ct / g.pcs)} ct · {g.shape} · {g.color} ·{' '}
                          {g.clarity} · {g.cut} × {g.pcs}
                        </span>
                        <span className="whitespace-nowrap tabular text-slate-500">
                          @ ₹{fmtMoney(g.unit_price)} ea = ₹{fmtMoney(g.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-1.5 text-[10px] italic text-slate-500">
                    No stones mounted
                  </div>
                )}

                {/* Labour */}
                <div className="flex items-baseline justify-between px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    Labour{' '}
                    <span className="font-normal normal-case text-slate-500">
                      (making charge)
                    </span>
                  </span>
                  <span className="tabular text-[11px] font-semibold">
                    ₹ {fmtMoney(r.labour)}
                  </span>
                </div>

                {/* Total + floor + wastage */}
                <div className="flex items-baseline justify-between bg-slate-50 px-3 py-1.5">
                  <span className="text-[11px] font-bold text-slate-900">
                    Total cost
                  </span>
                  <span className="tabular text-[12px] font-bold text-slate-900">
                    ₹ {fmtMoney(r.total_cost)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between bg-slate-50 px-3 py-1 text-[9px] text-slate-600">
                  <span>
                    Floor:{' '}
                    {r.floor > 0
                      ? `₹ ${fmtMoney(r.floor)}`
                      : 'not set'}
                  </span>
                  <span>
                    Wastage: {fmtG(r.metal.wastage_g)} g @ ₹
                    {fmtMoney(r.metal.weighted_rate)}/g = ₹
                    {fmtMoney(r.metal.wastage_cost)}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Footer totals */}
          <div className="avoid-break rounded border border-slate-400 bg-slate-100 px-3 py-2 text-[11px] font-semibold">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-[8px] uppercase tracking-wide text-slate-500">
                  Metal total
                </p>
                <p className="tabular">₹ {fmtMoney(totals.metal)}</p>
              </div>
              <div>
                <p className="text-[8px] uppercase tracking-wide text-slate-500">
                  Stones total
                </p>
                <p className="tabular">₹ {fmtMoney(totals.stones)}</p>
              </div>
              <div>
                <p className="text-[8px] uppercase tracking-wide text-slate-500">
                  Labour total
                </p>
                <p className="tabular">₹ {fmtMoney(totals.labour)}</p>
              </div>
              <div>
                <p className="text-[8px] uppercase tracking-wide text-slate-500">
                  Grand total
                </p>
                <p className="tabular text-slate-900">
                  ₹ {fmtMoney(totals.total)}
                </p>
              </div>
            </div>
            <div className="mt-1 flex justify-between border-t border-slate-300 pt-1 text-[9px] font-normal text-slate-600">
              <span>
                Total wastage value: ₹ {fmtMoney(totals.wastage_cost)} (
                {fmtG(totals.wastage_g)} g)
              </span>
              <span>Total floor value: ₹ {fmtMoney(totals.floor)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// ═══════════════════════════════════════════════════════
// 5. Payments Ledger print
// ═══════════════════════════════════════════════════════
function PaymentsPrint({
  payments,
  craftsmanMap,
  jobs,
  jobMap,
  from,
  to,
}: {
  payments: any[]
  craftsmanMap: Record<string, any>
  jobs: any[]
  jobMap: Record<string, any>
  from: string
  to: string
}) {
  const rows = payments
    .filter((p) => inRange(p.payment_date, from, to))
    .sort((a, b) => {
      const cmp = b.payment_date.localeCompare(a.payment_date)
      if (cmp !== 0) return cmp
      return b.created_at.localeCompare(a.created_at)
    })

  const activeRows = rows.filter((p) => !p.voided_at)
  const totals = {
    active: activeRows.length,
    sum: activeRows.reduce((a, p) => a + Number(p.amount), 0),
    voided: rows.length - activeRows.length,
  }

  return (
    <div>
      <PrintSummary
        items={[
          { label: 'Entries', value: String(rows.length) },
          { label: 'Active', value: String(totals.active) },
          {
            label: 'Total paid',
            value: `₹ ${fmtMoney(totals.sum)}`,
            accent: 'emerald',
          },
          {
            label: 'Voided',
            value: String(totals.voided),
            accent: totals.voided > 0 ? 'rose' : 'slate',
          },
        ]}
      />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-slate-500 italic">
          No payments in this range.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Craftsman</Th>
              <Th>Job</Th>
              <Th>Method</Th>
              <Th>Reference</Th>
              <Th align="right">Amount</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const c = craftsmanMap[p.craftsman_id]
              const j = p.job_id ? jobMap[p.job_id] : null
              const isVoided = p.voided_at != null
              return (
                <tr
                  key={p.id}
                  className={isVoided ? 'text-slate-400 line-through' : ''}
                >
                  <Td>{fmtDate(p.payment_date)}</Td>
                  <Td>
                    {c?.name ?? '—'}
                    <span className="ml-1 font-mono text-[8px]">
                      {c?.code ?? '—'}
                    </span>
                  </Td>
                  <Td className="font-mono text-[9px]">
                    {j ? j.job_number : 'advance'}
                  </Td>
                  <Td className="capitalize">
                    {p.payment_method.replace(/_/g, ' ')}
                  </Td>
                  <Td className="font-mono text-[9px]">{p.reference ?? '—'}</Td>
                  <Td align="right" className="font-medium">
                    ₹ {fmtMoney(p.amount)}
                  </Td>
                  <Td className="text-[9px]">
                    {isVoided
                      ? `Voided: ${p.void_reason ?? '—'}`
                      : p.notes ?? '—'}
                  </Td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-slate-700 bg-slate-100 font-semibold">
              <Td>Total (active only)</Td>
              <Td></Td>
              <Td></Td>
              <Td></Td>
              <Td></Td>
              <Td align="right">₹ {fmtMoney(totals.sum)}</Td>
              <Td></Td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}