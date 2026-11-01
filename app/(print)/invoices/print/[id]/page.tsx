import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { requireRole } from '@/lib/guard'
import { amountInWords } from '@/lib/number-to-words'
import { PrintButton } from './print-button'
import { ArrowLeft } from 'lucide-react'
import { resolveAssetUrl } from '@/lib/storage-client'
import { getCompanySettings, formatAddress } from '@/lib/company-settings'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
const fmtWeight = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(3)} g` : null
}
const fmtCarat = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(3)} ct` : null
}

// ── Metal type derivation ──────────────────────────────────────────
const metalTypeFromCode = (purity: string | null | undefined): string | null => {
  if (!purity) return null
  const p = purity.toUpperCase()
  if (p.includes('PT') || p.includes('PLATINUM')) return 'Platinum'
  if (p.includes('925') || p.includes('SILVER')) return 'Silver'
  if (p.includes('GOLD') || p.includes('K') || /^(22|24|18|14|10|9)/.test(p))
    return 'Gold'
  return null
}
const metalTypeLabel = (
  code: string | null | undefined,
  purityCode?: string | null,
): string | null => {
  if (code) {
    const c = code.toLowerCase()
    if (c === 'gold') return 'Gold'
    if (c === 'silver') return 'Silver'
    if (c === 'platinum') return 'Platinum'
    return code.charAt(0).toUpperCase() + code.slice(1)
  }
  return metalTypeFromCode(purityCode)
}
const makingTypeLabel = (t: string | null | undefined) => {
  if (!t) return null
  const map: Record<string, string> = {
    fixed: 'Fixed',
    per_gram: 'Per gram',
    percent_of_metal: '% of metal',
    percent_of_total: '% of total',
  }
  return map[t] ?? t
}

// ── Stone row shape ────────────────────────────────────────────────
type StoneRow = {
  type: string | null
  name: string | null
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
  pcs: number
  carat: number
  rate: number | null
  value: number | null
}

function qualityFromStone(stoneOrLot: any) {
  if (!stoneOrLot) {
    return {
      type: null,
      name: null,
      shape: null,
      color: null,
      clarity: null,
      cut: null,
    }
  }
  const sm = stoneOrLot.stone_master ?? null
  return {
    type: sm?.category ?? null,
    name: sm?.name ?? null,
    shape: stoneOrLot.shape ?? sm?.shape ?? null,
    color: stoneOrLot.color ?? sm?.color ?? null,
    clarity: stoneOrLot.clarity ?? sm?.clarity ?? null,
    cut: stoneOrLot.cut ?? null,
  }
}

function qualityFromJunction(s: any) {
  const hasSnapshot =
    !!s?.category || !!s?.shape || !!s?.color || !!s?.clarity
  if (hasSnapshot) {
    const sm = s?.stone_master ?? null
    return {
      type: s.category ?? sm?.category ?? null,
      name: sm?.name ?? null,
      shape: s.shape ?? sm?.shape ?? null,
      color: s.color ?? sm?.color ?? null,
      clarity: s.clarity ?? sm?.clarity ?? null,
      cut: s.cut ?? null,
    }
  }
  if (s?.stone_master) {
    const sm = s.stone_master
    return {
      type: sm.category ?? null,
      name: sm.name ?? null,
      shape: sm.shape ?? null,
      color: sm.color ?? null,
      clarity: sm.clarity ?? null,
      cut: null,
    }
  }
  return qualityFromStone(s?.stone_items ?? s?.stone_lots)
}

function stoneRowsForItem(item: any): StoneRow[] {
  const designStones = Array.isArray(item.design_stones)
    ? item.design_stones
    : []

  const designQualityAt = (i: number) => {
    const ds = designStones[i] ?? designStones[0] ?? null
    if (!ds) {
      return {
        type: null,
        name: null,
        shape: null,
        color: null,
        clarity: null,
        cut: null,
      }
    }
    const sm = ds.stone_master ?? null
    return {
      type: sm?.category ?? null,
      name: sm?.name ?? null,
      shape: ds.shape ?? sm?.shape ?? null,
      color: ds.color ?? sm?.color ?? null,
      clarity: ds.clarity ?? sm?.clarity ?? null,
      cut: ds.cut ?? null,
    }
  }

  const enrich = (row: StoneRow, idx: number): StoneRow => {
    if (row.type && (row.shape || row.color || row.clarity)) return row
    const dq = designQualityAt(idx)
    return {
      ...row,
      type: row.type ?? dq.type,
      name: row.name ?? dq.name,
      shape: row.shape ?? dq.shape,
      color: row.color ?? dq.color,
      clarity: row.clarity ?? dq.clarity,
      cut: row.cut ?? dq.cut,
    }
  }

  if (
    Array.isArray(item.invoice_item_stones) &&
    item.invoice_item_stones.length > 0
  ) {
    return item.invoice_item_stones.map((s: any, idx: number) => {
      const q = qualityFromJunction(s)
      const carat = Number(s.carat ?? 0)
      const rate = Number(s.rate_per_carat ?? 0)
      const base: StoneRow = {
        ...q,
        pcs: Number(s.pcs ?? 1),
        carat,
        rate: rate > 0 ? rate : null,
        value:
          Number(s.sale_value ?? 0) > 0
            ? Number(s.sale_value)
            : rate > 0
              ? rate * carat
              : null,
      }
      return enrich(base, idx)
    })
  }

  if (
    Array.isArray(item.inventory_item_stones) &&
    item.inventory_item_stones.length > 0
  ) {
    return item.inventory_item_stones.map((s: any, idx: number) => {
      const q = qualityFromJunction(s)
      const carat = Number(s.carat ?? 0)
      const valuation = Number(s.valuation ?? 0)
      const rate = carat > 0 && valuation > 0 ? valuation / carat : 0
      const base: StoneRow = {
        ...q,
        pcs: Number(s.pcs ?? 1),
        carat,
        rate: rate > 0 ? rate : null,
        value: valuation > 0 ? valuation : null,
      }
      return enrich(base, idx)
    })
  }

  if (Array.isArray(item.stone_details) && item.stone_details.length > 0) {
    return item.stone_details.map((s: any, idx: number) => {
      const carat = Number(s.carat ?? 0)
      const rate = Number(s.rate_per_carat ?? 0)
      const base: StoneRow = {
        type: s.category ?? s.type ?? s.stone_type ?? null,
        name: s.name ?? null,
        shape: s.shape ?? null,
        color: s.color ?? null,
        clarity: s.clarity ?? null,
        cut: s.cut ?? null,
        pcs: Number(s.pcs ?? 1),
        carat,
        rate: rate > 0 ? rate : null,
        value:
          Number(s.sale_value ?? 0) > 0
            ? Number(s.sale_value)
            : rate > 0
              ? rate * carat
              : null,
      }
      return enrich(base, idx)
    })
  }

  if (designStones.length > 0) {
    return designStones.map((s: any) => {
      const sm = s.stone_master ?? null
      const caratEach = Number(s.carat_each ?? 0)
      const pcs = Number(s.pcs ?? 1)
      return {
        type: sm?.category ?? null,
        name: sm?.name ?? null,
        shape: s.shape ?? sm?.shape ?? null,
        color: s.color ?? sm?.color ?? null,
        clarity: s.clarity ?? sm?.clarity ?? null,
        cut: s.cut ?? null,
        pcs,
        carat: caratEach * pcs,
        rate: null,
        value: null,
      }
    })
  }

  return []
}

function groupStones(rows: StoneRow[]): StoneRow[] {
  const groups = new Map<string, StoneRow>()
  for (const s of rows) {
    const key = [
      s.type ?? '',
      s.name ?? '',
      s.shape ?? '',
      s.color ?? '',
      s.clarity ?? '',
      s.cut ?? '',
    ].join('|')
    const existing = groups.get(key)
    if (existing) {
      existing.pcs += s.pcs
      existing.carat += s.carat
      if (s.value != null) {
        existing.value = (existing.value ?? 0) + s.value
      }
    } else {
      groups.set(key, { ...s })
    }
  }
  return Array.from(groups.values())
}

function materialRows(item: any) {
  if (!Array.isArray(item.material_details)) return []
  return item.material_details.map((m: any) => ({
    name: m.name ?? m.material_name ?? '—',
    qty: Number(m.qty ?? m.quantity ?? 0),
    unit: m.unit ?? 'pc',
    rate: Number(m.rate ?? 0),
    value:
      Number(m.value ?? 0) ||
      Number(m.rate ?? 0) * Number(m.qty ?? m.quantity ?? 0),
  }))
}

function firstOrSelf<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null
  if (Array.isArray(x)) return x[0] ?? null
  return x
}

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole([
    'admin',
    'manager',
    'sales',
    'accountant',
  ])

  // ★ Load company profile — used in header and signatory
  const company = await getCompanySettings(supabase)
  const companyAddress = formatAddress(company)

  // ── 1. Invoice + customer ───────────────────────────────────────
  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .select('*, customers(*)')
    .eq('id', id)
    .maybeSingle()

  if (invoiceErr || !invoice) {
    console.error('[invoice] header load failed:', invoiceErr)
    notFound()
  }

  // ── 2. Order link ───────────────────────────────────────────────
  const { data: linkedOrder } = await supabase
    .from('orders')
    .select('id, order_number, shipping_address')
    .eq('invoice_id', id)
    .maybeSingle()

  const shippingAddress = (linkedOrder?.shipping_address ?? null) as Record<
    string,
    any
  > | null

  // ── 3. Items ────────────────────────────────────────────────────
  const { data: bareItems, error: itemsErr } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('display_order', { ascending: true })

  if (itemsErr) console.error('[invoice] items load failed:', itemsErr)

  const items = (bareItems ?? []).map((it: any) => ({ ...it })) as any[]

  // ── 4. Enrich: invoice_item_stones ──────────────────────────────
  const itemIds = items.map((i) => i.id)
  const stonesByItem = new Map<string, any[]>()
  if (itemIds.length > 0) {
    try {
      const { data: stones } = await supabase
        .from('invoice_item_stones')
        .select(
          `
          invoice_item_id, carat, pcs, rate_per_carat, sale_value,
          stone_master_id, category, shape, color, clarity, cut,
          stone_master ( name, category, shape, color, clarity ),
          stone_items (
            carat, shape, color, clarity, cut,
            stone_master ( name, category, shape, color, clarity )
          ),
          stone_lots (
            shape, color, clarity, cut,
            stone_master ( name, category, shape, color, clarity )
          )
        `,
        )
        .in('invoice_item_id', itemIds)
      for (const s of stones ?? []) {
        const arr = stonesByItem.get(s.invoice_item_id) ?? []
        arr.push(s)
        stonesByItem.set(s.invoice_item_id, arr)
      }
    } catch (err) {
      console.warn('[invoice] invoice_item_stones enrichment skipped:', err)
    }
  }
  for (const it of items) {
    it.invoice_item_stones = stonesByItem.get(it.id) ?? []
  }

  // ── 5. Enrich: inventory → design + inventory_item_stones ───────
  const inventoryIds = items
    .map((i) => i.inventory_item_id)
    .filter(Boolean) as string[]

  const designIdByInventory = new Map<string, string>()
  const invStonesByInventory = new Map<string, any[]>()

  if (inventoryIds.length > 0) {
    try {
      const { data: inv } = await supabase
        .from('inventory_items')
        .select(
          `
          id,
          product_variants!variant_id ( product_designs!design_id ( id ) ),
          craftsman_jobs!inventory_item_id ( design_id )
        `,
        )
        .in('id', inventoryIds)
      for (const row of inv ?? []) {
        const variantDesign = (row as any).product_variants?.product_designs?.id
        const cj = firstOrSelf<any>((row as any).craftsman_jobs)
        const designId = variantDesign || cj?.design_id
        if (designId) designIdByInventory.set(row.id, designId)
      }
    } catch (err) {
      console.warn('[invoice] inventory design enrichment skipped:', err)
    }

    try {
      const { data: invStones } = await supabase
        .from('inventory_item_stones')
        .select(
          `
          inventory_item_id, carat, pcs, valuation,
          stone_master_id, category, shape, color, clarity, cut,
          stone_master ( name, category, shape, color, clarity ),
          stone_items (
            carat, shape, color, clarity, cut,
            stone_master ( name, category, shape, color, clarity )
          ),
          stone_lots (
            shape, color, clarity, cut,
            stone_master ( name, category, shape, color, clarity )
          )
        `,
        )
        .in('inventory_item_id', inventoryIds)
      for (const s of invStones ?? []) {
        const arr = invStonesByInventory.get(s.inventory_item_id) ?? []
        arr.push(s)
        invStonesByInventory.set(s.inventory_item_id, arr)
      }
    } catch (err) {
      console.warn('[invoice] inventory_item_stones enrichment skipped:', err)
    }
  }
  for (const it of items) {
    it.inventory_item_stones = it.inventory_item_id
      ? invStonesByInventory.get(it.inventory_item_id) ?? []
      : []
  }

  const designIds = Array.from(new Set(designIdByInventory.values()))

  // ── 6. Enrich: product images ───────────────────────────────────
  const designImageMap: Record<string, string> = {}
  if (designIds.length > 0) {
    try {
      const { data: assets } = await supabase
        .from('product_assets')
        .select('design_id, url, is_primary')
        .in('design_id', designIds)
        .eq('asset_type', 'image')
        .order('is_primary', { ascending: false })
      for (const a of assets ?? []) {
        if (a.design_id && a.url && !designImageMap[a.design_id]) {
          designImageMap[a.design_id] = resolveAssetUrl(a.url)
        }
      }
    } catch (err) {
      console.warn('[invoice] product_assets enrichment skipped:', err)
    }
  }

  // ── 7. Enrich: design stones ────────────────────────────────────
  const designStonesMap: Record<string, any[]> = {}
  if (designIds.length > 0) {
    try {
      const { data: dStones } = await supabase
        .from('product_design_stones')
        .select(
          `
          design_id, carat_each, pcs, shape, color, clarity, cut,
          stone_master ( name, category, shape, color, clarity )
        `,
        )
        .in('design_id', designIds)
      for (const s of dStones ?? []) {
        const arr = designStonesMap[s.design_id] ?? []
        arr.push(s)
        designStonesMap[s.design_id] = arr
      }
    } catch (err) {
      console.warn('[invoice] product_design_stones enrichment skipped:', err)
    }
  }
  for (const it of items) {
    const designId = it.inventory_item_id
      ? designIdByInventory.get(it.inventory_item_id) ?? null
      : null
    it.design_stones = designId ? designStonesMap[designId] ?? [] : []
  }

  // ── 8. Payments + gold buys ─────────────────────────────────────
  const [{ data: payments }, { data: goldBuys }] = await Promise.all([
    supabase.from('invoice_payments').select('*').eq('invoice_id', id),
    supabase
      .from('metal_transactions')
      .select(
        `
        id, gross_weight_change_g, fine_weight_change_g, purity_percent,
        created_at, metal_lot_id,
        metal_lots ( lot_number, rate_per_gram, metal_purities ( code, purity_percent ) )
      `,
      )
      .eq('reference_type', 'invoice')
      .eq('reference_id', id)
      .eq('txn_type', 'buyback')
      .order('created_at', { ascending: true }),
  ])

  const customer = invoice.customers
  const allPayments = payments ?? []
  const activePayments = allPayments.filter((p: any) => !p.voided_at)
  const goldPayments = activePayments.filter((p: any) =>
    String(p.payment_method ?? '').includes('gold'),
  )
  const totalGoldValue = goldPayments.reduce(
    (sum: number, p: any) => sum + Number(p.amount),
    0,
  )
  const amountPaid = Number(invoice.amount_paid ?? 0)
  const cashPaid = Math.max(0, amountPaid - totalGoldValue)
  const balance = Number(invoice.balance ?? 0)

  // ── 9. Customer display ─────────────────────────────────────────
  const displayName =
    shippingAddress?.name ?? customer?.name ?? 'Walk-in customer'
  const displayPhone = shippingAddress?.phone ?? customer?.phone ?? null
  const displayEmail = customer?.email ?? null
  const displayAddressLines = shippingAddress
    ? [
        shippingAddress.line1,
        shippingAddress.line2,
        shippingAddress.city,
        shippingAddress.state,
        shippingAddress.pincode,
      ].filter(Boolean)
    : [customer?.address, customer?.city, customer?.state, customer?.pincode]
        .filter(Boolean)
  const hasAddress = displayAddressLines.length > 0
  const displayGstin = customer?.gstin ?? null

  const resolvedPlaceOfSupply =
    invoice.place_of_supply ??
    shippingAddress?.state ??
    customer?.state ??
    null

  // ── 10. Tax split ───────────────────────────────────────────────
  const storedCgst = Number(invoice.cgst_amount ?? 0)
  const storedSgst = Number(invoice.sgst_amount ?? 0)
  const storedIgst = Number(invoice.igst_amount ?? 0)
  const hasStoredSplit =
    storedCgst > 0 || storedSgst > 0 || storedIgst > 0

  const companyState = (invoice.company_state ?? '').trim()
  const placeOfSupplyStr = (resolvedPlaceOfSupply ?? '').trim()
  const isInterState =
    companyState.length > 0 &&
    placeOfSupplyStr.length > 0 &&
    companyState.toLowerCase() !== placeOfSupplyStr.toLowerCase()

  type TaxRow = {
    taxable: number
    cgst: number
    sgst: number
    igst: number
    total: number
  }
  const taxBreakup = new Map<number, TaxRow>()
  for (const it of items) {
    const rate = Number(it.tax_rate) || 0
    if (rate === 0) continue
    const cur =
      taxBreakup.get(rate) ?? {
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      }
    const lineTax = Number(it.tax_amount) || 0
    cur.taxable += Number(it.subtotal) || 0
    cur.total += lineTax
    taxBreakup.set(rate, cur)
  }

  if (hasStoredSplit && taxBreakup.size > 0) {
    const totalTaxable = Array.from(taxBreakup.values()).reduce(
      (s, t) => s + t.taxable,
      0,
    )
    const firstRate = Array.from(taxBreakup.keys())[0]
    taxBreakup.clear()
    taxBreakup.set(firstRate, {
      taxable: totalTaxable,
      cgst: storedCgst,
      sgst: storedSgst,
      igst: storedIgst,
      total: storedCgst + storedSgst + storedIgst,
    })
  } else {
    for (const [rate, row] of taxBreakup.entries()) {
      const lineTax = row.total
      if (isInterState) {
        row.igst = lineTax
        row.cgst = 0
        row.sgst = 0
      } else {
        row.cgst = lineTax / 2
        row.sgst = lineTax / 2
        row.igst = 0
      }
      taxBreakup.set(rate, row)
    }
  }

  const effectiveIsInterState = hasStoredSplit
    ? storedIgst > 0 && storedCgst === 0 && storedSgst === 0
    : isInterState

  const isVoid = invoice.status === 'voided'

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white font-sans">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body { margin: 0; padding: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `,
        }}
      />

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm print:hidden">
        <Link
          href={`/invoices/${invoice.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoice
        </Link>
        <PrintButton />
      </div>

      <div className="relative mx-auto my-8 w-full max-w-[210mm] bg-white p-8 text-sm text-slate-900 shadow-xl print:my-0 print:w-full print:max-w-none print:p-0 print:shadow-none">
        {isVoid && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-30deg] text-[140px] font-black uppercase tracking-wider text-rose-500/15">
              VOID
            </span>
          </div>
        )}
        {isVoid && (
          <div className="mb-4 rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 print:break-inside-avoid">
            <p className="font-bold">This invoice has been voided.</p>
            <p className="mt-0.5">
              Reason: {invoice.void_reason ?? '—'} · Date:{' '}
              {fmtDate(invoice.voided_at)}
            </p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <Image
              src={company.logo_url || '/logo_minalgems.png'}
              alt={company.name}
              width={160}
              height={160}
              className="w-20 h-20 object-contain"
              priority
            />
            <div>
              <p className="text-lg font-bold leading-tight text-slate-900">
                {company.name}
              </p>
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                Jewellery Manufacturing
              </p>
              {companyAddress && (
                <p className="text-[10px] text-slate-600 mt-1">
                  {companyAddress}
                </p>
              )}
              {company.phone && (
                <p className="text-[10px] text-slate-600">{company.phone}</p>
              )}
              {(company.gstin || company.pan) && (
                <p className="text-[10px] font-medium text-slate-600 mt-0.5">
                  {company.gstin && <>GSTIN: {company.gstin}</>}
                  {company.gstin && company.pan && ' | '}
                  {company.pan && <>PAN: {company.pan}</>}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-black tracking-wider text-slate-800">
              TAX INVOICE
            </p>
            <p className="mt-1 font-mono text-base font-bold text-amber-600">
              {invoice.invoice_number}
            </p>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5">
              Date: {fmtDate(invoice.invoice_date)}
            </p>
            {linkedOrder?.order_number && (
              <p className="text-[10px] font-medium text-slate-500">
                Order: {linkedOrder.order_number}
              </p>
            )}
          </div>
        </div>

        {/* Customer + Place of Supply */}
        <div className="grid grid-cols-2 gap-6 border-b border-slate-300 py-3">
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Billed To
            </p>
            <p className="text-sm font-bold text-slate-900">{displayName}</p>
            {displayPhone && (
              <p className="text-[10px] font-medium text-slate-600 mt-0.5">
                {displayPhone}
              </p>
            )}
            {displayEmail && (
              <p className="text-[10px] text-slate-600">{displayEmail}</p>
            )}
            {hasAddress && (
              <p className="mt-1 text-[10px] text-slate-600 leading-snug">
                {displayAddressLines.join(', ')}
              </p>
            )}
            {displayGstin && (
              <p className="mt-1 font-mono text-[10px] font-medium text-slate-600">
                GSTIN: {displayGstin}
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Place of Supply
            </p>
            <p className="text-sm font-bold text-slate-900">
              {resolvedPlaceOfSupply ?? '—'}
            </p>
          </div>
        </div>

        {/* Items */}
        <table className="mt-3 w-full table-fixed border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-50">
              <th className="w-[55%] py-1.5 px-2 text-left text-[9px] font-bold uppercase tracking-wide text-slate-600">
                Item Details
              </th>
              <th className="w-[7%] py-1.5 px-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-600">
                HSN
              </th>
              <th className="w-[11%] py-1.5 px-1 text-right text-[9px] font-bold uppercase tracking-wide text-slate-600">
                Amount
              </th>
              <th className="w-[6%] py-1.5 px-1 text-center text-[9px] font-bold uppercase tracking-wide text-slate-600">
                Tax
              </th>
              <th className="w-[10%] py-1.5 px-1 text-right text-[9px] font-bold uppercase tracking-wide text-slate-600">
                Tax Amt
              </th>
              <th className="w-[11%] py-1.5 px-1 text-right text-[9px] font-bold uppercase tracking-wide text-slate-600">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-[11px] italic text-rose-700 bg-rose-50"
                >
                  ⚠ No items on this invoice.
                </td>
              </tr>
            )}
            {items.map((it: any) => {
              const designId = it.inventory_item_id
                ? designIdByInventory.get(it.inventory_item_id) ?? null
                : null
              const imageUrl = designId
                ? designImageMap[designId] ?? null
                : null

              const stones = groupStones(stoneRowsForItem(it))
              const materials = materialRows(it)

              const metalType = metalTypeLabel(
                it.metal_type_code,
                it.metal_purity_code,
              )
              const purityCode = it.metal_purity_code as string | null
              const netWt = fmtWeight(it.net_metal_weight_g)
              const fineWt = fmtWeight(it.net_fine_weight_g)
              const rate = Number(it.metal_rate_per_g ?? 0)
              const metalValue = Number(it.metal_value ?? 0)
              const stoneValue = Number(it.stone_value ?? 0)
              const makingAmount = Number(it.making_charge_amount ?? 0)
              const makingRate = Number(it.making_charge_value ?? 0)
              const makingType = makingTypeLabel(it.making_charge_type)
              const wastageAmount = Number(it.wastage_amount ?? 0)

              const hasMetalDetail =
                metalType ||
                purityCode ||
                netWt ||
                fineWt ||
                rate > 0 ||
                metalValue > 0
              const hasMakingDetail =
                makingAmount > 0 || (makingType && makingRate > 0)

              return (
                <tr
                  key={it.id}
                  className="border-b border-slate-200 align-top print:break-inside-avoid"
                >
                  <td className="py-2.5 px-2">
                    <div className="flex gap-2.5">
                      {imageUrl && (
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-slate-200 bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-xs">
                          {it.item_description}
                        </p>

                        {hasMetalDetail && (
                          <div className="mt-1.5 rounded border border-slate-100 bg-slate-50/60 px-2 py-1">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                              Metal
                            </p>
                            <p className="text-[10px] text-slate-800 font-medium mt-0.5">
                              {[
                                metalType,
                                purityCode,
                                netWt && `Net ${netWt}`,
                                fineWt && `Fine ${fineWt}`,
                                rate > 0 && `@ ₹${fmtMoney(rate)}/g`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                              {metalValue > 0 && (
                                <>
                                  {' · '}
                                  <span className="font-bold text-slate-900">
                                    ₹{fmtMoney(metalValue)}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        )}

                        {stones.length > 0 && (
                          <div className="mt-1.5 rounded border border-slate-100 bg-slate-50/60 px-2 py-1">
                            <div className="flex items-center justify-between">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                                Stones
                              </p>
                              {stoneValue > 0 && (
                                <p className="text-[9px] font-bold text-slate-900">
                                  ₹{fmtMoney(stoneValue)}
                                </p>
                              )}
                            </div>
                            <table className="mt-0.5 w-full text-[9px] border-collapse">
                              <thead>
                                <tr className="text-slate-400 text-left">
                                  <th className="pr-1 font-semibold">Type</th>
                                  <th className="pr-1 font-semibold">Shape</th>
                                  <th className="pr-1 font-semibold">Color</th>
                                  <th className="pr-1 font-semibold">
                                    Clarity
                                  </th>
                                  <th className="pr-1 font-semibold">Cut</th>
                                  <th className="pr-1 font-semibold text-right">
                                    Pcs
                                  </th>
                                  <th className="pr-1 font-semibold text-right">
                                    Carat
                                  </th>
                                  <th className="font-semibold text-right">
                                    Value
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {stones.map((s, i) => (
                                  <tr
                                    key={i}
                                    className="text-slate-700 border-t border-slate-100"
                                  >
                                    <td className="pr-1 py-0.5 capitalize">
                                      {s.type ?? '—'}
                                    </td>
                                    <td className="pr-1 py-0.5">
                                      {s.shape ?? '—'}
                                    </td>
                                    <td className="pr-1 py-0.5">
                                      {s.color ?? '—'}
                                    </td>
                                    <td className="pr-1 py-0.5">
                                      {s.clarity ?? '—'}
                                    </td>
                                    <td className="pr-1 py-0.5">
                                      {s.cut ?? '—'}
                                    </td>
                                    <td className="pr-1 py-0.5 text-right tabular">
                                      {s.pcs}
                                    </td>
                                    <td className="pr-1 py-0.5 text-right tabular">
                                      {fmtCarat(s.carat) ?? '—'}
                                    </td>
                                    <td className="py-0.5 text-right tabular font-medium">
                                      {s.value != null
                                        ? `₹${fmtMoney(s.value)}`
                                        : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {hasMakingDetail && (
                          <div className="mt-1.5 rounded border border-slate-100 bg-slate-50/60 px-2 py-1">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                              Making
                            </p>
                            <p className="text-[10px] text-slate-800 font-medium mt-0.5">
                              {[
                                makingType,
                                makingRate > 0 && `₹${fmtMoney(makingRate)}`,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                              {makingAmount > 0 && (
                                <>
                                  {' = '}
                                  <span className="font-bold text-slate-900">
                                    ₹{fmtMoney(makingAmount)}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        )}

                        {wastageAmount > 0 && (
                          <div className="mt-1.5 rounded border border-slate-100 bg-slate-50/60 px-2 py-1">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                              Wastage
                            </p>
                            <p className="text-[10px] text-slate-800 font-medium mt-0.5">
                              {Number(it.wastage_percent ?? 0) > 0 &&
                                `${Number(it.wastage_percent).toFixed(2)}% · `}
                              ₹{fmtMoney(wastageAmount)}
                            </p>
                          </div>
                        )}

                        {materials.length > 0 && (
                          <div className="mt-1.5 rounded border border-slate-100 bg-slate-50/60 px-2 py-1">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">
                              Materials
                            </p>
                            <ul className="mt-0.5 space-y-0.5 text-[10px] text-slate-700">
                              {materials.map((m, i) => (
                                <li
                                  key={i}
                                  className="flex justify-between gap-2"
                                >
                                  <span>
                                    • {m.name} × {m.qty} {m.unit}
                                    {m.rate > 0 && (
                                      <span className="text-slate-500">
                                        {' '}
                                        @ ₹{fmtMoney(m.rate)}
                                      </span>
                                    )}
                                  </span>
                                  {m.value > 0 && (
                                    <span className="tabular font-medium text-slate-900">
                                      ₹{fmtMoney(m.value)}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {it.notes && (
                          <p className="mt-1 text-[10px] italic text-slate-500">
                            {it.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-1 text-center font-mono text-[10px] text-slate-600">
                    {it.hsn_code ?? company.default_hsn ?? '7113'}
                  </td>
                  <td className="py-2.5 px-1 text-right tabular font-medium whitespace-nowrap">
                    Rs. {fmtMoney(it.subtotal)}
                  </td>
                  <td className="py-2.5 px-1 text-center font-medium">
                    {Number(it.tax_rate).toFixed(0)}%
                  </td>
                  <td className="py-2.5 px-1 text-right tabular font-medium whitespace-nowrap">
                    Rs. {fmtMoney(it.tax_amount)}
                  </td>
                  <td className="py-2.5 px-1 text-right tabular font-bold text-slate-900 whitespace-nowrap">
                    Rs. {fmtMoney(it.total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {itemsErr && (
          <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-[10px] text-amber-900">
            <strong>Items query:</strong> {itemsErr.message}
          </div>
        )}

        {/* Gold Exchange */}
        {goldPayments.length > 0 && (
          <div className="mt-4 rounded-lg border-2 border-amber-200 bg-amber-50 overflow-hidden print:break-inside-avoid">
            <div className="bg-amber-100 px-3 py-1 border-b border-amber-200">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                <span className="text-base leading-none">⚖️</span> Gold Taken in Exchange
              </h3>
            </div>
            <div className="p-2 space-y-1.5">
              {goldPayments.map((gp: any, idx: number) => {
                const gb = (goldBuys ?? [])[idx]
                const purity = gb?.metal_lots?.metal_purities
                const gross = Number(gb?.gross_weight_change_g ?? 0)
                const fine = Number(gb?.fine_weight_change_g ?? 0)
                const rate = Number(gb?.metal_lots?.rate_per_gram ?? 0)
                const hasDetails = gross > 0 || rate > 0
                return (
                  <div
                    key={gp.id}
                    className="rounded border border-amber-200 bg-white/60 p-2"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        {hasDetails ? (
                          <p className="font-bold text-amber-900 text-[11px]">
                            {gross.toFixed(3)} g
                            {purity?.code ? ` · ${purity.code}` : ''}
                            {rate > 0 ? ` · @ ₹${fmtMoney(rate)}/g` : ''}
                          </p>
                        ) : (
                          <p className="font-bold text-amber-900 text-[11px]">
                            {gp.reference ?? 'Gold exchange'}
                          </p>
                        )}
                        <p className="text-[10px] text-amber-700 mt-0.5">
                          {fine > 0 && (
                            <>
                              Fine weight:{' '}
                              <strong>{fine.toFixed(3)} g</strong>
                              {' · '}
                            </>
                          )}
                          Recorded on {fmtDate(gp.payment_date)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm text-amber-900 whitespace-nowrap">
                          Rs. {fmtMoney(gp.amount)}
                        </p>
                        <p className="text-[9px] uppercase tracking-wide text-amber-700">
                          Exchange value
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Totals + Tax breakup */}
        <div className="mt-4 flex justify-between items-start gap-6">
          <div className="flex-1">
            {taxBreakup.size > 0 && (
              <>
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Tax Breakup
                </p>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="py-1 text-left font-semibold text-slate-600">
                        Rate
                      </th>
                      <th className="py-1 text-right font-semibold text-slate-600">
                        Taxable
                      </th>
                      {effectiveIsInterState ? (
                        <th className="py-1 text-right font-semibold text-slate-600">
                          IGST
                        </th>
                      ) : (
                        <>
                          <th className="py-1 text-right font-semibold text-slate-600">
                            CGST
                          </th>
                          <th className="py-1 text-right font-semibold text-slate-600">
                            SGST
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(taxBreakup.entries()).map(([rate, t]) => (
                      <tr key={rate} className="border-b border-slate-200">
                        <td className="py-1 font-bold">{rate}%</td>
                        <td className="py-1 text-right tabular font-medium whitespace-nowrap">
                          Rs. {fmtMoney(t.taxable)}
                        </td>
                        {effectiveIsInterState ? (
                          <td className="py-1 text-right tabular font-medium whitespace-nowrap">
                            Rs. {fmtMoney(t.igst)}
                          </td>
                        ) : (
                          <>
                            <td className="py-1 text-right tabular font-medium whitespace-nowrap">
                              Rs. {fmtMoney(t.cgst)}
                            </td>
                            <td className="py-1 text-right tabular font-medium whitespace-nowrap">
                              Rs. {fmtMoney(t.sgst)}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          <div className="w-[260px] shrink-0 rounded-lg border border-slate-300 bg-slate-50 p-3 text-[11px] shadow-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-slate-600 font-medium">Subtotal</span>
              <span className="tabular font-bold whitespace-nowrap">
                Rs. {fmtMoney(invoice.subtotal)}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-600 font-medium">Tax</span>
              <span className="tabular font-bold whitespace-nowrap">
                Rs. {fmtMoney(invoice.tax_amount)}
              </span>
            </div>
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between py-0.5 text-rose-700">
                <span className="font-medium">Discount</span>
                <span className="tabular font-bold whitespace-nowrap">
                  − Rs. {fmtMoney(invoice.discount)}
                </span>
              </div>
            )}
            <div className="mt-1.5 flex justify-between border-t border-slate-300 pt-1.5 text-sm font-bold text-slate-900">
              <span>Invoice Total</span>
              <span className="tabular whitespace-nowrap">
                Rs. {fmtMoney(invoice.total)}
              </span>
            </div>
            {totalGoldValue > 0 && (
              <div className="mt-1 flex justify-between py-0.5 font-medium text-amber-800">
                <span>Paid via gold exchange</span>
                <span className="tabular whitespace-nowrap">
                  − Rs. {fmtMoney(totalGoldValue)}
                </span>
              </div>
            )}
            {cashPaid > 0 && (
              <div className="mt-0.5 flex justify-between py-0.5 font-medium text-slate-700">
                <span>Paid (cash / card / UPI)</span>
                <span className="tabular whitespace-nowrap">
                  − Rs. {fmtMoney(cashPaid)}
                </span>
              </div>
            )}
            {amountPaid > 0 && (
              <div className="mt-0.5 flex justify-between py-0.5 text-[10px] font-semibold text-emerald-700 border-t border-slate-200 pt-1.5">
                <span>Total paid</span>
                <span className="tabular whitespace-nowrap">
                  Rs. {fmtMoney(amountPaid)}
                </span>
              </div>
            )}
            <div className="mt-1.5 flex justify-between border-t-2 border-slate-300 pt-1.5 text-base font-black text-amber-800">
              <span>Balance Due</span>
              <span className="tabular whitespace-nowrap">
                Rs. {fmtMoney(balance)}
              </span>
            </div>
          </div>
        </div>

        <p className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium italic text-slate-700">
          {amountInWords(Number(invoice.total))}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-12 pt-4 print:break-inside-avoid">
          <div>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1.5 text-[10px] font-bold text-slate-600">
              Customer Signature
            </p>
          </div>
          <div className="text-right">
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1.5 text-xs font-bold text-slate-800">
              For {company.name}
            </p>
            <p className="text-[10px] font-medium text-slate-500">
              Authorised Signatory
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-200 pt-2 text-center text-[9px] font-medium text-slate-400">
          This is a computer-generated invoice. No physical signature required.
        </div>
      </div>
    </div>
  )
}