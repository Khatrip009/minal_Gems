import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/guard'
import { ReportPrintShell } from '@/components/primitives/report-print-shell'

export const dynamic = 'force-dynamic'

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

export default async function CraftsmanLedgerPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const { data: c, error: cErr } = await supabase
    .from('craftsmen')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (cErr) console.error('[print/craftsman] craftsman query failed:', cErr)
  if (!c) {
    console.warn('[print/craftsman] craftsman not found for id =', id)
    notFound()
  }

  const { data: { user } } = await supabase.auth.getUser()

  const [jobsRes, mIr, mRr, sIr, sRr, payR, lotsR, purR, profR] = await Promise.all([
    supabase.from('craftsman_jobs').select('*').eq('craftsman_id', id).order('created_at', { ascending: false }),
    supabase.from('craftsman_job_metal_issues').select('*').order('issued_at', { ascending: false }),
    supabase.from('craftsman_job_metal_returns').select('*').order('received_at', { ascending: false }),
    supabase.from('craftsman_job_stone_issues').select('*').order('issued_at', { ascending: false }),
    supabase.from('craftsman_job_stone_returns').select('*').order('received_at', { ascending: false }),
    supabase.from('craftsman_job_payments').select('*').eq('craftsman_id', id).is('voided_at', null).order('payment_date', { ascending: false }),
    supabase.from('metal_lots').select('id, lot_number, purity_id'),
    supabase.from('metal_purities').select('id, code'),
    user ? supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const jobs = (jobsRes.data ?? []) as any[]
  const jobIds = new Set(jobs.map((j) => j.id))
  const mIssues = ((mIr.data ?? []) as any[]).filter((m) => jobIds.has(m.job_id))
  const mReturns = ((mRr.data ?? []) as any[]).filter((m) => jobIds.has(m.job_id))
  const sIssues = ((sIr.data ?? []) as any[]).filter((s) => jobIds.has(s.job_id))
  const sReturns = ((sRr.data ?? []) as any[]).filter((s) => jobIds.has(s.job_id))
  const pays = (payR.data ?? []) as any[]
  const lotMap = new Map((lotsR.data ?? []).map((l: any) => [l.id, l]))
  const purMap = new Map((purR.data ?? []).map((p: any) => [p.id, p]))

  const openingGold = Number(c.opening_gold_fine_g ?? 0)
  const openingLabour = Number(c.opening_labour_payable ?? 0)
  const issuedFine = mIssues.reduce((a, m) => a + Number(m.fine_weight_g ?? 0), 0)
  const returnedFine = mReturns.reduce((a, m) => a + Number(m.actual_fine_weight_g ?? 0), 0)
  const finishedFine = jobs.filter((j) => j.status === 'completed' || j.status === 'delivered').reduce((a, j) => a + Number(j.finished_fine_g ?? 0), 0)
  const goldHeld = openingGold + issuedFine - returnedFine - finishedFine

  const stonesIssuedCt = sIssues.reduce((a, s) => a + Number(s.carat ?? 0), 0)
  const stonesReturnedCt = sReturns.reduce((a, s) => a + Number(s.carat_returned ?? 0), 0)
  const mountedCt = jobs.filter((j) => j.status === 'completed' || j.status === 'delivered').reduce((acc, j) => {
    const iC = sIssues.filter((s) => s.job_id === j.id).reduce((a, s) => a + Number(s.carat ?? 0), 0)
    const rC = sReturns.filter((s) => s.job_id === j.id).reduce((a, s) => a + Number(s.carat_returned ?? 0), 0)
    return acc + iC - rC
  }, 0)
  const stonesHeld = stonesIssuedCt - stonesReturnedCt - mountedCt

  const earned = jobs.filter((j) => j.status === 'completed' || j.status === 'delivered').reduce((a, j) => a + Number(j.making_charge_amount ?? 0), 0)
  const paid = pays.reduce((a, p) => a + Number(p.amount ?? 0), 0)
  const labourOwed = openingLabour + earned - paid

  const jobByid = new Map(jobs.map((j) => [j.id, j]))

  return (
    <ReportPrintShell
      title="Craftsman Statement"
      subtitle={`${c.name} (${c.code}) · ${c.phone ?? 'no phone'}`}
      filename={`Craftsman ${c.code} ${c.name}`}
      backHref={`/reports/craftsman-ledger?craftsman=${id}`}
      printedBy={profR.data?.full_name ?? null}
      footerInfo={`${jobs.length} jobs · ${pays.length} payments`}
    >
      <div className="mb-3 grid grid-cols-4 gap-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-xs">
        <div><p className="text-[10px] uppercase text-slate-500">Gold held</p><p className="font-semibold tabular text-amber-700">{fmtG(goldHeld)} g</p><p className="text-[9px] text-slate-500">opening {fmtG(openingGold)} + {fmtG(issuedFine)} issued − {fmtG(returnedFine)} ret − {fmtG(finishedFine)} fin</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Stones held</p><p className="font-semibold tabular text-amber-700">{fmtCt(stonesHeld)} ct</p><p className="text-[9px] text-slate-500">{fmtCt(stonesIssuedCt)} issued − {fmtCt(stonesReturnedCt)} ret − {fmtCt(mountedCt)} mounted</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Labour owed</p><p className={`font-semibold tabular ${labourOwed > 0.01 ? 'text-rose-700' : 'text-emerald-700'}`}>₹ {fmtMoney(labourOwed)}</p><p className="text-[9px] text-slate-500">₹{fmtMoney(openingLabour)} open + ₹{fmtMoney(earned)} earned − ₹{fmtMoney(paid)} paid</p></div>
        <div><p className="text-[10px] uppercase text-slate-500">Jobs</p><p className="font-semibold tabular">{jobs.length}</p><p className="text-[9px] text-slate-500">{jobs.filter((j) => j.status === 'pending' || j.status === 'in_progress').length} open · {jobs.filter((j) => j.status === 'completed' || j.status === 'delivered').length} done</p></div>
      </div>

      <h3 className="mb-1 mt-3 text-xs font-bold uppercase">Jobs ({jobs.length})</h3>
      <table className="w-full border-collapse text-xs">
        <thead><tr className="border-b border-slate-400 text-left">
          <th className="py-1 font-semibold">Job</th>
          <th className="py-1 font-semibold">Type</th>
          <th className="py-1 font-semibold">Status</th>
          <th className="py-1 font-semibold">Due</th>
          <th className="py-1 font-semibold">Done</th>
          <th className="py-1 text-right font-semibold">Target g</th>
          <th className="py-1 text-right font-semibold">Finished g</th>
          <th className="py-1 text-right font-semibold">Making ₹</th>
        </tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b border-slate-200">
              <td className="py-1 font-mono">{j.job_number}</td>
              <td className="py-1 capitalize">{j.job_type}</td>
              <td className="py-1 capitalize">{j.status.replace(/_/g, ' ')}</td>
              <td className="py-1">{fmtDate(j.due_date)}</td>
              <td className="py-1">{fmtDate(j.completed_at)}</td>
              <td className="py-1 text-right tabular">{fmtG(j.expected_finished_weight_g)}</td>
              <td className="py-1 text-right tabular">{fmtG(j.finished_fine_g)}</td>
              <td className="py-1 text-right tabular">{fmtMoney(j.making_charge_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mb-1 mt-3 text-xs font-bold uppercase">Metal movements ({mIssues.length + mReturns.length})</h3>
      <table className="w-full border-collapse text-xs">
        <thead><tr className="border-b border-slate-400 text-left">
          <th className="py-1 font-semibold">Date</th>
          <th className="py-1 font-semibold">Type</th>
          <th className="py-1 font-semibold">Job</th>
          <th className="py-1 font-semibold">Lot</th>
          <th className="py-1 font-semibold">Purity</th>
          <th className="py-1 text-right font-semibold">Gross g</th>
          <th className="py-1 text-right font-semibold">Fine g</th>
        </tr></thead>
        <tbody>
          {[
            ...mIssues.map((m) => ({ kind: 'issued' as const, date: m.issued_at, job: jobByid.get(m.job_id), lotId: m.metal_lot_id, gross: Number(m.gross_weight_g), fine: Number(m.fine_weight_g) })),
            ...mReturns.map((m) => ({ kind: 'returned' as const, date: m.received_at, job: jobByid.get(m.job_id), lotId: m.metal_lot_id, gross: Number(m.gross_weight_g), fine: Number(m.actual_fine_weight_g) })),
          ].sort((a, b) => b.date.localeCompare(a.date)).map((m, i) => {
            const lot = lotMap.get(m.lotId) as any
            const pur = lot ? purMap.get(lot.purity_id) as any : null
            return (
              <tr key={i} className="border-b border-slate-200">
                <td className="py-1">{fmtDate(m.date)}</td>
                <td className={`py-1 capitalize ${m.kind === 'issued' ? 'text-rose-700' : 'text-emerald-700'}`}>{m.kind}</td>
                <td className="py-1 font-mono">{m.job?.job_number ?? '—'}</td>
                <td className="py-1 font-mono">{lot?.lot_number ?? '—'}</td>
                <td className="py-1">{pur?.code ?? '—'}</td>
                <td className="py-1 text-right tabular">{fmtG(m.gross)}</td>
                <td className={`py-1 text-right tabular ${m.kind === 'issued' ? 'text-rose-700' : 'text-emerald-700'}`}>{m.kind === 'issued' ? '−' : '+'}{fmtG(m.fine)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3 className="mb-1 mt-3 text-xs font-bold uppercase">Stone movements ({sIssues.length + sReturns.length})</h3>
      <table className="w-full border-collapse text-xs">
        <thead><tr className="border-b border-slate-400 text-left">
          <th className="py-1 font-semibold">Date</th>
          <th className="py-1 font-semibold">Type</th>
          <th className="py-1 font-semibold">Job</th>
          <th className="py-1 text-right font-semibold">Carat</th>
          <th className="py-1 font-semibold">Condition</th>
        </tr></thead>
        <tbody>
          {[
            ...sIssues.map((s) => ({ kind: 'issued' as const, date: s.issued_at, job: jobByid.get(s.job_id), ct: Number(s.carat), cond: null as string | null })),
            ...sReturns.map((s) => ({ kind: 'returned' as const, date: s.received_at, job: jobByid.get(s.job_id), ct: Number(s.carat_returned ?? 0), cond: s.return_condition as string | null })),
          ].sort((a, b) => b.date.localeCompare(a.date)).map((s, i) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="py-1">{fmtDate(s.date)}</td>
              <td className={`py-1 capitalize ${s.kind === 'issued' ? 'text-rose-700' : 'text-emerald-700'}`}>{s.kind}</td>
              <td className="py-1 font-mono">{s.job?.job_number ?? '—'}</td>
              <td className="py-1 text-right tabular">{fmtCt(s.ct)}</td>
              <td className="py-1">{s.cond ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mb-1 mt-3 text-xs font-bold uppercase">Payments ({pays.length})</h3>
      <table className="w-full border-collapse text-xs">
        <thead><tr className="border-b border-slate-400 text-left">
          <th className="py-1 font-semibold">Date</th>
          <th className="py-1 font-semibold">Job</th>
          <th className="py-1 font-semibold">Method</th>
          <th className="py-1 font-semibold">Ref</th>
          <th className="py-1 text-right font-semibold">Amount ₹</th>
          <th className="py-1 font-semibold">Notes</th>
        </tr></thead>
        <tbody>
          {pays.length === 0 && <tr><td colSpan={6} className="py-3 text-center italic text-slate-500">No payments recorded</td></tr>}
          {pays.map((p) => (
            <tr key={p.id} className="border-b border-slate-200">
              <td className="py-1">{fmtDate(p.payment_date)}</td>
              <td className="py-1 font-mono">{p.job_id ? (jobByid.get(p.job_id)?.job_number ?? '—') : 'advance'}</td>
              <td className="py-1 capitalize">{p.payment_method.replace(/_/g, ' ')}</td>
              <td className="py-1 font-mono text-[10px]">{p.reference ?? '—'}</td>
              <td className="py-1 text-right tabular font-semibold">{fmtMoney(p.amount)}</td>
              <td className="py-1 text-[10px]">{p.notes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-slate-400 font-semibold"><td colSpan={4} className="py-1">Total paid</td><td className="py-1 text-right tabular">₹{fmtMoney(paid)}</td><td /></tr></tfoot>
      </table>
    </ReportPrintShell>
  )
}