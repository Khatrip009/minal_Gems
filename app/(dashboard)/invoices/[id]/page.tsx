import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { InvoiceActions } from './invoice-actions'
import { InvoicePdfButton } from './invoice-pdf-button'
import { amountInWords } from '@/lib/number-to-words'
import {
  ArrowLeft,
  Printer,
  Scale,
  Gem,
  AlertCircle,
  Receipt,
} from 'lucide-react'
import { resolveAssetUrl } from '@/lib/storage-client'

export const dynamic = 'force-dynamic'

// ── Formatters ────────────────────────────────────────────────────
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
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// ── Metal type derivation ─────────────────────────────────────────
const metalTypeFromCode = (
  purity: string | null | undefined,
): string | null => {
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

// ── Stone helpers ─────────────────────────────────────────────────
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
    const key = [s.type, s.name, s.shape, s.color, s.clarity, s.cut]
      .map((x) => x ?? '')
      .join('|')
    const existing = groups.get(key)
    if (existing) {
      existing.pcs += s.pcs
      existing.carat += s.carat
      if (s.value != null) existing.value = (existing.value ?? 0) + s.value
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

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────
export default async function InvoiceDetailPage({
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

  const [
    { data: invoice, error: invoiceErr },
    { data: bareItems, error: itemsErr },
    { data: payments, error: paymentsErr },
  ] = await Promise.all([
    supabase.from('invoices').select('*, customers(*)').eq('id', id).single(),
    supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('display_order'),
    supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', id)
      .order('payment_date', { ascending: false }),
  ])

  if (invoiceErr || !invoice) notFound()

  const items = (bareItems ?? []).map((it: any) => ({ ...it })) as any[]

  // ── Enrichment 1: invoice_item_stones ─────────────────────────
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
      console.warn('[invoice-detail] invoice_item_stones enrich failed:', err)
    }
  }
  for (const it of items) it.invoice_item_stones = stonesByItem.get(it.id) ?? []

  // ── Enrichment 2: inventory_items (tag + design + stones) ─────
  const inventoryIds = items
    .map((i) => i.inventory_item_id)
    .filter(Boolean) as string[]

  const designIdByInventory = new Map<string, string>()
  const inventoryTagById = new Map<string, string>()
  const invStonesByInventory = new Map<string, any[]>()

  if (inventoryIds.length > 0) {
    try {
      const { data: inv } = await supabase
        .from('inventory_items')
        .select(
          `
          id, inventory_tag,
          product_variants!variant_id ( product_designs!design_id ( id ) ),
          craftsman_jobs!inventory_item_id ( design_id )
        `,
        )
        .in('id', inventoryIds)
      for (const row of inv ?? []) {
        if (row.inventory_tag) inventoryTagById.set(row.id, row.inventory_tag)
        const variantDesign = (row as any).product_variants?.product_designs?.id
        const cj = firstOrSelf<any>((row as any).craftsman_jobs)
        const designId = variantDesign || cj?.design_id
        if (designId) designIdByInventory.set(row.id, designId)
      }
    } catch (err) {
      console.warn('[invoice-detail] inventory design enrich failed:', err)
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
      console.warn(
        '[invoice-detail] inventory_item_stones enrich failed:',
        err,
      )
    }
  }
  for (const it of items) {
    it.inventory_item_stones = it.inventory_item_id
      ? invStonesByInventory.get(it.inventory_item_id) ?? []
      : []
  }

  const designIds = Array.from(new Set(designIdByInventory.values()))

  // ── Enrichment 3: design stone spec ───────────────────────────
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
      console.warn(
        '[invoice-detail] product_design_stones enrich failed:',
        err,
      )
    }
  }
  for (const it of items) {
    const designId = it.inventory_item_id
      ? designIdByInventory.get(it.inventory_item_id) ?? null
      : null
    it.design_stones = designId ? designStonesMap[designId] ?? [] : []
  }

  // ── Enrichment 4: design images ───────────────────────────────
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
      console.warn('[invoice-detail] product_assets enrich failed:', err)
    }
  }

  // Per-item image URL
  const imageByItem = new Map<string, string | null>()
  for (const it of items) {
    const designId = it.inventory_item_id
      ? designIdByInventory.get(it.inventory_item_id) ?? null
      : null
    imageByItem.set(it.id, designId ? designImageMap[designId] ?? null : null)
  }

  const isVoid = invoice.status === 'voided'
  const balance = Number(invoice.balance ?? 0)
  const amountPaid = Number(invoice.amount_paid ?? 0)
  const hasPayment = amountPaid > 0.01
  const goldPayments = (payments ?? []).filter((p: any) =>
    String(p.payment_method ?? '').includes('gold'),
  )

  // Print URLs — adjust if your print/receipt routes live elsewhere
  const printInvoiceUrl = `/invoice-print/${invoice.id}`
  const printReceiptUrl = `/invoice-print/${invoice.id}/receipt`

  // Items for the PDF button — attach image_url
  const pdfItems = items.map((it) => ({
    ...it,
    image_url: imageByItem.get(it.id) ?? null,
  }))

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <Link
          href="/invoices"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">
              {invoice.invoice_number}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                isVoid
                  ? 'bg-slate-100 text-slate-500 ring-slate-200'
                  : invoice.payment_status === 'paid'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : invoice.payment_status === 'partially_paid'
                      ? 'bg-amber-50 text-amber-700 ring-amber-200'
                      : 'bg-rose-50 text-rose-700 ring-rose-200'
              }`}
            >
              {humanize(invoice.payment_status)}
            </span>
            {invoice.customers && (
              <span className="text-sm text-slate-600">
                {invoice.customers.name}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPayment && (
              <a
                href={printReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-100"
              >
                <Receipt className="h-3.5 w-3.5" /> Print receipt
              </a>
            )}
            <a
              href={printInvoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" /> Print invoice
            </a>
            <InvoicePdfButton
              invoice={{
                ...invoice,
                items: pdfItems,
              }}
            />
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {fmtDate(invoice.invoice_date)}
          {invoice.customers?.gstin && (
            <>
              {' '}
              · GSTIN{' '}
              <span className="font-mono">{invoice.customers.gstin}</span>
            </>
          )}
          {invoice.place_of_supply && ` · ${invoice.place_of_supply}`}
        </p>
      </div>

      {isVoid && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-900">
            This invoice is voided
          </p>
          <p className="mt-0.5 text-slate-600">
            Void reason: {invoice.void_reason ?? '—'}
          </p>
        </div>
      )}

      {(itemsErr || paymentsErr) && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-2 font-semibold text-rose-900">
            <AlertCircle className="h-4 w-4" /> Detail partially failed to load
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-rose-800">
            {itemsErr && <li>invoice_items: {itemsErr.message}</li>}
            {paymentsErr && <li>invoice_payments: {paymentsErr.message}</li>}
          </ul>
        </div>
      )}

      {/* ── Summary cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Total
          </p>
          <p className="mt-1 tabular text-2xl font-semibold">
            ₹ {fmtMoney(invoice.total)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Paid
          </p>
          <p className="mt-1 tabular text-2xl font-semibold text-emerald-700">
            ₹ {fmtMoney(invoice.amount_paid)}
          </p>
          {goldPayments.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
              <Scale className="h-3 w-3" /> Includes Gold Exchange
            </p>
          )}
        </div>
        <div
          className={`rounded-xl border p-4 ${
            balance > 0.01
              ? 'border-amber-200 bg-amber-50'
              : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          <p
            className={`text-xs font-medium uppercase tracking-wide ${
              balance > 0.01 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            Balance
          </p>
          <p
            className={`mt-1 tabular text-2xl font-semibold ${
              balance > 0.01 ? 'text-amber-900' : 'text-emerald-900'
            }`}
          >
            ₹ {fmtMoney(balance)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Items
          </p>
          <p className="mt-1 tabular text-2xl font-semibold">
            {(items ?? []).length}
          </p>
        </div>
      </div>

      <InvoiceActions
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoice_number}
        total={Number(invoice.total)}
        amountPaid={amountPaid}
        balance={balance}
        status={invoice.status}
      />

      {/* ── Items ──────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Items</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  Item
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  Piece
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  Price
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  Tax
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((it: any) => {
                const imageUrl = imageByItem.get(it.id) ?? null
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
                    className="border-b border-slate-100 align-top last:border-0"
                  >
                    <td className="px-4 py-4">
                      <div className="flex gap-4">
                        {imageUrl ? (
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                            <Gem className="h-8 w-8 text-slate-300" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-slate-900">
                            {it.item_description}
                          </p>

                          {hasMetalDetail && (
                            <div className="mt-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Metal
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-800">
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
                                    <span className="font-semibold text-slate-900">
                                      ₹{fmtMoney(metalValue)}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                          )}

                          {stones.length > 0 && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Stones
                                </p>
                                {stoneValue > 0 && (
                                  <p className="text-[11px] font-semibold text-slate-900">
                                    ₹{fmtMoney(stoneValue)}
                                  </p>
                                )}
                              </div>
                              <table className="mt-1 w-full max-w-xl border-collapse text-[10px]">
                                <thead>
                                  <tr className="border-b border-slate-100 text-left text-slate-400">
                                    <th className="pr-2 font-semibold">Type</th>
                                    <th className="pr-2 font-semibold">Shape</th>
                                    <th className="pr-2 font-semibold">Color</th>
                                    <th className="pr-2 font-semibold">
                                      Clarity
                                    </th>
                                    <th className="pr-2 font-semibold">Cut</th>
                                    <th className="pr-2 text-right font-semibold">
                                      Pcs
                                    </th>
                                    <th className="pr-2 text-right font-semibold">
                                      Carat
                                    </th>
                                    <th className="text-right font-semibold">
                                      Value
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {stones.map((s, i) => (
                                    <tr
                                      key={i}
                                      className="border-t border-slate-100 text-slate-700"
                                    >
                                      <td className="py-0.5 pr-2 capitalize">
                                        {s.type ?? '—'}
                                      </td>
                                      <td className="py-0.5 pr-2">
                                        {s.shape ?? '—'}
                                      </td>
                                      <td className="py-0.5 pr-2">
                                        {s.color ?? '—'}
                                      </td>
                                      <td className="py-0.5 pr-2">
                                        {s.clarity ?? '—'}
                                      </td>
                                      <td className="py-0.5 pr-2">
                                        {s.cut ?? '—'}
                                      </td>
                                      <td className="py-0.5 pr-2 text-right tabular">
                                        {s.pcs}
                                      </td>
                                      <td className="py-0.5 pr-2 text-right tabular">
                                        {fmtCarat(s.carat) ?? '—'}
                                      </td>
                                      <td className="py-0.5 text-right font-medium tabular">
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
                            <div className="mt-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Making
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-800">
                                {[
                                  makingType,
                                  makingRate > 0 &&
                                    `₹${fmtMoney(makingRate)}`,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                                {makingAmount > 0 && (
                                  <>
                                    {' = '}
                                    <span className="font-semibold text-slate-900">
                                      ₹{fmtMoney(makingAmount)}
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                          )}

                          {wastageAmount > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Wastage
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-800">
                                {Number(it.wastage_percent ?? 0) > 0 &&
                                  `${Number(it.wastage_percent).toFixed(2)}% · `}
                                ₹{fmtMoney(wastageAmount)}
                              </p>
                            </div>
                          )}

                          {materials.length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                Materials
                              </p>
                              <ul className="mt-0.5 space-y-0.5 text-[11px] text-slate-700">
                                {materials.map((m, i) => (
                                  <li
                                    key={i}
                                    className="flex max-w-md justify-between gap-2"
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
                                      <span className="font-medium tabular text-slate-900">
                                        ₹{fmtMoney(m.value)}
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">
                      {it.inventory_item_id ? (
                        <Link
                          href={`/inventory/${it.inventory_item_id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {inventoryTagById.get(it.inventory_item_id) ?? '—'}
                        </Link>
                      ) : (
                        <span className="text-slate-400">service</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right tabular">
                      ₹ {fmtMoney(it.subtotal)}
                    </td>
                    <td className="px-4 py-4 text-right tabular text-xs">
                      {Number(it.tax_rate).toFixed(0)}% · ₹{' '}
                      {fmtMoney(it.tax_amount)}
                    </td>
                    <td className="px-4 py-4 text-right tabular font-semibold">
                      ₹ {fmtMoney(it.total)}
                    </td>
                  </tr>
                )
              })}
              {(items ?? []).length === 0 && !itemsErr && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No items on this invoice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Totals ─────────────────────────────────────────────── */}
      <div className="ml-auto max-w-md rounded-xl border border-slate-200 bg-white p-5">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="tabular">₹ {fmtMoney(invoice.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Tax</dt>
            <dd className="tabular">₹ {fmtMoney(invoice.tax_amount)}</dd>
          </div>
          {Number(invoice.discount) > 0 && (
            <div className="flex justify-between">
              <dt className="text-slate-600">Discount</dt>
              <dd className="tabular text-rose-600">
                − ₹ {fmtMoney(invoice.discount)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular text-brand-700">
              ₹ {fmtMoney(invoice.total)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[10px] italic text-slate-500">
          {amountInWords(Number(invoice.total))}
        </p>
      </div>

      {/* ── Payment history ───────────────────────────────────── */}
      {(payments ?? []).length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Payment history
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Method
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                    Reference
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).map((p: any) => (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-100 last:border-0 ${
                      p.voided_at ? 'text-slate-400 line-through' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">{fmtDate(p.payment_date)}</td>
                    <td className="flex items-center gap-1 px-4 py-2.5 capitalize">
                      {String(p.payment_method ?? '').includes('gold') && (
                        <Scale className="h-3 w-3 text-amber-500" />
                      )}
                      {String(p.payment_method ?? '').replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {p.reference ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular font-semibold">
                      ₹ {fmtMoney(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invoice.notes && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Notes</p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
            {invoice.notes}
          </p>
        </div>
      )}
    </div>
  )
}