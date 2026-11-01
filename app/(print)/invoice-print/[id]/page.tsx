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
    '33, Sant tukaram Society- 2, Nr. Ramji Temple, Palanpur Jakatnaka, Surat, Gujarat',
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

function groupStones(stones: any[]) {
  if (!Array.isArray(stones)) return []
  const groups = stones.reduce((acc, s) => {
    const cutStr = s.cut && s.cut !== 'N/A' ? s.cut : ''
    const key = `${s.shape || ''}-${s.color || ''}-${s.clarity || ''}-${cutStr}`
    if (!acc[key]) {
      acc[key] = {
        shape: s.shape,
        color: s.color,
        clarity: s.clarity,
        cut: cutStr,
        pcs: 0,
        carat: 0,
      }
    }
    acc[key].pcs += 1
    acc[key].carat += Number(s.carat || 0)
    return acc
  }, {} as Record<string, any>)
  return Object.values(groups)
}

// PostgREST may return a single object or an array for a nested relation
// whose FK is not marked UNIQUE. craftsman_jobs.inventory_item_id is not
// unique, so this relation comes back as an array. Normalise to first row.
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

const [
  { data: invoice, error: invoiceErr },
  { data: items, error: itemsErr },
  { data: payments, error: paymentsErr },
  { data: goldBuys },
] = await Promise.all([
  supabase.from('invoices').select('*, customers(*)').eq('id', id).single(),
  supabase
    .from('invoice_items')
    .select(`
      *,
      inventory_items!inventory_item_id (
        id,
        product_variants!variant_id (
          product_designs!design_id ( id )
        ),
        craftsman_jobs!inventory_item_id ( design_id )
      )
    `)
    .eq('invoice_id', id)
    .order('display_order'),
  supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', id),
  // ★ Gold buyback metal transactions for this invoice
  supabase
    .from('metal_transactions')
    .select(`
      id,
      gross_weight_change_g,
      fine_weight_change_g,
      purity_percent,
      created_at,
      metal_lot_id,
      metal_lots (
        lot_number,
        rate_per_gram,
        metal_purities ( code, purity_percent )
      )
    `)
    .eq('reference_type', 'invoice')
    .eq('reference_id', id)
    .eq('txn_type', 'buyback')
    .order('created_at', { ascending: true }),
])
  if (invoiceErr || !invoice) notFound()

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
  // Cash / card / UPI portion = total paid minus gold (which is recorded as
  // a payment via rpc_record_payment). Showing both "gold exchange" and the
  // full "amount_paid" double-counts the gold in the totals block.
  const cashPaid = Math.max(0, amountPaid - totalGoldValue)
  const balance = Number(invoice.balance ?? 0)

  // ── Image lookup ─────────────────────────────────────────────────────
  const designIds = (items ?? [])
    .map((i: any) => {
      const inv = i.inventory_items
      if (!inv) return null
      const variantDesign = inv.product_variants?.product_designs?.id
      const cj = firstOrSelf<any>(inv.craftsman_jobs)
      return variantDesign || cj?.design_id
    })
    .filter(Boolean)

  const designImageMap: Record<string, string> = {}
  if (designIds.length > 0) {
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
  }

  // ── GST: intra-state (CGST+SGST) vs inter-state (IGST) ───────────────
  const placeOfSupply = (invoice.place_of_supply ?? customer?.state ?? '').trim()
  const companyState = (invoice.company_state ?? '').trim()
  const isInterState =
    companyState.length > 0 &&
    placeOfSupply.length > 0 &&
    companyState.toLowerCase() !== placeOfSupply.toLowerCase()

  type TaxRow = { taxable: number; cgst: number; sgst: number; igst: number; total: number }
  const taxBreakup = new Map<number, TaxRow>()
  for (const it of items ?? []) {
    const rate = Number(it.tax_rate) || 0
    if (rate === 0) continue
    const cur =
      taxBreakup.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
    const lineTax = Number(it.tax_amount) || 0
    cur.taxable += Number(it.subtotal) || 0
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
      {/* Print CSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `,
        }}
      />

      {/* Header (Hidden on Print) */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm print:hidden">
        <Link
          href={`/invoices/${invoice.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Invoice
        </Link>
        <PrintButton />
      </div>

      {/* A4 Paper Container */}
      <div className="relative mx-auto my-8 w-full max-w-[210mm] bg-white p-8 text-sm text-slate-900 shadow-xl print:my-0 print:w-full print:max-w-none print:p-0 print:shadow-none">
        {/* VOID watermark — legally required to mark a voided tax invoice */}
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

        {/* 1. Company Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-5">
          <div className="flex items-center gap-5">
            <Image
              src="/logo_minalgems.png"
              alt={COMPANY.name}
              width={200}
              height={200}
              className="w-28 h-28 object-contain"
              priority
            />
            <div>
              <p className="text-xl font-bold leading-tight text-slate-900">
                {COMPANY.name}
              </p>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
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
            <p className="text-2xl font-black tracking-wider text-slate-800">
              TAX INVOICE
            </p>
            <p className="mt-1 font-mono text-base font-bold text-amber-600">
              {invoice.invoice_number}
            </p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              Date: {fmtDate(invoice.invoice_date)}
            </p>
          </div>
        </div>

        {/* 2. Customer Details */}
        <div className="grid grid-cols-2 gap-6 border-b border-slate-300 py-4">
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
              Billed To
            </p>
            {customer ? (
              <>
                <p className="text-sm font-bold text-slate-900">{customer.name}</p>
                {customer.phone && (
                  <p className="text-[11px] font-medium text-slate-600 mt-0.5">
                    {customer.phone}
                  </p>
                )}
                {(customer.address || customer.city) && (
                  <p className="mt-1 text-[11px] text-slate-600">
                    {[customer.address, customer.city, customer.state]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {customer.gstin && (
                  <p className="mt-1 font-mono text-[11px] font-medium text-slate-600">
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

        {/* 3. Items Table */}
        <table className="mt-4 w-full table-fixed border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-50">
              <th className="w-[42%] py-2 px-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Item Description
              </th>
              <th className="w-[8%] py-2 px-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-600">
                HSN
              </th>
              <th className="w-[16%] py-2 px-1 text-right text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Amount
              </th>
              <th className="w-[7%] py-2 px-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Tax
              </th>
              <th className="w-[13%] py-2 px-1 text-right text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Tax Amt
              </th>
              <th className="w-[14%] py-2 px-1 text-right text-[10px] font-bold uppercase tracking-wide text-slate-600">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it: any) => {
              const inv = it.inventory_items
              const variantDesign = inv?.product_variants?.product_designs?.id
              const cj = firstOrSelf<any>(inv?.craftsman_jobs)
              const designId = variantDesign || cj?.design_id
              const imageUrl = designId ? designImageMap[designId] : null
              const grouped = groupStones(it.stone_details)
              const hasBreakdown =
                Number(it.metal_value) > 0 ||
                Number(it.stone_value) > 0 ||
                Number(it.making_charge_amount) > 0

              return (
                <tr key={it.id} className="border-b border-slate-200 align-top">
                  <td className="py-3 px-2">
                    <div className="flex gap-3">
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
                      <div>
                        <p className="font-bold text-slate-900 text-xs">
                          {it.item_description}
                        </p>
                        <div className="mt-0.5 space-y-0.5 text-[10px] text-slate-600 font-medium">
                          {it.metal_purity_code && (
                            <p>Metal: {it.metal_purity_code}</p>
                          )}
                          {it.net_metal_weight_g && (
                            <p>Net Wt: {Number(it.net_metal_weight_g).toFixed(3)}g</p>
                          )}

                          {grouped.length > 0 && (
                            <div className="mt-1">
                              <p className="font-bold text-slate-400 uppercase text-[8px] tracking-wider">
                                Stones
                              </p>
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                {grouped.map((s: any, idx: number) => {
                                  // Build a variant descriptor, skipping missing fields
                                  const parts: string[] = []
                                  if (s.shape) parts.push(s.shape)
                                  if (s.color && s.clarity) parts.push(`${s.color}/${s.clarity}`)
                                  else if (s.color) parts.push(s.color)
                                  else if (s.clarity) parts.push(s.clarity)
                                  if (s.cut && s.cut !== 'N/A') parts.push(`(${s.cut})`)
                                  const variant = parts.join(' ')

                                  return (
                                    <span key={idx} className="text-slate-700">
                                      • {s.pcs} pcs{variant ? ` ${variant}` : ''} —{' '}
                                      {s.carat.toFixed(3)} ct
                                    </span>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {invoice.show_breakdown && it.inventory_item_id && hasBreakdown && (
                          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-slate-500 bg-slate-50 p-1 rounded border border-slate-100 w-fit">
                            <span>
                              <strong className="text-slate-600 font-bold">Metal:</strong> Rs.{' '}
                              {fmtMoney(it.metal_value)}
                            </span>
                            <span>
                              <strong className="text-slate-600 font-bold">Stones:</strong> Rs.{' '}
                              {fmtMoney(it.stone_value)}
                            </span>
                            <span>
                              <strong className="text-slate-600 font-bold">Making:</strong> Rs.{' '}
                              {fmtMoney(it.making_charge_amount)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-1 text-center font-mono text-[10px] text-slate-600">
                    {it.hsn_code ?? '7113'}
                  </td>
                  <td className="py-3 px-1 text-right tabular font-medium whitespace-nowrap">
                    Rs. {fmtMoney(it.subtotal)}
                  </td>
                  <td className="py-3 px-1 text-center font-medium">
                    {Number(it.tax_rate).toFixed(0)}%
                  </td>
                  <td className="py-3 px-1 text-right tabular font-medium whitespace-nowrap">
                    Rs. {fmtMoney(it.tax_amount)}
                  </td>
                  <td className="py-3 px-1 text-right tabular font-bold text-slate-900 whitespace-nowrap">
                    Rs. {fmtMoney(it.total)}
                  </td>
                </tr>
              )
            })}
            {(items ?? []).length === 0 && !itemsErr && (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-[11px] italic text-slate-500"
                >
                  No items on this invoice.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {(itemsErr || paymentsErr) && (
          <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 p-3 text-[11px] print:hidden">
            <p className="flex items-center gap-1.5 font-bold text-rose-900">
              <AlertCircle className="h-3.5 w-3.5" /> Some data failed to load — printed
              figures may be incomplete
            </p>
            <ul className="mt-1 font-mono text-[10px] text-rose-800">
              {itemsErr && <li>invoice_items: {itemsErr.message}</li>}
              {paymentsErr && <li>invoice_payments: {paymentsErr.message}</li>}
            </ul>
          </div>
        )}

{/* 4. Gold Exchange Receipt Block */}
{goldPayments.length > 0 && (
  <div className="mt-5 rounded-lg border-2 border-amber-200 bg-amber-50 overflow-hidden print:break-inside-avoid">
    <div className="bg-amber-100 px-4 py-1.5 border-b border-amber-200">
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
        <span className="text-base leading-none">⚖️</span> Gold Taken in
        Exchange
      </h3>
    </div>
    <div className="p-3 space-y-2">
      {goldPayments.map((gp: any, idx: number) => {
        // Match the payment to its buyback transaction (1:1 in the current
        // new-invoice-form flow). Fall back to reference-only display if the
        // metal_transactions row is missing (older invoices).
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

        {/* 5. Totals Section */}
        <div className="mt-5 flex justify-between items-start gap-6">
          {/* Tax Breakup */}
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

          {/* Final Math */}
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

        {/* 6. Amount in words */}
        <p className="mt-4 rounded-md border border-slate-300 bg-white px-3 py-2 text-[11px] font-medium italic text-slate-700">
          {amountInWords(Number(invoice.total))}
        </p>

        {/* 7. Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-12 pt-8 print:break-inside-avoid">
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

        {/* Footer Note */}
        <div className="mt-6 border-t border-slate-200 pt-2 text-center text-[9px] font-medium text-slate-400">
          This is a computer-generated invoice. No physical signature required.
        </div>
      </div>
    </div>
  )
}