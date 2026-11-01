import { notFound } from 'next/navigation'
import {
  getCategoryBySlug,
  getDesigns,
  getPuritiesWithLatestRate,
  getCategories,
} from '@/lib/storefront/catalog'
import { ProductGrid } from '@/components/storefront/product-card'
import { FilterBar } from '@/components/storefront/filter-bar'
import type { ShopFilters } from '@/lib/storefront/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const cat = await getCategoryBySlug(category)
  if (!cat) return { title: 'Not found' }
  return {
    title: `${cat.name} · Minal Gems`,
    description: cat.description ?? `Browse our ${cat.name.toLowerCase()} collection.`,
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>
  searchParams: Promise<ShopFilters>
}) {
  const { category } = await params
  const filters = await searchParams

  const cat = await getCategoryBySlug(category)
  if (!cat) notFound()

  const [categories, purities, designs] = await Promise.all([
    getCategories(),
    getPuritiesWithLatestRate(),
    getDesigns({ ...filters, category }),
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-10">
        <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
          Collection
        </p>
        <h1 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-stone-900">
          {cat.name}
        </h1>
        {cat.description && (
          <p className="mt-2 text-sm text-stone-600 max-w-2xl">{cat.description}</p>
        )}
        <p className="mt-2 text-xs text-stone-500">
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