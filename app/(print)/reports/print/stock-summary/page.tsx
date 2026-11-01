import { requireRole } from '@/lib/guard'
import { ReportPrintShell } from '@/components/primitives/report-print-shell'

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

export default async function StockSummaryPrintPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [metalLotsRes, stonesRes, invRes, wipJobsRes, wipMetalRes, stoneOnJobRes, prof] =
    await Promise.all([
      supabase
        .from('v_metal_lot_balances')
        .select('purity_code, purity_percent, balance_fine_g, rate_per_gram')
        .gt('balance_fine_g', 0),
      supabase
        .from('stone_items')
        .select(
          'carat, cost_per_carat, selling_per_carat, shape, color, clarity, cut, stone_master ( category, shape, color, clarity, cut )',
        )
        .eq('status', 'available'),
      supabase
        .from('inventory_items')
        .select(
          `id, inventory_tag, status, net_metal_weight_g, net_fine_weight_g, cost_price, floor_price, stone_pcs_total, stone_carat_total, metal_purities ( code ), product_variants ( product_designs ( name, design_code, categories ( name ) ) )`,
        )
        .in('status', ['available', 'reserved', 'allocated', 'in_repair']),
      supabase
        .from('craftsman_jobs')
        .select('id, job_number, status, expected_finished_weight_g, craftsmen ( name, code )')
        .in('status', ['pending', 'in_progress']),
      supabase
        .from('metal_transactions')
        .select('reference_id, fine_weight_change_g')
        .eq('reference_type', 'craftsman_job'),
      supabase.from('stone_items').select('carat, cost_per_carat').eq('status', 'issued_to_job'),
      user
        ? supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  // Metal by purity
  const metalByPurity = new Map<string, any>()
  for (const l of metalLotsRes.data ?? []) {
    const key = l.purity_code ?? '—'
    const cur =
      metalByPurity.get(key) ??
      { purity: key, pct: Number(l.purity_percent ?? 0), lots: 0, fine: 0, wsum: 0 }
    cur.lots++
    const f = Number(l.balance_fine_g ?? 0)
    cur.fine += f
    cur.wsum += f * Number(l.rate_per_gram ?? 0)
    metalByPurity.set(key, cur)
  }
  const metalRows = Array.from(metalByPurity.values())
    .map((r) => ({ ...r, value: r.wsum }))
    .sort((a, b) => b.value - a.value)
  const totalMetalFine = metalRows.reduce((s, r) => s + r.fine, 0)
  const totalMetalValue = metalRows.reduce((s, r) => s + r.value, 0)
  const avgMetalRate = totalMetalFine > 0 ? totalMetalValue / totalMetalFine : 0

  // Stones
  const stonesBy4C = new Map<string, any>()
  for (const s of stonesRes.data ?? []) {
    const sm = (s.stone_master as any) ?? null
    const key = [sm?.category, s.shape ?? sm?.shape, s.color ?? sm?.color, s.clarity ?? sm?.clarity, s.cut ?? sm?.cut].join('|')
    const ct = Number(s.carat ?? 0)
    const cur =
      stonesBy4C.get(key) ??
      { category: sm?.category ?? '—', shape: s.shape ?? sm?.shape ?? '—', color: s.color ?? sm?.color ?? '—', clarity: s.clarity ?? sm?.clarity ?? '—', cut: s.cut ?? sm?.cut ?? '—', pcs: 0, ct: 0, cost: 0 }
    cur.pcs++
    cur.ct += ct
    cur.cost += Number(s.cost_per_carat ?? 0) * ct
    stonesBy4C.set(key, cur)
  }
  const stoneRows = Array.from(stonesBy4C.values()).sort((a, b) => b.cost - a.cost)
  const totalStonePcs = stoneRows.reduce((s, r) => s + r.pcs, 0)
  const totalStoneCt = stoneRows.reduce((s, r) => s + r.ct, 0)
  const totalStoneCost = stoneRows.reduce((s, r) => s + r.cost, 0)

  // FG
  const fgRows = (invRes.data ?? []).map((row: any) => {
    const d = row.product_variants?.product_designs
    return {
      tag: row.inventory_tag,
      design: d?.name ?? '—',
      category: d?.categories?.name ?? '—',
      purity: row.metal_purities?.code ?? '—',
      net_g: Number(row.net_metal_weight_g ?? 0),
      fine_g: Number(row.net_fine_weight_g ?? 0),
      stone_pcs: Number(row.stone_pcs_total ?? 0),
      stone_ct: Number(row.stone_carat_total ?? 0),
      cost: Number(row.cost_price ?? 0),
      floor: Number(row.floor_price ?? 0),
      status: row.status,
    }
  }).sort((a, b) => b.cost - a.cost)
  const totalFgCost = fgRows.reduce((s, r) => s + r.cost, 0)
  const totalFgFloor = fgRows.reduce((s, r) => s + r.floor, 0)

  // WIP
  const wipJobs = (wipJobsRes.data ?? []) as any[]
  const wipIds = new Set(wipJobs.map((j) => j.id))
  const metalByJob = new Map<string, number>()
  for (const tx of wipMetalRes.data ?? []) {
    if (!wipIds.has(tx.reference_id)) continue
    metalByJob.set(tx.reference_id, (metalByJob.get(tx.reference_id) ?? 0) + Number(tx.fine_weight_change_g ?? 0))
  }
  const wipRows = wipJobs.map((j) => {
    const held = Math.max(0, -(metalByJob.get(j.id) ?? 0))
    return { job_number: j.job_number, craftsman: j.craftsmen?.name ?? '—', status: j.status, metal_held: held, value: held * avgMetalRate, expected: Number(j.expected_finished_weight_g ?? 0) }
  })
  const totalWipMetalFine = wipRows.reduce((s, r) => s + r.metal_held, 0)
  const totalWipMetalValue = wipRows.reduce((s, r) => s + r.value, 0)
  const onJobCt = (stoneOnJobRes.data ?? []).reduce((s, x: any) => s + Number(x.carat ?? 0), 0)
  const onJobCost = (stoneOnJobRes.data ?? []).reduce((s, x: any) => s + Number(x.cost_per_carat ?? 0) * Number(x.carat ?? 0), 0)
  const totalWipValue = totalWipMetalValue + onJobCost
  const grandTotal = totalMetalValue + totalStoneCost + totalFgCost + totalWipValue

  return (
    <ReportPrintShell
      title="Stock Summary"
      subtitle={`Valuation as of ${new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}`}
      filename={`Stock Summary ${new Date().toISOString().slice(0, 10)}`}
      backHref="/reports/stock-summary"
      printedBy={prof.data?.full_name ?? null}
      footerInfo={`${metalRows.length} purities · ${stoneRows.length} stone groups · ${fgRows.length} FG · ${wipRows.length} WIP`}
    >
      <div className="mb-3 grid grid-cols-5 gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs">
        <div>
          <p className="text-[10px] uppercase text-slate-500">Metal</p>
          <p className="font-semibold tabular">₹ {fmtMoney(totalMetalValue)}</p>
          <p className="text-[9px] text-slate-500">{fmtG(totalMetalFine)} g</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-500">Stones</p>
          <p className="font-semibold tabular">₹ {fmtMoney(totalStoneCost)}</p>
          <p className="text-[9px] text-slate-500">{fmtInt(totalStonePcs)} pcs</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-500">FG</p>
          <p className="font-semibold tabular">₹ {fmtMoney(totalFgCost)}</p>
          <p className="text-[9px] text-slate-500">{fgRows.length} pcs</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-500">WIP</p>
          <p className="font-semibold tabular">₹ {fmtMoney(totalWipValue)}</p>
          <p className="text-[9px] text-slate-500">{wipRows.length} jobs</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-500">Total</p>
          <p className="font-semibold tabular text-brand-700">₹ {fmtMoney(grandTotal)}</p>
        </div>
      </div>

      <h3 className="mb-1 mt-4 text-xs font-bold uppercase">Metal stock ({metalRows.length})</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-left">
            <th className="py-1 font-semibold">Purity</th>
            <th className="py-1 text-right font-semibold">Lots</th>
            <th className="py-1 text-right font-semibold">Fine (g)</th>
            <th className="py-1 text-right font-semibold">Avg rate / g</th>
            <th className="py-1 text-right font-semibold">Value</th>
          </tr>
        </thead>
        <tbody>
          {metalRows.length === 0 && <tr><td colSpan={5} className="py-3 text-center italic text-slate-500">No metal in stock</td></tr>}
          {metalRows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="py-1 font-mono">{r.purity} <span className="text-slate-500 text-[10px]">{r.pct > 0 ? `${r.pct.toFixed(2)}%` : ''}</span></td>
              <td className="py-1 text-right tabular">{r.lots}</td>
              <td className="py-1 text-right tabular">{fmtG(r.fine)}</td>
              <td className="py-1 text-right tabular">₹ {fmtMoney(r.fine > 0 ? r.value / r.fine : 0)}</td>
              <td className="py-1 text-right tabular font-semibold">₹ {fmtMoney(r.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-semibold">
            <td colSpan={2} className="py-1">Total</td>
            <td className="py-1 text-right tabular">{fmtG(totalMetalFine)}</td>
            <td className="py-1 text-right tabular">₹ {fmtMoney(avgMetalRate)}</td>
            <td className="py-1 text-right tabular">₹ {fmtMoney(totalMetalValue)}</td>
          </tr>
        </tfoot>
      </table>

      <h3 className="mb-1 mt-4 text-xs font-bold uppercase">Stone stock ({stoneRows.length} groups · {fmtInt(totalStonePcs)} pcs · {fmtCt(totalStoneCt)} ct)</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-left">
            <th className="py-1 font-semibold">Type</th>
            <th className="py-1 font-semibold">Shape</th>
            <th className="py-1 font-semibold">Color</th>
            <th className="py-1 font-semibold">Clarity</th>
            <th className="py-1 font-semibold">Cut</th>
            <th className="py-1 text-right font-semibold">Pcs</th>
            <th className="py-1 text-right font-semibold">Carat</th>
            <th className="py-1 text-right font-semibold">Cost</th>
          </tr>
        </thead>
        <tbody>
          {stoneRows.length === 0 && <tr><td colSpan={8} className="py-3 text-center italic text-slate-500">No loose stones</td></tr>}
          {stoneRows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="py-1 capitalize">{r.category}</td>
              <td className="py-1">{r.shape}</td>
              <td className="py-1">{r.color}</td>
              <td className="py-1">{r.clarity}</td>
              <td className="py-1">{r.cut}</td>
              <td className="py-1 text-right tabular">{r.pcs}</td>
              <td className="py-1 text-right tabular">{fmtCt(r.ct)}</td>
              <td className="py-1 text-right tabular">₹ {fmtMoney(r.cost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-semibold">
            <td colSpan={5} className="py-1">Total</td>
            <td className="py-1 text-right tabular">{fmtInt(totalStonePcs)}</td>
            <td className="py-1 text-right tabular">{fmtCt(totalStoneCt)}</td>
            <td className="py-1 text-right tabular">₹ {fmtMoney(totalStoneCost)}</td>
          </tr>
        </tfoot>
      </table>

      <h3 className="mb-1 mt-4 text-xs font-bold uppercase">Finished goods ({fgRows.length})</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-left">
            <th className="py-1 font-semibold">Tag</th>
            <th className="py-1 font-semibold">Design</th>
            <th className="py-1 font-semibold">Category</th>
            <th className="py-1 font-semibold">Purity</th>
            <th className="py-1 text-right font-semibold">Net g</th>
            <th className="py-1 text-right font-semibold">Fine g</th>
            <th className="py-1 text-right font-semibold">Stones</th>
            <th className="py-1 text-right font-semibold">Cost</th>
            <th className="py-1 text-right font-semibold">Floor</th>
            <th className="py-1 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {fgRows.length === 0 && <tr><td colSpan={10} className="py-3 text-center italic text-slate-500">No finished goods</td></tr>}
          {fgRows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="py-1 font-mono">{r.tag}</td>
              <td className="py-1">{r.design}</td>
              <td className="py-1 text-[10px]">{r.category}</td>
              <td className="py-1 font-mono">{r.purity}</td>
              <td className="py-1 text-right tabular">{fmtG(r.net_g)}</td>
              <td className="py-1 text-right tabular">{fmtG(r.fine_g)}</td>
              <td className="py-1 text-right tabular">{r.stone_pcs} · {fmtCt(r.stone_ct)}</td>
              <td className="py-1 text-right tabular font-semibold">₹ {fmtMoney(r.cost)}</td>
              <td className="py-1 text-right tabular">{r.floor > 0 ? `₹ ${fmtMoney(r.floor)}` : '—'}</td>
              <td className="py-1 capitalize text-[10px]">{r.status.replace(/_/g, ' ')}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-semibold">
            <td colSpan={7} className="py-1">Total FG</td>
            <td className="py-1 text-right tabular">₹ {fmtMoney(totalFgCost)}</td>
            <td className="py-1 text-right tabular">₹ {fmtMoney(totalFgFloor)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <h3 className="mb-1 mt-4 text-xs font-bold uppercase">Work in progress ({wipRows.length})</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-left">
            <th className="py-1 font-semibold">Job</th>
            <th className="py-1 font-semibold">Craftsman</th>
            <th className="py-1 font-semibold">Status</th>
            <th className="py-1 text-right font-semibold">Metal held (g)</th>
            <th className="py-1 text-right font-semibold">Metal value</th>
            <th className="py-1 text-right font-semibold">Target finish (g)</th>
          </tr>
        </thead>
        <tbody>
          {wipRows.length === 0 && <tr><td colSpan={6} className="py-3 text-center italic text-slate-500">No open jobs</td></tr>}
          {wipRows.map((r, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="py-1 font-mono">{r.job_number}</td>
              <td className="py-1">{r.craftsman}</td>
              <td className="py-1 capitalize">{r.status.replace(/_/g, ' ')}</td>
              <td className="py-1 text-right tabular">{fmtG(r.metal_held)}</td>
              <td className="py-1 text-right tabular">₹ {fmtMoney(r.value)}</td>
              <td className="py-1 text-right tabular">{r.expected > 0 ? fmtG(r.expected) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-400 font-semibold">
            <td colSpan={3} className="py-1">Total WIP · {fmtCt(onJobCt)} ct stones on job</td>
            <td className="py-1 text-right tabular">{fmtG(totalWipMetalFine)}</td>
            <td className="py-1 text-right tabular">₹ {fmtMoney(totalWipMetalValue)}</td>
            <td className="py-1 text-right tabular">stones ₹ {fmtMoney(onJobCost)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-4 rounded border border-slate-300 bg-slate-50 px-3 py-2">
        <div className="flex justify-between text-sm font-semibold">
          <span className="uppercase tracking-wide text-slate-700">Total stock on hand</span>
          <span className="font-mono text-brand-700">₹ {fmtMoney(grandTotal)}</span>
        </div>
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500">
          <span>Metal ₹{fmtMoney(totalMetalValue)} · Stones ₹{fmtMoney(totalStoneCost)} · FG ₹{fmtMoney(totalFgCost)} · WIP ₹{fmtMoney(totalWipValue)}</span>
        </div>
      </div>
    </ReportPrintShell>
  )
}