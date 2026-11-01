import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { requireRole } from '@/lib/guard'
import { amountInWords } from '@/lib/number-to-words'
import { PrintButton } from './print-button'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { resolveAssetUrl } from '@/lib/storage-client'

export const dynamic = 'force-dynamic'

const COMPANY = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Minal Gems',
  address:
    '33, Sant tukaram Society- 2, Nr. Ramji Temple, Palanjak Jakatnaka, Surat, Gujarat',
  phone: '+91 7096785900',
  gstin: '24XXXXX1234X1Z5',
  pan: 'XXXXX1234',
}

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
const metalTypeLabel = (code: string | null | undefined) => {
  if (!code) return null
  const c = code.toLowerCase()
  if (c === 'gold') return 'Gold'
  if (c === 'silver') return 'Silver'
  if (c === 'platinum') return 'Platinum'
  return code.charAt(0).toUpperCase() + code.slice(1)
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

type StoneRow = {
  type: string | null
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
  pcs: number
  carat: number
  rate: number | null
  value: number | null
}

// Build stone rows from EITHER invoice_item_stones (preferred) OR stone_details jsonb
function stoneRows(item: any): StoneRow[] {
  if (
    Array.isArray(item.invoice_item_stones) &&
    item.invoice_item_stones.length > 0
  ) {
    return item.invoice_item_stones.map((s: any) => {
      const stone = s.stone_items
      const lot = s.stone_lots
      const sm = stone?.stone_master ?? lot?.stone_master
      const carat = Number(s.carat ?? 0)
      const rate = Number(s.rate_per_carat ?? 0)
      return {
        type: sm?.category ?? null,
        shape: stone?.shape ?? lot?.shape ?? sm?.shape ?? null,
        color: stone?.color ?? lot?.color ?? sm?.color ?? null,
        clarity: stone?.clarity ?? lot?.clarity ?? sm?.clarity ?? null,
        cut: stone?.cut ?? lot?.cut ?? null,
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
    })
  }
  if (Array.isArray(item.stone_details)) {
    return item.stone_details.map((s: any) => {
      const carat = Number(s.carat ?? 0)
      const rate = Number(s.rate_per_carat ?? 0)
      return {
        type: s.category ?? s.type ?? null,
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
    })
  }
  return []
}

function materialRows(item: any): Array<{
  name: string
  qty: number
  unit: string
  rate: number
  value: number
}> {
  if (!Array.isArray(item.material_details)) return []
  return item.material_details.map((m: any) => ({
    name: m.name ?? m.material_name ?? '—',
    qty: Number(m.qty ?? m.quantity ?? 0),
    unit: m.unit ?? 'pc',
    rate: Number(m.rate ?? 0),
    value:
      Number(m.value ?? 0) || Number(m.rate ?? 0) * Number(m.qty ?? m.quantity ?? 0),
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

  // ── 1. Invoice header + customer (single row) ─────────────────
  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .select('*, customers(*)')
    .eq('id', id)
    .maybeSingle()

  if (invoiceErr || !invoice) {
    console.error('[invoice] header load failed:', invoiceErr)
    notFound()
  }

  // ── 2. Items — BARE select, cannot fail on joins ──────────────
  const { data: bareItems, error: itemsErr } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', id)
    .order('display_order', { ascending: true })

  if (itemsErr) {
    console.error('[invoice] items load failed:', itemsErr)
  }
  const items = bareItems ?? []

  // ── 3. Optional enrichment — best-effort, never fatal ─────────
  // 3a. Try to load invoice_item_stones (per-stone rate/value)
  const itemIds = items.map((i: any) => i.id)
  const stonesByItem = new Map<string, any[]>()
  if (itemIds.length > 0) {
    try {
      const { data: stones } = await supabase
        .from('invoice_item_stones')
        .select(
          `
          invoice_item_id,
          carat, pcs, rate_per_carat, sale_value,
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

  // 3b. Try to resolve design images (inventory → variant → design → asset)
  const inventoryIds = items
    .map((i: any) => i.inventory_item_id)
    .filter(Boolean)
  const designIdByInventory = new Map<string, string>()
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
      console.warn('[invoice] inventory enrichment skipped:', err)
    }
  }

  const designIds = Array.from(new Set(designIdByInventory.values()))
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

  // ── 4. Payments + gold buyback (best-effort) ──────────────────
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

  // GST breakup
  const placeOfSupply = (invoice.place_of_supply ?? customer?.state ?? '').trim()
  const companyState = (invoice.company_state ?? '').trim()
  const isInterState =
    companyState.length > 0 &&
    placeOfSupply.length > 0 &&
    companyState.toLowerCase() !== placeOfSupply.toLowerCase()

  type TaxRow = {
    taxable: number
    cgst: number
    sgst: number
    igst: number
    total: number
  }
  const taxBreakup = new Map<number, TaxRow>()
  for (const it of items) {
    const rate = Number((it as any).tax_rate) || 0
    if (rate === 0) continue
    const cur =
      taxBreakup.get(rate) ?? {
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total: 0,
      }
    const lineTax = Number((it as any).tax_amount) || 0
    cur.taxable += Number((it as any).subtotal) || 0
    if (isInterState) {
      cur.igst += lineTax
    } else {
      cur.cgst += lineTax / 2
      cur.sgst += lineTax / 2
    }
    cur.total += lineTax
    taxBreakup.set(rate, cur)
  }

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
              src="/logo_minalgems.png"
              alt={COMPANY.name}
              width={160}
              height={160}
              className="w-20 h-20 object-contain"
              priority
            />
            <div>
              <p className="text-lg font-bold leading-tight text-slate-900">
                {COMPANY.name}
              </p>
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                Jewellery Manufacturing
              </p>
              <p className="text-[10px] text-slate-600 mt-1">{COMPANY.address}</p>
              <p className="text-[10px] text-slate-600">{COMPANY.phone}</p>
              <p className="text-[10px] font-medium text-slate-600 mt-0.5">
                GSTIN: {COMPANY.gstin} | PAN: {COMPANY.pan}
              </p>
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
          </div>
        </div>

        {/* Customer */}
        <div className="grid grid-cols-2 gap-6 border-b border-slate-300 py-3">
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Billed To
            </p>
            {customer ? (
              <>
                <p className="text-sm font-bold text-slate-900">
                  {customer.name}
                </p>
                {customer.phone && (
                  <p className="text-[10px] font-medium text-slate-600 mt-0.5">
                    {customer.phone}
                  </p>
                )}
                {(customer.address || customer.city) && (
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {[customer.address, customer.city, customer.state]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {customer.gstin && (
                  <p className="mt-1 font-mono text-[10px] font-medium text-slate-600">
                    GSTIN: {customer.gstin}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm font-medium text-slate-500">
                Walk-in customer
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Place of Supply
            </p>
            <p className="text-sm font-bold text-slate-900">
              {invoice.place_of_supply ?? customer?.state ?? '—'}
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
                  ⚠ No items on this invoice. If this is wrong, the invoice
                  was created without line items — check the order or POS
                  flow that produced it.
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

              const rawStones = stonesByItem.get(it.id) ?? []
              const stones = stoneRows({ ...it, invoice_item_stones: rawStones })
              const materials = materialRows(it)

              const metalType = metalTypeLabel(it.metal_type_code)
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
                  className="border-b border-slate-200 align-top"
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
                              {[makingType, makingRate > 0 && `₹${fmtMoney(makingRate)}`]
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
                    {it.hsn_code ?? '7113'}
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
          <div className="mt-3 rounded-md border border-rose-300 bg-rose-50 p-2 text-[10px] text-rose-900">
            <p className="font-bold">Items query failed</p>
            <p className="mt-0.5 font-mono">{itemsErr.message}</p>
          </div>
        )}

        {/* Gold exchange */}
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
                              Fine weight: <strong>{fine.toFixed(3)} g</strong>
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

        {/* Totals */}
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
                      {isInterState ? (
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
                        {isInterState ? (
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
              For {COMPANY.name}
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