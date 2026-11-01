import { getCategories, getDesigns, getPuritiesWithLatestRate } from '@/lib/storefront/catalog'
import { ProductGrid } from '@/components/storefront/product-card'
import { FilterBar } from '@/components/storefront/filter-bar'
import type { ShopFilters } from '@/lib/storefront/types'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Shop All Jewellery · Minal Gems',
  description:
    'Browse certified diamond rings, earrings, necklaces, bangles, and bridal sets. Handcrafted in Surat.',
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopFilters>
}) {
  const filters = await searchParams

  const [categories, purities, designs] = await Promise.all([
    getCategories(),
    getPuritiesWithLatestRate(),
    getDesigns(filters),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
          {filters.q ? `Results for "${filters.q}"` : 'Collections'}
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-stone-900">
          {filters.category
            ? categories.find((c) => c.slug === filters.category)?.name ??
              'All Collections'
            : 'All Collections'}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          {designs.length} piece{designs.length !== 1 ? 's' : ''}
        </p>
      </div>

      <FilterBar categories={categories} purities={purities} />

      <div className="mt-10">
        <ProductGrid designs={designs} />
      </div>
    </div>
  )
}