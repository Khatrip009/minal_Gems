import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import {
  FileText,
  Gem,
  Coins,
  Package,
  Wrench,
  IndianRupee,
} from 'lucide-react'

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
const fmtInt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-IN') : '0'
}
const fmtDate = () =>
  new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

type MetalRow = {
  purity: string
  purity_percent: number
  lots: number
  fine_g: number
  weighted_rate: number
  value: number
}

type StoneRow = {
  category: string
  shape: string
  color: string
  clarity: string
  cut: string
  pcs: number
  ct: number
  cost: number
  sell: number
}

type FGRow = {
  id: string
  tag: string
  design: string
  design_code: string
  category: string
  purity: string
  net_g: number
  fine_g: number
  stone_pcs: number
  stone_ct: number
  cost: number
  floor: number
  status: string
}

type WipRow = {
  job_number: string
  craftsman: string
  craftsman_code: string
  status: string
  metal_fine_held: number
  metal_value: number
  stone_ct_on_job: number
  expected_finish_g: number
}

export default async function StockSummaryPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [
    metalLotsRes,
    stonesRes,
    invRes,
    wipJobsRes,
    wipMetalRes,
    stoneOnJobRes,
  ] = await Promise.all([
    supabase
      .from('v_metal_lot_balances')
      .select(
        'metal_lot_id, lot_number, purity_code, purity_percent, balance_fine_g, rate_per_gram',
      )
      .gt('balance_fine_g', 0),
    supabase
      .from('stone_items')
      .select(
        'id, carat, cost_per_carat, selling_per_carat, shape, color, clarity, cut, stone_master ( category, shape, color, clarity, cut )',
      )
      .eq('status', 'available'),
    supabase
      .from('inventory_items')
      .select(
        `
        id, inventory_tag, status,
        net_metal_weight_g, net_fine_weight_g,
        cost_price, floor_price,
        stone_pcs_total, stone_carat_total,
        metal_purities ( code ),
        product_variants (
          product_designs (
            name, design_code,
            categories ( name )
          )
        )
      `,
      )
      .in('status', ['available', 'reserved', 'allocated', 'in_repair']),
    supabase
      .from('craftsman_jobs')
      .select(
        'id, job_number, status, expected_finished_weight_g, craftsmen ( name, code )',
      )
      .in('status', ['pending', 'in_progress']),
    supabase
      .from('metal_transactions')
      .select('reference_id, txn_type, fine_weight_change_g')
      .eq('reference_type', 'craftsman_job'),
    supabase
      .from('stone_items')
      .select('carat, cost_per_carat')
      .eq('status', 'issued_to_job'),
  ])

  if (metalLotsRes.error || stonesRes.error || invRes.error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        Data load failed:{' '}
        {metalLotsRes.error?.message ??
          stonesRes.error?.message ??
          invRes.error?.message}
      </div>
    )
  }

  // ── Metal aggregation by purity ──
  const metalByPurity = new Map<string, MetalRow & { weighted_sum: number }>()
  for (const l of metalLotsRes.data ?? []) {
    const key = l.purity_code ?? '—'
    const cur =
      metalByPurity.get(key) ??
      ({
        purity: key,
        purity_percent: Number(l.purity_percent ?? 0),
        lots: 0,
        fine_g: 0,
        weighted_rate: 0,
        value: 0,
        weighted_sum: 0,
      } as MetalRow & { weighted_sum: number })
    cur.lots++
    const fine = Number(l.balance_fine_g ?? 0)
    cur.fine_g += fine
    cur.weighted_sum += fine * Number(l.rate_per_gram ?? 0)
    metalByPurity.set(key, cur)
  }
  const metalRows: MetalRow[] = Array.from(metalByPurity.values())
    .map((r) => ({
      ...r,
      weighted_rate: r.fine_g > 0 ? r.weighted_sum / r.fine_g : 0,
      value: r.weighted_sum,
    }))
    .sort((a, b) => b.value - a.value)

  const totalMetalFine = metalRows.reduce((s, r) => s + r.fine_g, 0)
  const totalMetalValue = metalRows.reduce((s, r) => s + r.value, 0)
  const avgMetalRate = totalMetalFine > 0 ? totalMetalValue / totalMetalFine : 0

  // ── Stone aggregation by 4Cs ──
  const stoneBy4C = new Map<string, StoneRow>()
  for (const s of stonesRes.data ?? []) {
    const sm = (s.stone_master as any) ?? null
    const cat = sm?.category ?? '—'
    const shape = s.shape ?? sm?.shape ?? '—'
    const color = s.color ?? sm?.color ?? '—'
    const clarity = s.clarity ?? sm?.clarity ?? '—'
    const cut = s.cut ?? sm?.cut ?? '—'
    const key = [cat, shape, color, clarity, cut].join('|')
    const ct = Number(s.carat ?? 0)
    const costRate = Number(s.cost_per_carat ?? 0)
    const sellRate = Number(s.selling_per_carat ?? 0)
    const cur =
      stoneBy4C.get(key) ??
      ({
        category: cat,
        shape,
        color,
        clarity,
        cut,
        pcs: 0,
        ct: 0,
        cost: 0,
        sell: 0,
      } as StoneRow)
    cur.pcs++
    cur.ct += ct
    cur.cost += costRate * ct
    cur.sell += sellRate * ct
    stoneBy4C.set(key, cur)
  }
  const stoneRows = Array.from(stoneBy4C.values()).sort((a, b) => b.cost - a.cost)
  const totalStonePcs = stoneRows.reduce((s, r) => s + r.pcs, 0)
  const totalStoneCt = stoneRows.reduce((s, r) => s + r.ct, 0)
  const totalStoneCost = stoneRows.reduce((s, r) => s + r.cost, 0)
  const totalStoneSell = stoneRows.reduce((s, r) => s + r.sell, 0)

  // ── FG list ──
  const fgRows: FGRow[] = (invRes.data ?? []).map((row: any) => {
    const design = row.product_variants?.product_designs
    return {
      id: row.id,
      tag: row.inventory_tag,
      design: design?.name ?? '—',
      design_code: design?.design_code ?? '—',
      category: design?.categories?.name ?? '—',
      purity: row.metal_purities?.code ?? '—',
      net_g: Number(row.net_metal_weight_g ?? 0),
      fine_g: Number(row.net_fine_weight_g ?? 0),
      stone_pcs: Number(row.stone_pcs_total ?? 0),
      stone_ct: Number(row.stone_carat_total ?? 0),
      cost: Number(row.cost_price ?? 0),
      floor: Number(row.floor_price ?? 0),
      status: row.status,
    }
  })
  fgRows.sort((a, b) => b.cost - a.cost)
  const totalFgCost = fgRows.reduce((s, r) => s + r.cost, 0)
  const totalFgFloor = fgRows.reduce((s, r) => s + r.floor, 0)
  const totalFgFineG = fgRows.reduce((s, r) => s + r.fine_g, 0)
  const totalFgStonePcs = fgRows.reduce((s, r) => s + r.stone_pcs, 0)
  const totalFgStoneCt = fgRows.reduce((s, r) => s + r.stone_ct, 0)

  // ── WIP ──
  const wipJobs = (wipJobsRes.data ?? []) as any[]
  const wipJobIds = new Set(wipJobs.map((j) => j.id))

  // Net metal held per job = -(sum of fine change). Positive = metal in hand.
  const metalHeldByJob = new Map<string, number>()
  for (const tx of wipMetalRes.data ?? []) {
    if (!wipJobIds.has(tx.reference_id)) continue
    const cur = metalHeldByJob.get(tx.reference_id) ?? 0
    metalHeldByJob.set(tx.reference_id, cur + Number(tx.fine_weight_change_g ?? 0))
  }

  const wipRows: WipRow[] = wipJobs.map((j) => {
    const netFineChange = metalHeldByJob.get(j.id) ?? 0
    const metalHeld = Math.max(0, -netFineChange) // issue is negative, so negate
    const craftsman = j.craftsmen
    return {
      job_number: j.job_number,
      craftsman: craftsman?.name ?? '—',
      craftsman_code: craftsman?.code ?? '—',
      status: j.status,
      metal_fine_held: metalHeld,
      metal_value: metalHeld * avgMetalRate,
      stone_ct_on_job: 0, // stone on job total computed globally below
      expected_finish_g: Number(j.expected_finished_weight_g ?? 0),
    }
  })

  const totalWipMetalFine = wipRows.reduce((s, r) => s + r.metal_fine_held, 0)
  const totalWipMetalValue = wipRows.reduce((s, r) => s + r.metal_value, 0)

  // Stones on job — global totals
  const stonesOnJobData = (stoneOnJobRes.data ?? []) as any[]
  const totalStonesOnJobCt = stonesOnJobData.reduce(
    (s, x) => s + Number(x.carat ?? 0),
    0,
  )
  const totalStonesOnJobCost = stonesOnJobData.reduce(
    (s, x) =>
      s + Number(x.cost_per_carat ?? 0) * Number(x.carat ?? 0),
    0,
  )

  const totalWipValue = totalWipMetalValue + totalStonesOnJobCost

  // ── Grand totals ──
  const grandTotal =
    totalMetalValue + totalStoneCost + totalFgCost + totalWipValue

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
            <h1 className="text-2xl font-semibold">Stock Summary</h1>
            <p className="mt-1 text-sm text-slate-500">
              Everything owned across metal, stones, finished goods, and
              work-in-progress · as of {fmtDate()}
            </p>
          </div>
          <a
            href="/reports/print/stock-summary"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          >
            <FileText className="h-3.5 w-3.5" /> Export PDF
          </a>
        </div>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi
          label="Metal stock"
          value={totalMetalValue}
          sub={`${fmtG(totalMetalFine)} g fine`}
          icon={Coins}
          tone="amber"
        />
        <Kpi
          label="Stone stock"
          value={totalStoneCost}
          sub={`${fmtInt(totalStonePcs)} pcs · ${fmtCt(totalStoneCt)} ct`}
          icon={Gem}
          tone="sky"
        />
        <Kpi
          label="Finished goods"
          value={totalFgCost}
          sub={`${fgRows.length} pieces`}
          icon={Package}
          tone="emerald"
        />
        <Kpi
          label="WIP"
          value={totalWipValue}
          sub={`${wipRows.length} open jobs`}
          icon={Wrench}
          tone="rose"
        />
        <Kpi
          label="Grand total"
          value={grandTotal}
          sub="Cost basis"
          icon={IndianRupee}
          tone="slate"
          bold
        />
      </div>

      {/* METAL */}
      <Section
        title={`Metal stock · ${metalRows.length} purity${metalRows.length === 1 ? '' : 'ies'} · ${fmtG(totalMetalFine)} g`}
        total={totalMetalValue}
        icon={Coins}
      >
        {metalRows.length === 0 ? (
          <EmptyRow text="No metal stock in hand." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <Th>Purity</Th>
                <Th align="right">Lots</Th>
                <Th align="right">Fine (g)</Th>
                <Th align="right">Weighted rate / g</Th>
                <Th align="right">Value</Th>
              </tr>
            </thead>
            <tbody>
              {metalRows.map((r) => (
                <tr
                  key={r.purity}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{r.purity}</span>
                    {r.purity_percent > 0 && (
                      <span className="ml-2 text-xs text-slate-500">
                        {r.purity_percent.toFixed(2)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular">{r.lots}</td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtG(r.fine_g)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular text-slate-600">
                    ₹ {fmtMoney(r.weighted_rate)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold tabular">
                    ₹ {fmtMoney(r.value)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase text-slate-500">
                  Total metal
                </td>
                <td className="px-4 py-2 text-right font-mono tabular">
                  {fmtG(totalMetalFine)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular text-slate-600">
                  ₹ {fmtMoney(avgMetalRate)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular text-brand-700">
                  ₹ {fmtMoney(totalMetalValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </Section>

      {/* STONES */}
      <Section
        title={`Stone stock · ${stoneRows.length} group${stoneRows.length === 1 ? '' : 's'} · ${fmtInt(totalStonePcs)} pcs · ${fmtCt(totalStoneCt)} ct`}
        total={totalStoneCost}
        icon={Gem}
      >
        {stoneRows.length === 0 ? (
          <EmptyRow text="No loose stones available." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <Th>Type</Th>
                <Th>Shape</Th>
                <Th>Color</Th>
                <Th>Clarity</Th>
                <Th>Cut</Th>
                <Th align="right">Pcs</Th>
                <Th align="right">Carat</Th>
                <Th align="right">Cost</Th>
                <Th align="right">Sell value</Th>
              </tr>
            </thead>
            <tbody>
              {stoneRows.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2 capitalize">{r.category}</td>
                  <td className="px-4 py-2 text-slate-700">{r.shape}</td>
                  <td className="px-4 py-2 text-slate-700">{r.color}</td>
                  <td className="px-4 py-2 text-slate-700">{r.clarity}</td>
                  <td className="px-4 py-2 text-slate-700">{r.cut}</td>
                  <td className="px-4 py-2 text-right tabular">{r.pcs}</td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtCt(r.ct)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    ₹ {fmtMoney(r.cost)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular text-slate-500">
                    ₹ {fmtMoney(r.sell)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td colSpan={5} className="px-4 py-2 text-right text-xs uppercase text-slate-500">
                  Total stones
                </td>
                <td className="px-4 py-2 text-right tabular">
                  {fmtInt(totalStonePcs)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular">
                  {fmtCt(totalStoneCt)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular text-brand-700">
                  ₹ {fmtMoney(totalStoneCost)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular text-slate-500">
                  ₹ {fmtMoney(totalStoneSell)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </Section>

      {/* FINISHED GOODS */}
      <Section
        title={`Finished goods · ${fgRows.length} piece${fgRows.length === 1 ? '' : 's'}`}
        total={totalFgCost}
        icon={Package}
      >
        {fgRows.length === 0 ? (
          <EmptyRow text="No finished goods in stock." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <Th>Tag</Th>
                <Th>Design</Th>
                <Th>Category</Th>
                <Th>Purity</Th>
                <Th align="right">Net (g)</Th>
                <Th align="right">Fine (g)</Th>
                <Th align="right">Stones</Th>
                <Th align="right">Cost</Th>
                <Th align="right">Floor</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {fgRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link
                      href={`/inventory/${r.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {r.tag}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <p className="text-slate-800">{r.design}</p>
                    <p className="font-mono text-[10px] text-slate-500">
                      {r.design_code}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {r.category}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.purity}</td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtG(r.net_g)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular">
                    {fmtG(r.fine_g)}
                  </td>
                  <td className="px-4 py-2 text-right text-xs tabular">
                    {r.stone_pcs} · {fmtCt(r.stone_ct)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold tabular">
                    ₹ {fmtMoney(r.cost)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular text-slate-600">
                    {r.floor > 0 ? `₹ ${fmtMoney(r.floor)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs capitalize text-slate-600">
                    {r.status.replace(/_/g, ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td colSpan={4} className="px-4 py-2 text-right text-xs uppercase text-slate-500">
                  Total FG
                </td>
                <td className="px-4 py-2 text-right font-mono tabular">
                  {fmtG(fgRows.reduce((s, r) => s + r.net_g, 0))}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular">
                  {fmtG(totalFgFineG)}
                </td>
                <td className="px-4 py-2 text-right text-xs tabular">
                  {fmtInt(totalFgStonePcs)} · {fmtCt(totalFgStoneCt)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular text-brand-700">
                  ₹ {fmtMoney(totalFgCost)}
                </td>
                <td className="px-4 py-2 text-right font-mono tabular text-slate-600">
                  ₹ {fmtMoney(totalFgFloor)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </Section>

      {/* WIP */}
      <Section
        title={`Work in progress · ${wipRows.length} job${wipRows.length === 1 ? '' : 's'}`}
        total={totalWipValue}
        icon={Wrench}
      >
        {wipRows.length === 0 ? (
          <EmptyRow text="No open jobs — nothing with a craftsman." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <Th>Job</Th>
                  <Th>Craftsman</Th>
                  <Th>Status</Th>
                  <Th align="right">Metal held (g)</Th>
                  <Th align="right">Metal value</Th>
                  <Th align="right">Target finish (g)</Th>
                </tr>
              </thead>
              <tbody>
                {wipRows.map((r) => (
                  <tr
                    key={r.job_number}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      {r.job_number}
                    </td>
                    <td className="px-4 py-2">
                      {r.craftsman}
                      <span className="ml-2 font-mono text-[10px] text-slate-500">
                        {r.craftsman_code}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs capitalize text-slate-600">
                      {r.status.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular">
                      {fmtG(r.metal_fine_held)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold tabular">
                      ₹ {fmtMoney(r.metal_value)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono tabular text-slate-600">
                      {r.expected_finish_g > 0
                        ? fmtG(r.expected_finish_g)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
              <div className="flex flex-wrap justify-between gap-3">
                <span>
                  Metal held: <strong>{fmtG(totalWipMetalFine)} g</strong> · ₹{' '}
                  {fmtMoney(totalWipMetalValue)}
                </span>
                <span>
                  Stones on job: <strong>{fmtCt(totalStonesOnJobCt)} ct</strong>{' '}
                  · ₹ {fmtMoney(totalStonesOnJobCost)}
                </span>
                <span className="font-semibold text-brand-700">
                  WIP total: ₹ {fmtMoney(totalWipValue)}
                </span>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* GRAND TOTAL */}
      <div className="rounded-xl border border-slate-300 bg-slate-900 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">
              Total stock on hand
            </p>
            <p className="mt-1 text-3xl font-bold tabular">
              ₹ {fmtMoney(grandTotal)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <TotalLine label="Metal" value={totalMetalValue} />
            <TotalLine label="Stones" value={totalStoneCost} />
            <TotalLine label="FG" value={totalFgCost} />
            <TotalLine label="WIP" value={totalWipValue} />
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Valuation is <strong>cost basis</strong> — metal at lot rate, stones at
        cost per carat, finished goods at recorded cost, WIP at weighted average
        metal rate + cost of stones issued. Sale value, if any, differs. Stones
        already mounted on finished goods are included in their FG cost and are
        not double-counted in the stone section. Stones on open jobs are counted
        in WIP.
      </p>
    </div>
  )
}

// ── Small primitives ───────────────────────────────────────────────

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

function Section({
  title,
  total,
  icon: Icon,
  children,
}: {
  title: string
  total: number
  icon: any
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-500" />
          <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
            {title}
          </p>
        </div>
        <p className="font-mono text-sm font-semibold tabular text-slate-900">
          ₹ {fmtMoney(total)}
        </p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="px-4 py-8 text-center text-sm italic text-slate-500">
      {text}
    </p>
  )
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  bold,
}: {
  label: string
  value: number
  sub?: string
  icon: any
  tone: 'amber' | 'sky' | 'emerald' | 'rose' | 'slate'
  bold?: boolean
}) {
  const toneMap: Record<typeof tone, string> = {
    amber: 'text-amber-700 bg-amber-50',
    sky: 'text-sky-700 bg-sky-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    rose: 'text-rose-700 bg-rose-50',
    slate: 'text-slate-700 bg-slate-100',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${toneMap[tone]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p
        className={`mt-1.5 tabular ${
          bold ? 'text-2xl font-bold' : 'text-xl font-semibold'
        } text-slate-900`}
      >
        ₹ {fmtMoney(value)}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>}
    </div>
  )
}

function TotalLine({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 font-mono tabular">₹ {fmtMoney(value)}</p>
    </div>
  )
}