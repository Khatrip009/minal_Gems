'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingBag,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { addToCart } from '@/lib/storefront/actions'
import { fmtINR } from '@/lib/storefront/format'
import type { StorefrontDesign, StorefrontVariant } from '@/lib/storefront/types'

// ── Cost-line parser ──────────────────────────────────────────────────
type CostLine = { label: string; amount: number }

function parseCostLine(line: string): CostLine | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // "6000/-WATCH" or "13800 /- LABOUR"
  let m = trimmed.match(/^([\d,]+(?:\.\d+)?)\s*\/-?\s*([A-Za-z][^\d]*)$/)
  if (m) {
    const amount = Number(m[1].replace(/,/g, ''))
    const label = m[2].trim()
    if (!Number.isNaN(amount) && amount > 0 && label.length > 0) {
      return { label, amount }
    }
  }

  // "WATCH 6000/-" or "LABOUR: ₹13800"
  m = trimmed.match(
    /^([A-Za-z][A-Za-z\s/&]*?)\s*[:\-]?\s*(?:Rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*\/-?$/,
  )
  if (m) {
    const amount = Number(m[2].replace(/,/g, ''))
    const label = m[1].trim()
    if (!Number.isNaN(amount) && amount > 0 && label.length > 0) {
      return { label, amount }
    }
  }

  return null
}

function parseCostBreakdown(text: string | null): CostLine[] {
  if (!text) return []
  const items: CostLine[] = []
  for (const line of text.split(/[\n;]+/)) {
    const item = parseCostLine(line)
    if (item) items.push(item)
  }
  return items
}

function stripCostLines(text: string | null): string | null {
  if (!text) return null
  const kept = text
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter((l) => l && !parseCostLine(l))
    .join('\n')
    .trim()
  return kept || null
}

// ── Types ──────────────────────────────────────────────────────────────
type StoneExtra = {
  shape?: string | null
  color?: string | null
  clarity?: string | null
  cut?: string | null
  fluorescence?: string | null
  stone_master?: {
    name?: string | null
    category?: string | null
    shape?: string | null
    color?: string | null
    clarity?: string | null
  } | null
}
type VariantExtra = {
  approx_stone_carat?: number | null
  approx_stone_pcs?: number | null
  website_enabled?: boolean
}

const GST_PERCENT = 3

// ── Component ─────────────────────────────────────────────────────────
export function ProductDetailClient({
  design,
  whatsappNumber,
  loggedIn,
}: {
  design: StorefrontDesign
  whatsappNumber: string
  loggedIn: boolean
}) {
  const router = useRouter()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    design.variants.find((v) => v.is_default)?.id ??
      design.variants[0]?.id ??
      null,
  )
  const [pending, startTransition] = useTransition()

  const images = design.images
  const selectedVariant: (StorefrontVariant & VariantExtra) | undefined =
    design.variants.find((v) => v.id === selectedVariantId)

  const availableForVariant = selectedVariant?.available_items ?? []
  const primaryItem = availableForVariant[0]
  const isInStock = !!primaryItem

  // ── Cost parsing (used as fallback when no structured price) ──────
  const parsedCosts = parseCostBreakdown(design.description)
  const parsedSubtotal = parsedCosts.reduce((s, c) => s + c.amount, 0)
  const parsedGst = Math.round((parsedSubtotal * GST_PERCENT) / 100)
  const parsedTotal = parsedSubtotal + parsedGst

  // ── Resolve base price ────────────────────────────────────────────
  // 1. inventory floor_price for the selected variant
  // 2. variant.default_price
  // 3. design.min_price (only when there are no variants at all)
  // 4. parsed cost sum from description
  // 5. null → Enquire
  const variantPrice =
    primaryItem?.floor_price ?? selectedVariant?.default_price ?? null
  const designLevelPrice =
    design.variants.length === 0 ? design.min_price ?? null : null
  const parsedFallback =
    parsedSubtotal > 0 ? parsedSubtotal : null

  const resolvedBasePrice =
    (variantPrice != null && variantPrice > 0 ? variantPrice : null) ??
    (designLevelPrice != null && designLevelPrice > 0
      ? designLevelPrice
      : null) ??
    parsedFallback

  const usingParsedPrice =
    resolvedBasePrice != null &&
    variantPrice == null &&
    designLevelPrice == null &&
    parsedFallback != null

  const isMadeToOrder = !isInStock && resolvedBasePrice != null
  const isOrderable = isInStock || isMadeToOrder

  const baseForDisplay = resolvedBasePrice
  const gstForDisplay =
    baseForDisplay != null
      ? Math.round((baseForDisplay * GST_PERCENT) / 100)
      : null
  const totalForDisplay =
    baseForDisplay != null && gstForDisplay != null
      ? baseForDisplay + gstForDisplay
      : null

  // Clean description for the "About this piece" section
  const cleanDescription = stripCostLines(design.description)

  // ── Cart handler ─────────────────────────────────────────────────
  const waMessage = encodeURIComponent(
    `Hi, I'm interested in "${design.name}" (${design.design_code})${
      selectedVariant?.metal_purity_code
        ? ` — ${selectedVariant.metal_purity_code}`
        : ''
    }. Can you share pricing and availability?`,
  )
  const waLink = `https://wa.me/${whatsappNumber}?text=${waMessage}`

  function handleAddToCart() {
    if (!loggedIn) {
      toast.error('Please sign in to add items to your cart')
      const redirect = encodeURIComponent(window.location.pathname)
      router.push(`/login?redirect=${redirect}`)
      return
    }

    if (!resolvedBasePrice || resolvedBasePrice <= 0) {
      toast.error('This piece is not currently orderable online')
      return
    }

    startTransition(async () => {
      try {
        const res = await addToCart({
          fulfillment_type: isInStock ? 'in_stock' : 'made_to_order',
          inventory_item_id: primaryItem?.id ?? null,
          design_id: design.id,
          variant_id: selectedVariant?.id ?? null,
          unit_price: resolvedBasePrice,
        })

        if (!res.ok) {
          console.error('[addToCart] failed:', res.error)
          toast.error(res.error || 'Could not add to cart')
          return
        }

        toast.success(
          isInStock
            ? 'Added to cart'
            : 'Added to cart — made to order',
        )
        router.refresh()
      } catch (err) {
        console.error('[addToCart] threw:', err)
        toast.error(
          err instanceof Error ? err.message : 'Could not add to cart',
        )
      }
    })
  }

  const stones = design.stones as Array<
    (typeof design.stones)[number] & StoneExtra
  >
  const hasStoneDetail = stones.some(
    (s) =>
      s.shape ||
      s.color ||
      s.clarity ||
      s.cut ||
      s.stone_master?.name ||
      s.stone_master?.category,
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
      {/* ── Gallery ──────────────────────────────────────────────── */}
      <div>
        <div className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
          {images[selectedIdx] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[selectedIdx].url}
              alt={images[selectedIdx].alt ?? design.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-300">
              No image
            </div>
          )}

          {images.length > 1 && (
            <>
              <button
                onClick={() =>
                  setSelectedIdx(
                    (i) => (i - 1 + images.length) % images.length,
                  )
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSelectedIdx((i) => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"
                aria-label="Next image"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded border-2 transition-colors ${
                  i === selectedIdx
                    ? 'border-amber-600'
                    : 'border-transparent'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Info ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
          {design.category_name ?? 'Fine Jewellery'}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
          {design.name}
        </h1>
        <p className="mt-1 text-xs font-mono text-stone-500">
          {design.design_code}
        </p>

        {/* Price — base + GST extra + total */}
        {baseForDisplay != null && gstForDisplay != null && totalForDisplay != null ? (
          <div className="mt-6">
            <p className="text-3xl font-semibold text-stone-900 tabular-nums">
              {fmtINR(baseForDisplay)}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              + {GST_PERCENT}% GST ({fmtINR(gstForDisplay)} extra)
            </p>
            <p className="text-sm text-stone-700 mt-2 tabular-nums">
              Total:{' '}
              <span className="font-semibold text-stone-900">
                {fmtINR(totalForDisplay)}
              </span>
            </p>
          </div>
        ) : (
          <p className="mt-6 text-lg font-medium text-amber-700">
            Enquire for price
          </p>
        )}

        {design.short_description && (
          <p className="mt-4 text-sm text-stone-700 leading-relaxed">
            {design.short_description}
          </p>
        )}

        {/* Variant picker */}
        {design.variants.length > 1 && (
          <div className="mt-6">
            <label className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
              Purity / Size
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {design.variants.map((v) => {
                const label = [v.metal_purity_code, v.size_code]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      selectedVariantId === v.id
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-300 hover:border-stone-500 text-stone-700'
                    }`}
                  >
                    {label || v.sku}
                  </button>
                )
              })}
            </div>
            {selectedVariant?.sku && (
              <p className="mt-2 text-[11px] font-mono text-stone-500">
                SKU: {selectedVariant.sku}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          {isOrderable ? (
            <button
              onClick={handleAddToCart}
              disabled={pending}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-3.5 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
              {pending
                ? 'Adding…'
                : isInStock
                  ? 'Add to Cart'
                  : 'Order Now (Made to Order)'}
            </button>
          ) : (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-900 px-6 py-3.5 text-sm font-semibold transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Enquire on WhatsApp
            </a>
          )}

          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 hover:border-stone-500 px-6 py-3 text-sm font-medium text-stone-700 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Ask a question
          </a>
        </div>

        {/* Price Breakdown — when using parsed description costs */}
        {usingParsedPrice && parsedCosts.length > 0 && (
          <div className="mt-8 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <h2 className="text-xs uppercase tracking-widest text-stone-500 font-semibold mb-3">
              Price Breakdown
            </h2>
            <dl className="space-y-2">
              {parsedCosts.map((c, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm text-stone-700"
                >
                  <dt>{c.label}</dt>
                  <dd className="tabular-nums">{fmtINR(c.amount)}</dd>
                </div>
              ))}
              <div className="flex justify-between text-sm text-stone-700 pt-2 border-t border-stone-200">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{fmtINR(parsedSubtotal)}</dd>
              </div>
              <div className="flex justify-between text-sm text-stone-700">
                <dt>GST ({GST_PERCENT}%)</dt>
                <dd className="tabular-nums">{fmtINR(parsedGst)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold text-stone-900 pt-2 border-t border-stone-300">
                <dt>Total</dt>
                <dd className="tabular-nums">{fmtINR(parsedTotal)}</dd>
              </div>
            </dl>
          </div>
        )}

        {/* Full specification */}
        <dl className="mt-10 border-t border-stone-200 divide-y divide-stone-200">
          <Row label="Design code" value={design.design_code} />
          {selectedVariant?.sku && (
            <Row label="SKU" value={selectedVariant.sku} />
          )}
          {design.category_name && (
            <Row label="Category" value={design.category_name} />
          )}
          {selectedVariant?.metal_purity_code && (
            <Row label="Metal" value={selectedVariant.metal_purity_code} />
          )}
          {selectedVariant?.size_code && (
            <Row label="Size" value={selectedVariant.size_code} />
          )}
          {selectedVariant?.approx_metal_weight_g != null && (
            <Row
              label="Approx. metal weight"
              value={`${Number(selectedVariant.approx_metal_weight_g).toFixed(3)} g`}
            />
          )}
          {selectedVariant?.approx_stone_carat != null &&
            Number(selectedVariant.approx_stone_carat) > 0 && (
              <Row
                label="Approx. stone carat"
                value={`${Number(selectedVariant.approx_stone_carat).toFixed(3)} ct`}
              />
            )}
          {selectedVariant?.approx_stone_pcs != null &&
            Number(selectedVariant.approx_stone_pcs) > 0 && (
              <Row
                label="Approx. stone pcs"
                value={`${selectedVariant.approx_stone_pcs} pcs`}
              />
            )}
          {/* Availability — reflects the SELECTED variant, not the whole design */}
          {isInStock && (
            <Row
              label="Availability"
              value={`${availableForVariant.length} in stock`}
            />
          )}
          {isMadeToOrder && (
            <Row label="Availability" value="Made to order (2–3 weeks)" />
          )}
          {!isOrderable && (
            <Row label="Availability" value="Enquire for pricing" />
          )}
        </dl>

        {/* Stone table */}
        {stones.length > 0 && (
          <div className="mt-10 pt-8 border-t border-stone-200">
            <h2 className="text-sm uppercase tracking-widest text-stone-500 font-semibold mb-3">
              Stone Details
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-stone-500 text-left border-b border-stone-200">
                    <th className="py-2 pr-3 font-medium">Stone</th>
                    {hasStoneDetail && (
                      <>
                        <th className="py-2 pr-3 font-medium">Shape</th>
                        <th className="py-2 pr-3 font-medium">Color</th>
                        <th className="py-2 pr-3 font-medium">Clarity</th>
                      </>
                    )}
                    <th className="py-2 pr-3 font-medium text-right">Pcs</th>
                    <th className="py-2 font-medium text-right">Carat</th>
                  </tr>
                </thead>
                <tbody>
                  {stones.map((s, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="py-2 pr-3 text-stone-900">
                        {s.stone_master?.name ??
                          s.stone_master?.category ??
                          `Stone ${i + 1}`}
                      </td>
                      {hasStoneDetail && (
                        <>
                          <td className="py-2 pr-3 text-stone-700">
                            {s.shape ?? s.stone_master?.shape ?? '—'}
                          </td>
                          <td className="py-2 pr-3 text-stone-700">
                            {s.color ?? s.stone_master?.color ?? '—'}
                          </td>
                          <td className="py-2 pr-3 text-stone-700">
                            {s.clarity ?? s.stone_master?.clarity ?? '—'}
                          </td>
                        </>
                      )}
                      <td className="py-2 pr-3 text-stone-900 text-right tabular-nums">
                        {s.pcs}
                      </td>
                      <td className="py-2 text-stone-900 text-right tabular-nums">
                        {Number(s.carat_each * s.pcs).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Description — cost lines stripped out */}
        {cleanDescription && (
          <div className="mt-10 pt-8 border-t border-stone-200">
            <h2 className="text-sm uppercase tracking-widest text-stone-500 font-semibold mb-3">
              About this piece
            </h2>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
              {cleanDescription}
            </p>
          </div>
        )}

        {/* Trust badges */}
        <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-amber-600" />
            BIS Hallmarked
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-amber-600" />
            Certified stones
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-amber-600" />
            Lifetime exchange
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-amber-600" />
            Insured shipping
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className="text-sm font-medium text-stone-900 text-right">{value}</dd>
    </div>
  )
}