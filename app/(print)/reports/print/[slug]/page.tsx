import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/guard'
import { ReportPrintShell } from '@/components/primitives/report-print-shell'

const SLUGS = ['settlement', 'gold', 'stone', 'profitability', 'payments'] as const
type Slug = (typeof SLUGS)[number]

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}
const fmtG = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}
const fmtCt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}
const fmtDate = (d: string | null | undefined) =>
  !d ? '—' : new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })

function inRange(d: string | null | undefined, from: string, to: string): boolean {
  if (!d) return false
  const s = d.slice(0, 10)
  if (from && s < from) return false
  if (to && s > to) return false
  return true
}

export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const from = sp.from ?? ''
  const to = sp.to ?? ''

  if (!SLUGS.includes(slug as Slug)) notFound()

  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])
  const { data: { user } } = await supabase.auth.getUser()

  const [cr, jr, pr, mlr, mtr, sir, srr, silr, invr, dsr, prof] = await Promise.all([
    supabase.from('craftsmen').select('id, code, name, is_active, skill_type'),
    supabase.from('craftsman_jobs').select('id, job_number, craftsman_id, design_id, status, issued_fine_g, returned_fine_g, finished_fine_g, wastage_fine_g, making_charge_amount, completed_at, created_at, due_date'),
    supabase.from('craftsman_job_payments').select('id, craftsman_id, job_id, amount, payment_date, payment_method, reference, notes, voided_at, void_reason, created_at').order('payment_date', { ascending: false }),
    supabase.from('v_metal_lot_balances').select('metal_lot_id, lot_number, purity_code, purity_percent, opening_fine_weight_g, txn_fine_g, balance_fine_g, rate_per_gram, location_id'),
    supabase.from('metal_transactions').select('id, metal_lot_id, txn_type, fine_weight_change_g, reference_type, reference_id, notes, created_at').order('created_at', { ascending: false }),
    supabase.from('craftsman_job_stone_issues').select('id, job_id, stone_item_id, issued_at, stone_items(inventory_tag, carat, shape, color, clarity, cut, cost_per_carat, status)'),
    supabase.from('craftsman_job_stone_returns').select('id, job_id, stone_item_id, return_condition, carat_returned, received_at'),
    supabase.from('stone_items').select('id, inventory_tag, carat, status, shape, color, clarity, cut, cost_per_carat, stone_master_id, stone_lot_id, location_id'),
    supabase.from('inventory_items').select('id, inventory_tag, craftsman_job_id, net_fine_weight_g, cost_price, making_charge_amount, floor_price, status, sold_at, created_at'),
    supabase.from('product_designs').select('id, name, design_code'),
    user ? supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const craftsmen = (cr.data ?? []) as any[]
  const jobs = (jr.data ?? []) as any[]
  const payments = (pr.data ?? []) as any[]
  const metalLots = (mlr.data ?? []) as any[]
  const metalTxns = (mtr.data ?? []) as any[]
  const stoneIssues = ((sir.data ?? []) as any[]).map((si) => {
    const s = si.stone_items
    if (!s) return { ...si, stone_items: null }
    const carat = Number(s.carat ?? 0)
    const rate = s.cost_per_carat != null ? Number(s.cost_per_carat) : null
    return { ...si, stone_items: { ...s, cost_price: rate != null ? rate * carat : null } }
  })
  const stoneReturns = (srr.data ?? []) as any[]
  const stoneItems = ((silr.data ?? []) as any[]).map((s) => {
    const carat = Number(s.carat ?? 0)
    const rate = s.cost_per_carat != null ? Number(s.cost_per_carat) : null
    return { ...s, cost_price: rate != null ? rate * carat : null }
  })
  const inventory = (invr.data ?? []) as any[]
  const designs = (dsr.data ?? []) as any[]
  const printedBy = prof.data?.full_name ?? null

  const TITLES: Record<Slug, { title: string; filename: string }> = {
    settlement: { title: 'Craftsman Settlement', filename: `Craftsman Settlement ${from}_${to}` },
    gold: { title: 'Gold Flow', filename: `Gold Flow ${from}_${to}` },
    stone: { title: 'Stone Flow', filename: `Stone Flow ${from}_${to}` },
    profitability: { title: 'Job Profitability', filename: `Profitability ${from}_${to}` },
    payments: { title: 'Payments Ledger', filename: `Payments ${from}_${to}` },
  }
  const meta = TITLES[slug as Slug]
  const subtitle = from || to ? `${from ? fmtDate(from) : '…'} → ${to ? fmtDate(to) : '…'}` : 'All time'

  const body = (() => {
    switch (slug as Slug) {
      case 'settlement':
        return <SettlementBody jobs={jobs} payments={payments} craftsmen={craftsmen} from={from} to={to} />
      case 'gold':
        return <GoldBody metalLots={metalLots} metalTxns={metalTxns} from={from} to={to} />
      case 'stone':
        return <StoneBody stoneIssues={stoneIssues} stoneReturns={stoneReturns} stoneItems={stoneItems} from={from} to={to} />
      case 'profitability':
        return <ProfitabilityBody jobs={jobs} inventory={inventory} designs={designs} craftsmen={craftsmen} metalTxns={metalTxns} metalLots={metalLots} stoneIssues={stoneIssues} from={from} to={to} />
      case 'payments':
        return <PaymentsBody payments={payments} craftsmen={craftsmen} jobs={jobs} from={from} to={to} />
    }
  })()

  return (
    <ReportPrintShell
      title={meta.title}
      subtitle={subtitle}
      filename={meta.filename}
      backHref="/reports/production"
      printedBy={printedBy}
    >
      {body}
    </ReportPrintShell>
  )
}

function SettlementBody({ jobs, payments, craftsmen, from, to }: any) {
  const cMap = new Map(craftsmen.map((c: any) => [c.id, c]))
  const completed = jobs.filter((j: any) => (j.status === 'completed' || j.status === 'delivered') && inRange(j.completed_at, from, to))
  const validPays = payments.filter((p: any) => !p.voided_at && inRange(p.payment_date, from, to))

  const by = new Map<string, any>()
  for (const j of completed) {
    const cur = by.get(j.craftsman_id) ?? { jobs: 0, issuedG: 0, returnedG: 0, finishedG: 0, wastageG: 0, earned: 0, paid: 0 }
    cur.jobs++; cur.issuedG += Number(j.issued_fine_g) || 0; cur.returnedG += Number(j.returned_fine_g) || 0
    cur.finishedG += Number(j.finished_fine_g) || 0; cur.wastageG += Number(j.wastage_fine_g) || 0
    cur.earned += Number(j.making_charge_amount) || 0
    by.set(j.craftsman_id, cur)
  }
  for (const p of validPays) {
    const cur = by.get(p.craftsman_id); if (cur) cur.paid += Number(p.amount) || 0
  }

  const rows = Array.from(by.entries()).map(([cid, m]) => {
    const c = cMap.get(cid) as any
    return { code: c?.code ?? '—', name: c?.name ?? '—', ...m, balance: m.earned - m.paid, wastagePct: m.issuedG > 0 ? (m.wastageG / m.issuedG) * 100 : 0 }
  }).sort((a: any, b: any) => b.balance - a.balance)

  const t = rows.reduce((a: any, r: any) => ({
    jobs: a.jobs + r.jobs, issuedG: a.issuedG + r.issuedG, returnedG: a.returnedG + r.returnedG,
    finishedG: a.finishedG + r.finishedG, wastageG: a.wastageG + r.wastageG,
    earned: a.earned + r.earned, paid: a.paid + r.paid, balance: a.balance + r.balance,
  }), { jobs: 0, issuedG: 0, returnedG: 0, finishedG: 0, wastageG: 0, earned: 0, paid: 0, balance: 0 })

  return (
    <>
      <div className="mb-3 grid grid-cols-4 gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs">
        <div><p className="text-[10px] uppercase text-slate-500">Craftsmen</p><p className="font-semibold tabular">{rows.length}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Jobs</p><p className="font-semibold tabular">{t.jobs}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Gold issued</p><p className="font-semibold tabular">{fmtG(t.issuedG)} g</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Outstanding</p><p className="font-semibold tabular text-rose-700">₹ {fmtMoney(t.balance)}</p></div>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-left">
            <th className="py-1 font-semibold">Craftsman</th>
            <th className="py-1 text-right font-semibold">Jobs</th>
            <th className="py-1 text-right font-semibold">Issued g</th>
            <th className="py-1 text-right font-semibold">Returned g</th>
            <th className="py-1 text-right font-semibold">Finished g</th>
            <th className="py-1 text-right font-semibold">Wastage g</th>
            <th className="py-1 text-right font-semibold">Wast %</th>
            <th className="py-1 text-right font-semibold">Earned ₹</th>
            <th className="py-1 text-right font-semibold">Paid ₹</th>
            <th className="py-1 text-right font-semibold">Balance ₹</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={10} className="py-4 text-center text-slate-500 italic">No completed jobs in range</td></tr>}
          {rows.map((r: any, i: number) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="py-1">{r.name} <span className="font-mono text-slate-500">({r.code})</span></td>
              <td className="py-1 text-right tabular">{r.jobs}</td>
              <td className="py-1 text-right tabular">{fmtG(r.issuedG)}</td>
              <td className="py-1 text-right tabular">{fmtG(r.returnedG)}</td>
              <td className="py-1 text-right tabular font-medium">{fmtG(r.finishedG)}</td>
              <td className="py-1 text-right tabular text-rose-700">{fmtG(r.wastageG)}</td>
              <td className="py-1 text-right tabular">{r.wastagePct.toFixed(1)}%</td>
              <td className="py-1 text-right tabular">{fmtMoney(r.earned)}</td>
              <td className="py-1 text-right tabular text-emerald-700">{fmtMoney(r.paid)}</td>
              <td className="py-1 text-right tabular font-semibold">{r.balance > 0.01 ? fmtMoney(r.balance) : '✓'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-semibold">
            <td className="py-1">Total</td>
            <td className="py-1 text-right tabular">{t.jobs}</td>
            <td className="py-1 text-right tabular">{fmtG(t.issuedG)}</td>
            <td className="py-1 text-right tabular">{fmtG(t.returnedG)}</td>
            <td className="py-1 text-right tabular">{fmtG(t.finishedG)}</td>
            <td className="py-1 text-right tabular text-rose-700">{fmtG(t.wastageG)}</td>
            <td className="py-1 text-right tabular">{t.issuedG > 0 ? `${((t.wastageG / t.issuedG) * 100).toFixed(1)}%` : '—'}</td>
            <td className="py-1 text-right tabular">₹{fmtMoney(t.earned)}</td>
            <td className="py-1 text-right tabular text-emerald-700">₹{fmtMoney(t.paid)}</td>
            <td className="py-1 text-right tabular">₹{fmtMoney(t.balance)}</td>
          </tr>
        </tfoot>
      </table>
    </>
  )
}

function GoldBody({ metalLots, metalTxns, from, to }: any) {
  const filtered = metalTxns.filter((t: any) => inRange(t.created_at, from, to))
  const rows = metalLots.map((lot: any) => {
    const lt = filtered.filter((t: any) => t.metal_lot_id === lot.metal_lot_id)
    const inG = lt.reduce((a: number, t: any) => a + (Number(t.fine_weight_change_g) > 0 ? Number(t.fine_weight_change_g) : 0), 0)
    const outG = lt.reduce((a: number, t: any) => a + (Number(t.fine_weight_change_g) < 0 ? Number(t.fine_weight_change_g) : 0), 0)
    return { lot_number: lot.lot_number, purity: lot.purity_code ?? '—', opening: Number(lot.opening_fine_weight_g) || 0, inG, outG, balance: Number(lot.balance_fine_g) || 0, rate: Number(lot.rate_per_gram) || 0, movements: lt.length }
  })
  const t = rows.reduce((a: any, r: any) => ({ opening: a.opening + r.opening, inG: a.inG + r.inG, outG: a.outG + r.outG, balance: a.balance + r.balance }), { opening: 0, inG: 0, outG: 0, balance: 0 })

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-slate-400 text-left">
          <th className="py-1 font-semibold">Lot</th>
          <th className="py-1 font-semibold">Purity</th>
          <th className="py-1 text-right font-semibold">Opening g</th>
          <th className="py-1 text-right font-semibold">In g</th>
          <th className="py-1 text-right font-semibold">Out g</th>
          <th className="py-1 text-right font-semibold">Balance g</th>
          <th className="py-1 text-right font-semibold">Rate ₹/g</th>
          <th className="py-1 text-right font-semibold">Value ₹</th>
          <th className="py-1 text-right font-semibold">Mvts</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={9} className="py-4 text-center text-slate-500 italic">No lots</td></tr>}
        {rows.map((r: any, i: number) => (
          <tr key={i} className="border-b border-slate-200">
            <td className="py-1 font-mono">{r.lot_number}</td>
            <td className="py-1">{r.purity}</td>
            <td className="py-1 text-right tabular">{fmtG(r.opening)}</td>
            <td className="py-1 text-right tabular text-emerald-700">{r.inG > 0 ? `+${fmtG(r.inG)}` : '—'}</td>
            <td className="py-1 text-right tabular text-rose-700">{r.outG < 0 ? fmtG(r.outG) : '—'}</td>
            <td className="py-1 text-right tabular font-semibold">{fmtG(r.balance)}</td>
            <td className="py-1 text-right tabular">{fmtMoney(r.rate)}</td>
            <td className="py-1 text-right tabular">{fmtMoney(r.balance * r.rate)}</td>
            <td className="py-1 text-right tabular text-slate-500">{r.movements}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-400 font-semibold">
          <td colSpan={2} className="py-1">Total</td>
          <td className="py-1 text-right tabular">{fmtG(t.opening)}</td>
          <td className="py-1 text-right tabular text-emerald-700">+{fmtG(t.inG)}</td>
          <td className="py-1 text-right tabular text-rose-700">{fmtG(t.outG)}</td>
          <td className="py-1 text-right tabular">{fmtG(t.balance)}</td>
          <td colSpan={3} />
        </tr>
      </tfoot>
    </table>
  )
}

function StoneBody({ stoneIssues, stoneReturns, stoneItems, from, to }: any) {
  const iss = stoneIssues.filter((si: any) => inRange(si.issued_at, from, to))
  const ret = stoneReturns.filter((sr: any) => inRange(sr.received_at, from, to))
  const byStatus = new Map<string, { pcs: number; ct: number; cost: number }>()
  for (const s of stoneItems) {
    const cur = byStatus.get(s.status) ?? { pcs: 0, ct: 0, cost: 0 }
    cur.pcs++; cur.ct += Number(s.carat) || 0; cur.cost += Number(s.cost_price) || 0
    byStatus.set(s.status, cur)
  }
  const issuedCt = iss.reduce((a: number, si: any) => a + Number(si.stone_items?.carat ?? 0), 0)
  const returnedCt = ret.reduce((a: number, sr: any) => a + Number(sr.carat_returned ?? 0), 0)

  return (
    <>
      <div className="mb-3 grid grid-cols-4 gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs">
        <div><p className="text-[10px] uppercase text-slate-500">Total stones</p><p className="font-semibold tabular">{stoneItems.length}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Issued in range</p><p className="font-semibold tabular">{iss.length} pcs · {fmtCt(issuedCt)} ct</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Returned</p><p className="font-semibold tabular text-emerald-700">{ret.length} pcs · {fmtCt(returnedCt)} ct</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">On job</p><p className="font-semibold tabular text-amber-700">{stoneItems.filter((s: any) => s.status === 'issued_to_job').length}</p></div>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-left">
            <th className="py-1 font-semibold">Status</th>
            <th className="py-1 text-right font-semibold">Pieces</th>
            <th className="py-1 text-right font-semibold">Carats</th>
            <th className="py-1 text-right font-semibold">Cost ₹</th>
          </tr>
        </thead>
        <tbody>
          {byStatus.size === 0 && <tr><td colSpan={4} className="py-4 text-center text-slate-500 italic">No stones in inventory</td></tr>}
          {Array.from(byStatus.entries()).sort((a, b) => b[1].pcs - a[1].pcs).map(([status, s]) => (
            <tr key={status} className="border-b border-slate-200">
              <td className="py-1 capitalize">{status.replace(/_/g, ' ')}</td>
              <td className="py-1 text-right tabular">{s.pcs}</td>
              <td className="py-1 text-right tabular">{fmtCt(s.ct)}</td>
              <td className="py-1 text-right tabular">₹ {fmtMoney(s.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function ProfitabilityBody({ jobs, inventory, designs, craftsmen, metalTxns, metalLots, stoneIssues, from, to }: any) {
  const dMap = new Map(designs.map((d: any) => [d.id, d]))
  const cMap = new Map(craftsmen.map((c: any) => [c.id, c]))
  const lotMap = new Map(metalLots.map((l: any) => [l.metal_lot_id, l]))

  const rows = jobs.filter((j: any) => (j.status === 'completed' || j.status === 'delivered') && inRange(j.completed_at, from, to)).map((j: any) => {
    const issues = metalTxns.filter((t: any) => t.txn_type === 'issue_to_job' && t.reference_id === j.id)
    const totFine = issues.reduce((a: number, t: any) => a + Math.abs(Number(t.fine_weight_change_g) || 0), 0)
    const totCost = issues.reduce((a: number, t: any) => {
      const lot = lotMap.get(t.metal_lot_id) as any
      return a + Math.abs(Number(t.fine_weight_change_g) || 0) * (Number(lot?.rate_per_gram) || 0)
    }, 0)
    const weightedRate = totFine > 0 ? totCost / totFine : 0
    const finG = Number(j.finished_fine_g) || 0
    const metalCost = finG * weightedRate
    const stones = stoneIssues.filter((si: any) => si.job_id === j.id && si.stone_items?.status === 'mounted')
    const stoneCost = stones.reduce((a: number, si: any) => a + (Number(si.stone_items?.cost_price) || 0), 0)
    const stoneCt = stones.reduce((a: number, si: any) => a + (Number(si.stone_items?.carat) || 0), 0)
    const labour = Number(j.making_charge_amount) || 0
    const total = metalCost + stoneCost + labour
    const inv = inventory.find((i: any) => i.craftsman_job_id === j.id)
    const floor = Number(inv?.floor_price ?? 0)
    const d = j.design_id ? (dMap.get(j.design_id) as any) : null
    const c = cMap.get(j.craftsman_id) as any
    return { job_number: j.job_number, design: d?.name ?? '—', design_code: d?.design_code ?? '—', craftsman: c?.name ?? '—', completed: j.completed_at, finG, metalCost, stoneCost, stonePcs: stones.length, stoneCt, labour, total, floor }
  }).sort((a: any, b: any) => (b.completed ?? '').localeCompare(a.completed ?? ''))

  const t = rows.reduce((a: any, r: any) => ({ finG: a.finG + r.finG, metal: a.metal + r.metalCost, stones: a.stones + r.stoneCost, labour: a.labour + r.labour, total: a.total + r.total, floor: a.floor + r.floor }), { finG: 0, metal: 0, stones: 0, labour: 0, total: 0, floor: 0 })

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-slate-400 text-left">
          <th className="py-1 font-semibold">Job</th>
          <th className="py-1 font-semibold">Design</th>
          <th className="py-1 font-semibold">Craftsman</th>
          <th className="py-1 font-semibold">Done</th>
          <th className="py-1 text-right font-semibold">Finished g</th>
          <th className="py-1 text-right font-semibold">Metal ₹</th>
          <th className="py-1 text-right font-semibold">Stones ₹</th>
          <th className="py-1 text-right font-semibold">Labour ₹</th>
          <th className="py-1 text-right font-semibold">Total ₹</th>
          <th className="py-1 text-right font-semibold">Floor ₹</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={10} className="py-4 text-center text-slate-500 italic">No completed jobs in range</td></tr>}
        {rows.map((r: any, i: number) => (
          <tr key={i} className="border-b border-slate-200">
            <td className="py-1 font-mono">{r.job_number}</td>
            <td className="py-1">{r.design} <span className="text-slate-500 text-[10px]">{r.design_code}</span></td>
            <td className="py-1">{r.craftsman}</td>
            <td className="py-1">{fmtDate(r.completed)}</td>
            <td className="py-1 text-right tabular">{fmtG(r.finG)}</td>
            <td className="py-1 text-right tabular">{fmtMoney(r.metalCost)}</td>
            <td className="py-1 text-right tabular">{fmtMoney(r.stoneCost)}<span className="text-[9px] text-slate-500"> · {r.stonePcs}pc</span></td>
            <td className="py-1 text-right tabular">{fmtMoney(r.labour)}</td>
            <td className="py-1 text-right tabular font-semibold">{fmtMoney(r.total)}</td>
            <td className="py-1 text-right tabular">{r.floor > 0 ? fmtMoney(r.floor) : '—'}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-400 font-semibold">
          <td colSpan={4} className="py-1">Total · {rows.length} jobs</td>
          <td className="py-1 text-right tabular">{fmtG(t.finG)}</td>
          <td className="py-1 text-right tabular">₹{fmtMoney(t.metal)}</td>
          <td className="py-1 text-right tabular">₹{fmtMoney(t.stones)}</td>
          <td className="py-1 text-right tabular">₹{fmtMoney(t.labour)}</td>
          <td className="py-1 text-right tabular">₹{fmtMoney(t.total)}</td>
          <td className="py-1 text-right tabular">₹{fmtMoney(t.floor)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function PaymentsBody({ payments, craftsmen, jobs, from, to }: any) {
  const cMap = new Map(craftsmen.map((c: any) => [c.id, c]))
  const jMap = new Map(jobs.map((j: any) => [j.id, j]))
  const rows = payments.filter((p: any) => inRange(p.payment_date, from, to)).sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date))
  const active = rows.filter((p: any) => !p.voided_at)
  const totalActive = active.reduce((a: number, p: any) => a + Number(p.amount), 0)

  return (
    <>
      <div className="mb-3 grid grid-cols-4 gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs">
        <div><p className="text-[10px] uppercase text-slate-500">Entries</p><p className="font-semibold tabular">{rows.length}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Active</p><p className="font-semibold tabular">{active.length}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Voided</p><p className="font-semibold tabular text-rose-700">{rows.length - active.length}</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Total paid</p><p className="font-semibold tabular text-emerald-700">₹ {fmtMoney(totalActive)}</p></div>
      </div>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-left">
            <th className="py-1 font-semibold">Date</th>
            <th className="py-1 font-semibold">Craftsman</th>
            <th className="py-1 font-semibold">Job</th>
            <th className="py-1 font-semibold">Method</th>
            <th className="py-1 font-semibold">Ref</th>
            <th className="py-1 text-right font-semibold">Amount ₹</th>
            <th className="py-1 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-slate-500 italic">No payments in range</td></tr>}
          {rows.map((p: any, i: number) => {
            const c = cMap.get(p.craftsman_id) as any
            const j = p.job_id ? (jMap.get(p.job_id) as any) : null
            const voided = !!p.voided_at
            return (
              <tr key={i} className={`border-b border-slate-200 ${voided ? 'text-slate-400 line-through' : ''}`}>
                <td className="py-1">{fmtDate(p.payment_date)}</td>
                <td className="py-1">{c?.name ?? '—'} <span className="text-[10px] text-slate-500">({c?.code ?? '—'})</span></td>
                <td className="py-1 font-mono">{j?.job_number ?? 'advance'}</td>
                <td className="py-1 capitalize">{p.payment_method.replace(/_/g, ' ')}</td>
                <td className="py-1 font-mono text-[10px]">{p.reference ?? '—'}</td>
                <td className="py-1 text-right tabular font-semibold">{fmtMoney(p.amount)}</td>
                <td className="py-1 text-[10px]">{voided ? `VOID: ${p.void_reason ?? ''}` : (p.notes ?? '—')}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-semibold">
            <td colSpan={5} className="py-1">Total (active only)</td>
            <td className="py-1 text-right tabular">₹{fmtMoney(totalActive)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </>
  )
}