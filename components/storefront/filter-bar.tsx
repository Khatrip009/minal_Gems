'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import type { StorefrontCategory, StorefrontPurity } from '@/lib/storefront/types'

// Extend locally — parent_id may not exist in StorefrontCategory if the
// catalog type hasn't been updated yet. This works either way: if parent_id
// is populated, groups render; if not, a flat sorted list renders.
type CategoryWithParent = StorefrontCategory & { parent_id?: string | null }

export function FilterBar({
  categories,
  purities,
}: {
  categories: StorefrontCategory[]
  purities: StorefrontPurity[]
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)

  const currentCat = params.get('category') ?? ''
  const currentPurity = params.get('purity') ?? ''
  const currentSort = params.get('sort') ?? 'newest'
  const currentMin = params.get('min_price') ?? ''
  const currentMax = params.get('max_price') ?? ''

  const cats = categories as CategoryWithParent[]

  // Determine whether the category list is hierarchical. If ANY category
  // has a parent_id, we render <optgroup> nesting. Otherwise a flat list
  // sorted alphabetically (which handles your 47-category case cleanly).
  const hasHierarchy = cats.some((c) => c.parent_id)
  const topLevel = cats.filter((c) => !c.parent_id)
  const childrenOf = (id: string) => cats.filter((c) => c.parent_id === id)

  const flatSorted = [...cats].sort((a, b) => a.name.localeCompare(b.name))

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`/shop?${next.toString()}`)
  }

  const hasFilters =
    currentCat || currentPurity || currentMin || currentMax || params.get('q')

  // Lookup for chip label — works whether the slug is top-level or child
  const selectedCategoryName =
    cats.find((c) => c.slug === currentCat)?.name ?? currentCat

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-stone-200 pb-4">
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-2 text-sm text-stone-700 hover:text-stone-900"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasFilters && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-600" />
          )}
        </button>

        <select
          value={currentSort}
          onChange={(e) => setParam('sort', e.target.value)}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="name_asc">Name: A–Z</option>
        </select>
      </div>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-b border-stone-200">
          <div>
            <label className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
              Category
            </label>
            <select
              value={currentCat}
              onChange={(e) => setParam('category', e.target.value)}
              className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All categories</option>
              {hasHierarchy
                ? // Hierarchical — group children under parents via <optgroup>
                  topLevel.map((parent) => {
                    const kids = childrenOf(parent.id)
                    if (kids.length === 0) {
                      return (
                        <option key={parent.id} value={parent.slug}>
                          {parent.name}
                        </option>
                      )
                    }
                    return (
                      <optgroup key={parent.id} label={parent.name}>
                        <option value={parent.slug}>
                          {parent.name} — All
                        </option>
                        {kids.map((child) => (
                          <option key={child.id} value={child.slug}>
                            {child.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })
                : // Flat — sorted A→Z so 40+ categories stay navigable
                  flatSorted.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
              Metal Purity
            </label>
            <select
              value={currentPurity}
              onChange={(e) => setParam('purity', e.target.value)}
              className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {purities.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-stone-500 font-semibold">
              Price (₹)
            </label>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                placeholder="Min"
                defaultValue={currentMin}
                onBlur={(e) => setParam('min_price', e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums"
              />
              <input
                type="number"
                placeholder="Max"
                defaultValue={currentMax}
                onBlur={(e) => setParam('max_price', e.target.value)}
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
        </div>
      )}

      {hasFilters && (
        <div className="flex flex-wrap gap-2 pt-4">
          {params.get('q') && (
            <Chip
              label={`"${params.get('q')}"`}
              onRemove={() => setParam('q', '')}
            />
          )}
          {currentCat && (
            <Chip
              label={selectedCategoryName}
              onRemove={() => setParam('category', '')}
            />
          )}
          {currentPurity && (
            <Chip
              label={currentPurity}
              onRemove={() => setParam('purity', '')}
            />
          )}
          {currentMin && (
            <Chip
              label={`≥ ₹${Number(currentMin).toLocaleString('en-IN')}`}
              onRemove={() => setParam('min_price', '')}
            />
          )}
          {currentMax && (
            <Chip
              label={`≤ ₹${Number(currentMax).toLocaleString('en-IN')}`}
              onRemove={() => setParam('max_price', '')}
            />
          )}
        </div>
      )}
    </>
  )
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-700">
      {label}
      <button
        onClick={onRemove}
        className="ml-1 rounded-full hover:bg-stone-100 p-0.5"
        aria-label="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}