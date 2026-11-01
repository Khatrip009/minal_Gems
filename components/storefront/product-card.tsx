import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import type { StorefrontDesign } from '@/lib/storefront/types'

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)

export function ProductCard({ design }: { design: StorefrontDesign }) {
  const href = `/shop/${design.category_slug ?? 'all'}/${design.slug}`
  const inStock = design.in_stock_count > 0

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-stone-100">
        {design.primary_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={design.primary_image}
            alt={design.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-300">
            <Sparkles className="h-10 w-10" />
          </div>
        )}

        {inStock && (
          <span className="absolute top-3 left-3 rounded-full bg-white/95 backdrop-blur px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase text-stone-900">
            In Stock
          </span>
        )}
        {!inStock && design.has_price && (
        <span className="absolute top-3 left-3 rounded-full bg-amber-600/95 backdrop-blur px-2.5 py-1 text-[10px] font-semibold tracking-widest uppercase text-white">
            Made to Order
        </span>
        )}
      </div>

      <div className="mt-3">
        <p className="text-sm font-medium text-stone-900 group-hover:text-amber-700 transition-colors">
          {design.name}
        </p>
        <p className="mt-1 text-xs text-stone-500 font-mono">{design.design_code}</p>
        <p className="mt-2 text-sm">
          {design.has_price ? (
            <>
              <span className="font-semibold text-stone-900">
                {fmtINR(design.min_price!)}
              </span>
              {design.in_stock_count > 1 && (
                <span className="ml-1.5 text-xs text-stone-500">
                  · {design.in_stock_count} available
                </span>
              )}
            </>
          ) : (
            <span className="text-amber-700 font-medium">Enquire for price</span>
          )}
        </p>
      </div>
    </Link>
  )
}

export function ProductGrid({ designs }: { designs: StorefrontDesign[] }) {
  if (designs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white py-16 text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-stone-300" />
        <p className="text-sm font-medium text-stone-900">No pieces yet</p>
        <p className="mt-1 text-sm text-stone-500">
          Check back soon — new pieces are added weekly.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-4">
      {designs.map((d) => (
        <ProductCard key={d.id} design={d} />
      ))}
    </div>
  )
}