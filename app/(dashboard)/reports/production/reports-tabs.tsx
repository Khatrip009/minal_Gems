'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/primitives/page-header'
import { EmptyState } from '@/components/primitives/empty-state'
import { StatusBadge, statusVariant } from '@/components/primitives/status-badge'
import {
  Download,
  FileText,
  Users,
  Coins,
  Gem,
  TrendingUp,
  Wallet,
  Filter,
} from 'lucide-react'

type Craftsman = {
  id: string
  code: string
  name: string
  is_active: boolean
  skill_type: string | null
}
type Job = {
  id: string
  job_number: string
  craftsman_id: string
  design_id: string | null
  status: string
  issued_fine_g: number | string
  returned_fine_g: number | string
  finished_fine_g: number | string
  wastage_fine_g: number | string
  making_charge_amount: number | string | null
  completed_at: string | null
  created_at: string
  due_date: string | null
}
type Payment = {
  id: string
  craftsman_id: string
  job_id: string | null
  amount: number | string
  payment_date: string
  payment_method: string
  reference: string | null
  notes: string | null
  voided_at: string | null
  void_reason: string | null
  created_at: string
}
type MetalLot = {
  metal_lot_id: string
  lot_number: string
  purity_code: string | null
  purity_percent: number | string | null
  opening_fine_weight_g: number | string
  txn_fine_g: number | string
  balance_fine_g: number | string
  rate_per_gram: number | string | null
  location_id: string | null
}
type MetalTxn = {
  id: string
  metal_lot_id: string
  txn_type: string
  fine_weight_change_g: number | string
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  created_at: string
}
type StoneIssue = {
  id: string
  job_id: string
  stone_item_id: string
  issued_at: string
  stone_items: {
    inventory_tag: string
    carat: number | string
    shape: string | null
    color: string | null
    clarity: string | null
    cut: string | null
    cost_price: number | string | null
    status: string
  } | null
}
type StoneReturn = {
  id: string
  job_id: string
  stone_item_id: string
  return_condition: string | null
  carat_returned: number | string | null
  received_at: string
}
type StoneItem = {
  id: string
  inventory_tag: string
  carat: number | string
  status: string
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
  cost_price: number | string | null
  stone_master_id: string | null
  stone_lot_id: string | null
  location_id: string | null
}
type InventoryItem = {
  id: string
  inventory_tag: string
  craftsman_job_id: string | null
  net_fine_weight_g: number | string
  cost_price: number | string
  making_charge_amount: number | string | null
  floor_price: number | string | null
  status: string
  sold_at: string | null
  created_at: string
}
type Design = { id: string; name: string; design_code: string }

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
const todayISO = () => new Date().toISOString().slice(0, 10)

function inRange(d: string | null | undefined, from: string, to: string): boolean {
  if (!d) return false
  const dateStr = d.slice(0, 10)
  if (from && dateStr < from) return false
  if (to && dateStr > to) return false
  return true
}

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    toast.error('Nothing to export')
    return
  }
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function quickRange(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

// ── Shared PDF link button ──
function ExportPdfLink({
  slug,
  from,
  to,
}: {
  slug: 'settlement' | 'gold' | 'stone' | 'profitability' | 'payments'
  from: string
  to: string
}) {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  const href = `/reports/print/${slug}${qs ? `?${qs}` : ''}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
    >
      <FileText className="h-3.5 w-3.5" /> Export PDF
    </a>
  )
}

const TABS = [
  { id: 'settlement', label: 'Craftsman Settlement', icon: Users },
  { id: 'gold', label: 'Gold Flow', icon: Coins },
  { id: 'stone', label: 'Stone Flow', icon: Gem },
  { id: 'profitability', label: 'Job Profitability', icon: TrendingUp },
  { id: 'payments', label: 'Payments Ledger', icon: Wallet },
] as const
type TabId = (typeof TABS)[number]['id']

// ── Main ──
export function ReportsTabs({
  craftsmen,
  jobs,
  payments,
  metalLots,
  metalTxns,
  stoneIssues,
  stoneReturns,
  stoneItems,
  inventory,
  designs,
}: {
  craftsmen: Craftsman[]
  jobs: Job[]
  payments: Payment[]
  metalLots: MetalLot[]
  metalTxns: MetalTxn[]
  stoneIssues: StoneIssue[]
  stoneReturns: StoneReturn[]
  stoneItems: StoneItem[]
  inventory: InventoryItem[]
  designs: Design[]
}) {
  const [tab, setTab] = useState<TabId>('settlement')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const craftsmanMap = useMemo(
    () => Object.fromEntries(craftsmen.map((c) => [c.id, c])),
    [craftsmen],
  )
  const designMap = useMemo(
    () => Object.fromEntries(designs.map((d) => [d.id, d])),
    [designs],
  )

  function resetRange() {
    setFrom('')
    setTo('')
  }

  function applyPreset(days: number) {
    const r = quickRange(days)
    setFrom(r.from)
    setTo(r.to)
  }

  function applyThisMonth() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    setFrom(start.toISOString().slice(0, 10))
    setTo(todayISO())
  }

  function applyLastMonth() {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    setFrom(start.toISOString().slice(0, 10))
    setTo(end.toISOString().slice(0, 10))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Settlement, material flow, and financial reports. All exportable as CSV or branded PDF."
      />

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Date range + quick filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <Filter className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-600">Date range</span>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-8 w-36 text-xs"
        />
        <span className="text-xs text-slate-400">to</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-8 w-36 text-xs"
        />
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Button variant="ghost" size="sm" onClick={applyThisMonth}>
          This month
        </Button>
        <Button variant="ghost" size="sm" onClick={applyLastMonth}>
          Last month
        </Button>
        <Button variant="ghost" size="sm" onClick={() => applyPreset(30)}>
          Last 30d
        </Button>
        <Button variant="ghost" size="sm" onClick={() => applyPreset(90)}>
          Last 90d
        </Button>
        <Button variant="ghost" size="sm" onClick={resetRange}>
          All time
        </Button>
      </div>

      {tab === 'settlement' && (
        <SettlementReport
          craftsmen={craftsmen}
          jobs={jobs}
          payments={payments}
          craftsmanMap={craftsmanMap}
          from={from}
          to={to}
        />
      )}
      {tab === 'gold' && (
        <GoldFlowReport
          metalLots={metalLots}
          metalTxns={metalTxns}
          from={from}
          to={to}
        />
      )}
      {tab === 'stone' && (
        <StoneFlowReport
          stoneIssues={stoneIssues}
          stoneReturns={stoneReturns}
          stoneItems={stoneItems}
          from={from}
          to={to}
        />
      )}
      {tab === 'profitability' && (
  <ProfitabilityReport
    jobs={jobs}
    inventory={inventory}
    designMap={designMap}
    craftsmanMap={craftsmanMap}
    metalTxns={metalTxns}
    metalLots={metalLots}
    stoneIssues={stoneIssues}
    stoneItems={stoneItems}
    from={from}
    to={to}
  />
)}
      {tab === 'payments' && (
        <PaymentsLedgerReport
          payments={payments}
          craftsmanMap={craftsmanMap}
          jobs={jobs}
          from={from}
          to={to}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 1. Settlement Report
// ═══════════════════════════════════════════════════════
function SettlementReport({
  craftsmen,
  jobs,
  payments,
  craftsmanMap,
  from,
  to,
}: {
  craftsmen: Craftsman[]
  jobs: Job[]
  payments: Payment[]
  craftsmanMap: Record<string, Craftsman>
  from: string
  to: string
}) {
  const rows = useMemo(() => {
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
        stonesIssuedPcs: number
        stonesMountedPcs: number
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
        stonesIssuedPcs: 0,
        stonesMountedPcs: 0,
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

    return Array.from(byCraftsman.entries())
      .map(([cid, m]) => {
        const c = craftsmanMap[cid]
        const wastagePct = m.issuedG > 0 ? (m.wastageG / m.issuedG) * 100 : 0
        return {
          craftsman_id: cid,
          code: c?.code ?? '—',
          name: c?.name ?? '—',
          is_active: c?.is_active ?? false,
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
  }, [craftsmen, jobs, payments, craftsmanMap, from, to])

  const totals = rows.reduce(
    (acc, r) => ({
      jobCount: acc.jobCount + r.jobCount,
      issuedG: acc.issuedG + r.issuedG,
      returnedG: acc.returnedG + r.returnedG,
      finishedG: acc.finishedG + r.finishedG,
      wastageG: acc.wastageG + r.wastageG,
      earned: acc.earned + r.earned,
      paid: acc.paid + r.paid,
      balance: acc.balance + r.balance,
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

  function exportCSV() {
    downloadCSV(
      `settlement-${todayISO()}.csv`,
      rows.map((r) => ({
        Code: r.code,
        Name: r.name,
        Jobs: r.jobCount,
        'Issued (g)': r.issuedG.toFixed(3),
        'Returned (g)': r.returnedG.toFixed(3),
        'Finished (g)': r.finishedG.toFixed(3),
        'Wastage (g)': r.wastageG.toFixed(3),
        'Wastage %': r.wastagePct.toFixed(1),
        'Earned (₹)': r.earned.toFixed(2),
        'Paid (₹)': r.paid.toFixed(2),
        'Balance (₹)': r.balance.toFixed(2),
      })),
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Craftsmen" value={String(rows.length)} />
        <SummaryCard label="Jobs completed" value={String(totals.jobCount)} />
        <SummaryCard label="Gold issued" value={`${fmtG(totals.issuedG)} g`} />
        <SummaryCard
          label="Total wastage"
          value={`${fmtG(totals.wastageG)} g`}
          hint={
            totals.issuedG > 0
              ? `${((totals.wastageG / totals.issuedG) * 100).toFixed(1)}% of issued`
              : undefined
          }
          accent="rose"
        />
        <SummaryCard
          label="Outstanding"
          value={`₹ ${fmtMoney(totals.balance)}`}
          hint={`Earned ₹${fmtMoney(totals.earned)} · Paid ₹${fmtMoney(totals.paid)}`}
          accent={totals.balance > 0.01 ? 'amber' : 'emerald'}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {rows.length} craftsman{rows.length === 1 ? '' : 'men'} with completed jobs
          {from || to ? ` in range` : ''}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <ExportPdfLink slug="settlement" from={from} to={to} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No completed jobs in this range"
          description="Complete a job or adjust the date range to see settlement data."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <Th align="left">Craftsman</Th>
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
                <tr
                  key={r.craftsman_id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/craftsmen/${r.craftsman_id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {r.name}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-slate-500">
                      {r.code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{r.jobCount}</td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {fmtG(r.issuedG)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {fmtG(r.returnedG)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular font-medium">
                    {fmtG(r.finishedG)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular text-rose-700">
                    {fmtG(r.wastageG)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tabular text-xs ${
                      r.wastagePct > 10
                        ? 'font-semibold text-rose-700'
                        : r.wastagePct > 6
                          ? 'text-amber-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {r.wastagePct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    ₹ {fmtMoney(r.earned)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular text-emerald-700">
                    ₹ {fmtMoney(r.paid)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tabular font-semibold ${
                      r.balance > 0.01 ? 'text-amber-700' : 'text-slate-400'
                    }`}
                  >
                    {r.balance > 0.01 ? `₹ ${fmtMoney(r.balance)}` : '✓ settled'}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-4 py-2.5 text-right tabular">{totals.jobCount}</td>
                <td className="px-4 py-2.5 text-right tabular">
                  {fmtG(totals.issuedG)}
                </td>
                <td className="px-4 py-2.5 text-right tabular">
                  {fmtG(totals.returnedG)}
                </td>
                <td className="px-4 py-2.5 text-right tabular">
                  {fmtG(totals.finishedG)}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-rose-700">
                  {fmtG(totals.wastageG)}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-xs">
                  {totals.issuedG > 0
                    ? `${((totals.wastageG / totals.issuedG) * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular">
                  ₹ {fmtMoney(totals.earned)}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-emerald-700">
                  ₹ {fmtMoney(totals.paid)}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-brand-700">
                  ₹ {fmtMoney(totals.balance)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 2. Gold Flow Report
// ═══════════════════════════════════════════════════════
function GoldFlowReport({
  metalLots,
  metalTxns,
  from,
  to,
}: {
  metalLots: MetalLot[]
  metalTxns: MetalTxn[]
  from: string
  to: string
}) {
  const rows = useMemo(() => {
    const filtered = metalTxns.filter((t) => inRange(t.created_at, from, to))

    return metalLots.map((lot) => {
      const lotTxns = filtered.filter((t) => t.metal_lot_id === lot.metal_lot_id)
      const buckets: Record<string, number> = {}
      for (const t of lotTxns) {
        const v = Number(t.fine_weight_change_g) || 0
        buckets[t.txn_type] = (buckets[t.txn_type] ?? 0) + v
      }
      const totalIn = Object.values(buckets)
        .filter((v) => v > 0)
        .reduce((a, b) => a + b, 0)
      const totalOut = Object.values(buckets)
        .filter((v) => v < 0)
        .reduce((a, b) => a + b, 0)
      return {
        lot_number: lot.lot_number,
        purity_code: lot.purity_code ?? '—',
        opening: Number(lot.opening_fine_weight_g) || 0,
        in: totalIn,
        out: totalOut,
        balance: Number(lot.balance_fine_g) || 0,
        rate: Number(lot.rate_per_gram) || 0,
        txn_count: lotTxns.length,
        buckets,
      }
    })
  }, [metalLots, metalTxns, from, to])

  const totals = rows.reduce(
    (acc, r) => ({
      opening: acc.opening + r.opening,
      in: acc.in + r.in,
      out: acc.out + r.out,
      balance: acc.balance + r.balance,
    }),
    { opening: 0, in: 0, out: 0, balance: 0 },
  )

  const byType = useMemo(() => {
    const m = new Map<string, { count: number; fineG: number }>()
    const filtered = metalTxns.filter((t) => inRange(t.created_at, from, to))
    for (const t of filtered) {
      const cur = m.get(t.txn_type) ?? { count: 0, fineG: 0 }
      cur.count += 1
      cur.fineG += Number(t.fine_weight_change_g) || 0
      m.set(t.txn_type, cur)
    }
    return Array.from(m.entries()).sort(
      (a, b) => Math.abs(b[1].fineG) - Math.abs(a[1].fineG),
    )
  }, [metalTxns, from, to])

  function exportCSV() {
    downloadCSV(
      `gold-flow-${todayISO()}.csv`,
      rows.map((r) => ({
        Lot: r.lot_number,
        Purity: r.purity_code,
        'Opening (g)': r.opening.toFixed(3),
        'In (g)': r.in.toFixed(3),
        'Out (g)': r.out.toFixed(3),
        'Balance (g)': r.balance.toFixed(3),
        'Rate/g (₹)': r.rate.toFixed(2),
        Movements: r.txn_count,
      })),
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Lots" value={String(rows.length)} />
        <SummaryCard label="Opening total" value={`${fmtG(totals.opening)} g`} />
        <SummaryCard
          label="Net in-range in"
          value={`${fmtG(totals.in)} g`}
          accent="emerald"
        />
        <SummaryCard
          label="Net in-range out"
          value={`${fmtG(totals.out)} g`}
          accent="rose"
        />
      </div>

      {byType.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Movement summary
          </p>
          <div className="flex flex-wrap gap-2">
            {byType.map(([type, stats]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs"
              >
                <span className="font-medium capitalize text-slate-700">
                  {type.replace(/_/g, ' ')}
                </span>
                <span className="text-slate-400">·</span>
                <span className="tabular text-slate-600">
                  {stats.count}× {fmtG(stats.fineG)} g
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Per-lot state and in-range movements
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <ExportPdfLink slug="gold" from={from} to={to} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Coins className="h-5 w-5" />}
          title="No metal lots yet"
          description="Create a metal lot to see gold flow."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <Th align="left">Lot</Th>
                <Th align="left">Purity</Th>
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
                <tr
                  key={r.lot_number}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2.5 font-mono text-xs">{r.lot_number}</td>
                  <td className="px-4 py-2.5">{r.purity_code}</td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {fmtG(r.opening)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular text-emerald-700">
                    {r.in > 0 ? `+${fmtG(r.in)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular text-rose-700">
                    {r.out < 0 ? fmtG(r.out) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular font-semibold">
                    {fmtG(r.balance)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    ₹ {fmtMoney(r.rate)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular text-slate-500">
                    {r.txn_count}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td className="px-4 py-2.5" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-2.5 text-right tabular">
                  {fmtG(totals.opening)}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-emerald-700">
                  +{fmtG(totals.in)}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-rose-700">
                  {fmtG(totals.out)}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-brand-700">
                  {fmtG(totals.balance)}
                </td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 3. Stone Flow Report
// ═══════════════════════════════════════════════════════
function StoneFlowReport({
  stoneIssues,
  stoneReturns,
  stoneItems,
  from,
  to,
}: {
  stoneIssues: StoneIssue[]
  stoneReturns: StoneReturn[]
  stoneItems: StoneItem[]
  from: string
  to: string
}) {
  const rows = useMemo(() => {
    const rangesIssues = stoneIssues.filter((si) =>
      inRange(si.issued_at, from, to),
    )
    const rangeReturns = stoneReturns.filter((sr) =>
      inRange(sr.received_at, from, to),
    )

    const statusGroups = new Map<
      string,
      { pcs: number; ct: number; cost: number }
    >()

    for (const s of stoneItems) {
      const cur = statusGroups.get(s.status) ?? { pcs: 0, ct: 0, cost: 0 }
      cur.pcs += 1
      cur.ct += Number(s.carat) || 0
      cur.cost += Number(s.cost_price) || 0
      statusGroups.set(s.status, cur)
    }

    const issuedPcs = rangesIssues.length
    const issuedCt = rangesIssues.reduce(
      (a, si) => a + Number(si.stone_items?.carat ?? 0),
      0,
    )
    const returnedPcs = rangeReturns.length
    const returnedCt = rangeReturns.reduce(
      (a, sr) => a + Number(sr.carat_returned ?? 0),
      0,
    )

    return {
      byStatus: Array.from(statusGroups.entries()).sort(
        (a, b) => b[1].pcs - a[1].pcs,
      ),
      issuedPcs,
      issuedCt,
      returnedPcs,
      returnedCt,
    }
  }, [stoneIssues, stoneReturns, stoneItems, from, to])

  function exportCSV() {
    downloadCSV(
      `stone-flow-${todayISO()}.csv`,
      rows.byStatus.map(([status, s]) => ({
        Status: status,
        Pieces: s.pcs,
        Carats: s.ct.toFixed(3),
        'Cost (₹)': s.cost.toFixed(2),
      })),
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Total stones" value={String(stoneItems.length)} />
        <SummaryCard
          label="Issued in range"
          value={`${rows.issuedPcs} pcs`}
          hint={`${fmtCt(rows.issuedCt)} ct`}
        />
        <SummaryCard
          label="Returned in range"
          value={`${rows.returnedPcs} pcs`}
          hint={`${fmtCt(rows.returnedCt)} ct`}
          accent="emerald"
        />
        <SummaryCard
          label="Outstanding"
          value={String(
            stoneItems.filter((s) => s.status === 'issued_to_job').length,
          )}
          hint="Issued but not returned"
          accent="amber"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Current state of every stone in inventory
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <ExportPdfLink slug="stone" from={from} to={to} />
        </div>
      </div>

      {rows.byStatus.length === 0 ? (
        <EmptyState
          icon={<Gem className="h-5 w-5" />}
          title="No stones in inventory"
          description="Add stone items to a lot to see stone flow."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <Th align="left">Status</Th>
                <Th align="right">Pieces</Th>
                <Th align="right">Carats</Th>
                <Th align="right">Cost</Th>
              </tr>
            </thead>
            <tbody>
              {rows.byStatus.map(([status, s]) => (
                <tr
                  key={status}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2.5">
                    <StatusBadge variant={statusVariant(status)}>
                      {status.replace(/_/g, ' ')}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{s.pcs}</td>
                  <td className="px-4 py-2.5 text-right tabular">
                    {fmtCt(s.ct)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">
                    ₹ {fmtMoney(s.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 4. Job Profitability Report
// ═══════════════════════════════════════════════════════
function ProfitabilityReport({
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
  jobs: Job[]
  inventory: InventoryItem[]
  designMap: Record<string, Design>
  craftsmanMap: Record<string, Craftsman>
  metalTxns: MetalTxn[]
  metalLots: MetalLot[]
  stoneIssues: StoneIssue[]
  stoneItems: StoneItem[]
  from: string
  to: string
}) {
  const enriched = useMemo(() => {
    return jobs
      .filter(
        (j) =>
          (j.status === 'completed' || j.status === 'delivered') &&
          inRange(j.completed_at, from, to),
      )
      .map((j) => {
        // Metal breakdown grouped by lot
        const issues = metalTxns.filter(
          (t) => t.txn_type === 'issue_to_job' && t.reference_id === j.id,
        )
        const byLot = new Map<
          string,
          { lot_number: string; purity_code: string; fine_g: number; rate: number; cost: number }
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

        // Stones grouped by 4Cs
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
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  }, [jobs, inventory, designMap, craftsmanMap, metalTxns, metalLots, stoneIssues, stoneItems, from, to])

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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Jobs" value={String(totals.jobs)} />
        <SummaryCard
          label="Metal value"
          value={`₹ ${fmtMoney(totals.metal)}`}
          hint={`${fmtG(totals.finished_g)} g in pieces`}
        />
        <SummaryCard
          label="Stones value"
          value={`₹ ${fmtMoney(totals.stones)}`}
        />
        <SummaryCard
          label="Labour"
          value={`₹ ${fmtMoney(totals.labour)}`}
        />
        <SummaryCard
          label="Total cost"
          value={`₹ ${fmtMoney(totals.total)}`}
          accent="brand"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {enriched.length} completed job{enriched.length === 1 ? '' : 's'} · metal +
          stones + labour per piece
        </p>
        <div className="flex gap-2">
          <ExportPdfLink slug="profitability" from={from} to={to} />
        </div>
      </div>

      {enriched.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title="No completed jobs in this range"
          description="Complete a job to see profitability data."
        />
      ) : (
        <div className="space-y-3">
          {enriched.map((r) => (
            <div
              key={r.job_id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link
                    href={`/jobs/${r.job_id}`}
                    className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                  >
                    {r.job_number}
                  </Link>
                  <span className="text-slate-300">·</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {r.design_name}
                  </span>
                  {r.design_code && (
                    <span className="font-mono text-xs text-slate-500">
                      {r.design_code}
                    </span>
                  )}
                  <span className="text-slate-300">·</span>
                  <Link
                    href={`/craftsmen/${jobs.find((j) => j.id === r.job_id)?.craftsman_id ?? ''}`}
                    className="text-xs text-slate-600 hover:underline"
                  >
                    {r.craftsman_name}
                    <span className="ml-1 font-mono text-xs text-slate-500">
                      ({r.craftsman_code})
                    </span>
                  </Link>
                </div>
                <span className="text-xs text-slate-500">
                  Completed {fmtDate(r.completed_at)}
                </span>
              </div>

              {/* Body */}
              <div className="divide-y divide-slate-100">
                {/* Metal */}
                <div className="px-4 py-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Metal in piece
                    </span>
                    <span className="tabular text-sm font-semibold">
                      ₹ {fmtMoney(r.metal.in_piece_cost)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {fmtG(r.metal.finished_fine_g)} g fine × ₹
                    {fmtMoney(r.metal.weighted_rate)}/g
                  </p>
                  {r.metal.lines.map((l, i) => (
                    <p key={i} className="mt-0.5 pl-3 text-[10px] text-slate-500">
                      • {l.lot_number} · {l.purity_code} · {fmtG(l.fine_g)} g issued
                      @ ₹{fmtMoney(l.rate)}/g
                    </p>
                  ))}
                </div>

                {/* Stones */}
                {r.stones.total_pcs > 0 ? (
                  <div className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Stones
                      </span>
                      <span className="tabular text-sm font-semibold">
                        ₹ {fmtMoney(r.stones.total_cost)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {r.stones.total_pcs} pcs · {fmtCt(r.stones.total_ct)} ct
                    </p>
                    {r.stones.lines.map((g, i) => (
                      <div
                        key={i}
                        className="mt-1 flex items-baseline justify-between gap-2 pl-3 text-[10px] text-slate-600"
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
                  <div className="px-4 py-2.5 text-xs italic text-slate-500">
                    No stones mounted
                  </div>
                )}

                {/* Labour */}
                <div className="flex items-baseline justify-between px-4 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Labour
                  </span>
                  <span className="tabular text-sm font-semibold">
                    ₹ {fmtMoney(r.labour)}
                  </span>
                </div>

                {/* Total */}
                <div className="flex items-baseline justify-between bg-slate-50 px-4 py-2.5">
                  <span className="text-sm font-bold text-slate-900">
                    Total cost
                  </span>
                  <span className="tabular text-base font-bold text-slate-900">
                    ₹ {fmtMoney(r.total_cost)}
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-600">
                  <span>
                    Floor:{' '}
                    {r.floor > 0 ? `₹ ${fmtMoney(r.floor)}` : 'not set'}
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

          {/* Footer */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-300 bg-slate-50 p-4 md:grid-cols-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Metal total
              </p>
              <p className="tabular text-lg font-semibold text-slate-900">
                ₹ {fmtMoney(totals.metal)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Stones total
              </p>
              <p className="tabular text-lg font-semibold text-slate-900">
                ₹ {fmtMoney(totals.stones)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Labour total
              </p>
              <p className="tabular text-lg font-semibold text-slate-900">
                ₹ {fmtMoney(totals.labour)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Grand total
              </p>
              <p className="tabular text-lg font-bold text-brand-700">
                ₹ {fmtMoney(totals.total)}
              </p>
            </div>
            <div className="col-span-2 md:col-span-4 mt-1 flex justify-between border-t border-slate-300 pt-2 text-xs text-slate-600">
              <span>
                Total wastage value: ₹ {fmtMoney(totals.wastage_cost)} (
                {fmtG(totals.wastage_g)} g)
              </span>
              <span>Total floor: ₹ {fmtMoney(totals.floor)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// 5. Payments Ledger Report
// ═══════════════════════════════════════════════════════
function PaymentsLedgerReport({
  payments,
  craftsmanMap,
  jobs,
  from,
  to,
}: {
  payments: Payment[]
  craftsmanMap: Record<string, Craftsman>
  jobs: Job[]
  from: string
  to: string
}) {
  const jobMap = useMemo(
    () => Object.fromEntries(jobs.map((j) => [j.id, j])),
    [jobs],
  )

  const rows = useMemo(() => {
    return payments
      .filter((p) => inRange(p.payment_date, from, to))
      .sort((a, b) => {
        const cmp = b.payment_date.localeCompare(a.payment_date)
        if (cmp !== 0) return cmp
        return b.created_at.localeCompare(a.created_at)
      })
  }, [payments, from, to])

  const totals = useMemo(() => {
    const active = rows.filter((p) => !p.voided_at)
    return {
      count: active.length,
      sum: active.reduce((a, p) => a + Number(p.amount), 0),
      voided: rows.length - active.length,
    }
  }, [rows])

  function exportCSV() {
    downloadCSV(
      `payments-ledger-${todayISO()}.csv`,
      rows.map((p) => ({
        Date: p.payment_date,
        Craftsman: craftsmanMap[p.craftsman_id]?.name ?? '—',
        Code: craftsmanMap[p.craftsman_id]?.code ?? '—',
        Job: p.job_id ? (jobMap[p.job_id]?.job_number ?? '—') : 'advance',
        'Amount (₹)': Number(p.amount).toFixed(2),
        Method: p.payment_method,
        Reference: p.reference ?? '',
        Notes: p.notes ?? '',
        Voided: p.voided_at ? 'yes' : 'no',
        'Void Reason': p.void_reason ?? '',
      })),
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Entries" value={String(rows.length)} />
        <SummaryCard label="Active" value={String(totals.count)} />
        <SummaryCard
          label="Total paid"
          value={`₹ ${fmtMoney(totals.sum)}`}
          accent="emerald"
        />
        <SummaryCard
          label="Voided"
          value={String(totals.voided)}
          accent={totals.voided > 0 ? 'rose' : 'slate'}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Every payment entry — voided rows are shown for audit but excluded from
          totals
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <ExportPdfLink slug="payments" from={from} to={to} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="No payments in this range"
          description="Adjust the date range or record a payment to see entries."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <Th align="left">Date</Th>
                <Th align="left">Craftsman</Th>
                <Th align="left">Job</Th>
                <Th align="left">Method</Th>
                <Th align="left">Reference</Th>
                <Th align="right">Amount</Th>
                <Th align="left">Notes</Th>
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
                    className={`border-b border-slate-100 last:border-0 ${
                      isVoided ? 'bg-slate-50/60' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td
                      className={`whitespace-nowrap px-4 py-2.5 ${
                        isVoided
                          ? 'text-slate-400 line-through'
                          : 'text-slate-600'
                      }`}
                    >
                      {fmtDate(p.payment_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/craftsmen/${p.craftsman_id}`}
                        className={`text-brand-700 hover:underline ${
                          isVoided ? 'line-through opacity-60' : ''
                        }`}
                      >
                        {c?.name ?? '—'}
                      </Link>
                      <span className="ml-2 font-mono text-xs text-slate-500">
                        {c?.code ?? '—'}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2.5 font-mono text-xs ${
                        isVoided
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700'
                      }`}
                    >
                      {j ? (
                        <Link
                          href={`/jobs/${j.id}`}
                          className="hover:underline"
                        >
                          {j.job_number}
                        </Link>
                      ) : (
                        <span className="italic text-slate-500">advance</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2.5 capitalize ${
                        isVoided
                          ? 'text-slate-400 line-through'
                          : 'text-slate-600'
                      }`}
                    >
                      {p.payment_method.replace(/_/g, ' ')}
                    </td>
                    <td
                      className={`px-4 py-2.5 font-mono text-xs ${
                        isVoided
                          ? 'text-slate-400 line-through'
                          : 'text-slate-600'
                      }`}
                    >
                      {p.reference ?? '—'}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular font-semibold ${
                        isVoided
                          ? 'text-slate-400 line-through'
                          : 'text-slate-900'
                      }`}
                    >
                      ₹ {fmtMoney(p.amount)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-xs ${
                        isVoided ? 'italic text-slate-400' : 'text-slate-600'
                      }`}
                    >
                      {isVoided
                        ? `Voided: ${p.void_reason ?? '—'}`
                        : p.notes ?? '—'}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td colSpan={5} className="px-4 py-2.5">
                  Total (active only)
                </td>
                <td className="px-4 py-2.5 text-right tabular text-brand-700">
                  ₹ {fmtMoney(totals.sum)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Small UI atoms ──
function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-4 py-2.5 font-medium text-slate-600 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function SummaryCard({
  label,
  value,
  hint,
  accent = 'slate',
}: {
  label: string
  value: string
  hint?: string
  accent?: 'slate' | 'brand' | 'emerald' | 'amber' | 'rose'
}) {
  const accentMap = {
    slate: 'text-slate-900',
    brand: 'text-brand-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1 tabular text-xl font-semibold ${accentMap[accent]}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}