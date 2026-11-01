import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { StoneItemsTable, type StoneItemRow } from './stone-items-table'

export const dynamic = 'force-dynamic'

const fmtCt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toFixed(3)} ct` : '—'
}
const fmtInt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-IN') : '—'
}
const fmtMoney = (v: unknown, currency = 'INR') => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const prefix = currency === 'INR' ? '₹' : `${currency} `
  return `${prefix} ${n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export default async function StoneLotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [
    { data: lotRow, error },
    { data: items },
    { data: vendors },
    { data: masters },
    { data: locations },
  ] = await Promise.all([
    supabase.from('stone_lots').select('*').eq('id', id).single(),
    supabase
      .from('stone_items')
      .select('*')
      .eq('stone_lot_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('vendors').select('id, name'),
    supabase.from('stone_master').select('*'),
    supabase.from('locations').select('id, name'),
  ])

  if (error || !lotRow) notFound()

  // ── Map the lot to the shape the page uses ─────────────────────
  const originalPcs = Number((lotRow as any).original_pcs ?? 0)
  const originalCarat = Number((lotRow as any).original_carat ?? 0)
  const ratePerCtr = Number((lotRow as any).rate_per_carat ?? 0)
  const lotCost = originalCarat * ratePerCtr

  const lot = {
    id: lotRow.id as string,
    lot_number: lotRow.lot_number as string,
    stone_master_id: lotRow.stone_master_id as string,
    vendor_id: (lotRow.vendor_id ?? null) as string | null,
    invoice_no: (lotRow.invoice_no ?? null) as string | null,
    invoice_date: (lotRow.invoice_date ?? null) as string | null,
    currency: ((lotRow as any).currency ?? 'INR') as string,
    received_date: lotRow.received_date as string,
    notes: (lotRow.notes ?? null) as string | null,
    // derived
    total_pcs: originalPcs,
    total_carat: originalCarat,
    rate_per_carat: ratePerCtr,
    cost: lotCost,
  }

  // ── Map stone items so the table gets per-stone totals ─────────
  const mappedItems: StoneItemRow[] = (items ?? []).map((it: any) => {
    const carat = Number(it.carat ?? 0)
    const costPerCtr = it.cost_per_carat != null ? Number(it.cost_per_carat) : null
    const sellPerCtr = it.selling_per_carat != null ? Number(it.selling_per_carat) : null
    return {
      id: it.id,
      stone_lot_id: it.stone_lot_id ?? null,
      stone_master_id: it.stone_master_id,
      inventory_tag: it.inventory_tag,
      carat: it.carat,
      color: it.color ?? null,
      clarity: it.clarity ?? null,
      cut: it.cut ?? null,
      shape: it.shape ?? null,
      certificate_id: it.certificate_id ?? null,
      cost_price:
        costPerCtr != null ? costPerCtr * carat : null,
      selling_price:
        sellPerCtr != null ? sellPerCtr * carat : null,
      status: it.status,
      location_id: it.location_id ?? null,
      created_at: it.created_at,
      polish: it.polish ?? null,
      symmetry: it.symmetry ?? null,
      fluorescence: it.fluorescence ?? null,
      length_mm: it.length_mm ?? null,
      width_mm: it.width_mm ?? null,
      depth_mm: it.depth_mm ?? null,
    }
  })

  const vendorMap: Record<string, string> = Object.fromEntries(
    (vendors ?? []).map((v) => [v.id, v.name]),
  )
  const masterMap: Record<string, string> = Object.fromEntries(
    (masters ?? []).map((m) => {
      const row = m as Record<string, unknown>
      return [String(row.id), String(row.name ?? row.category ?? row.id)]
    }),
  )
  const locationMap: Record<string, string> = Object.fromEntries(
    (locations ?? []).map((l) => [l.id, l.name]),
  )

  const vendorName = lot.vendor_id ? (vendorMap[lot.vendor_id] ?? '—') : '—'
  const stoneType = masterMap[lot.stone_master_id] ?? '—'

  // Entered vs opening
  const enteredPcs = mappedItems.length
  const enteredCtr = mappedItems.reduce((s, i) => s + Number(i.carat || 0), 0)
  const openingPcs = lot.total_pcs
  const openingCtr = lot.total_carat
  const pcsPct =
    openingPcs > 0 ? Math.min(100, Math.round((enteredPcs / openingPcs) * 100)) : 0
  const ctrPct =
    openingCtr > 0 ? Math.min(100, Math.round((enteredCtr / openingCtr) * 100)) : 0

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/stones/lots"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Back to stone lots
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold">{lot.lot_number}</h1>
          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {stoneType}
          </span>
          {lot.invoice_no && (
            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
              {lot.invoice_no}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Vendor: {vendorName} · Received:{' '}
          {new Date(lot.received_date).toLocaleDateString('en-IN', {
            dateStyle: 'medium',
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Pieces
          </p>
          <p className="mt-1 text-2xl font-semibold tabular">
            {fmtInt(enteredPcs)}{' '}
            <span className="text-base font-normal text-slate-400">
              / {fmtInt(openingPcs)}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {openingPcs === 0
              ? 'No opening count set'
              : enteredPcs === openingPcs
                ? '✓ All entered'
                : `${pcsPct}% entered`}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Carats
          </p>
          <p className="mt-1 text-2xl font-semibold tabular text-brand-700">
            {fmtCt(enteredCtr)}{' '}
            <span className="text-base font-normal text-slate-400">
              / {fmtCt(openingCtr)}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {openingCtr === 0
              ? '—'
              : Math.abs(enteredCtr - openingCtr) < 0.001
                ? '✓ Matches opening'
                : `${ctrPct}% entered · ${(openingCtr - enteredCtr).toFixed(
                    3,
                  )} ct remaining`}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Rate / ct
          </p>
          <p className="mt-1 text-2xl font-semibold tabular">
            {fmtMoney(lot.rate_per_carat, lot.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Cost
          </p>
          <p className="mt-1 text-2xl font-semibold tabular">
            {fmtMoney(lot.cost, lot.currency)}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Stones in this lot
        </h2>
        <StoneItemsTable
          lotId={lot.id}
          lotStoneMasterId={lot.stone_master_id}
          lotRatePerCarat={lot.rate_per_carat || null}
          lotCurrency={lot.currency}
          items={mappedItems}
          masterMap={masterMap}
          locationMap={locationMap}
          locationOptions={(locations ?? []).map((l) => ({
            id: l.id,
            label: l.name,
          }))}
        />
      </div>
    </div>
  )
}