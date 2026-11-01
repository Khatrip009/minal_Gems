import { requireRole } from '@/lib/guard'
import { TaxonomyTabs } from './taxonomy-tabs'

export default async function CatalogTaxonomyPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales'])
  const [brands, categories] = await Promise.all([
    supabase.from('brands').select('*').order('name'),
    supabase.from('categories').select('*').order('sort_order').order('name'),
  ])
  if (brands.error || categories.error) {
    return <div className="rounded bg-red-50 border border-red-200 p-4 text-red-700">
      {brands.error?.message ?? categories.error?.message}
    </div>
  }
  return <TaxonomyTabs brands={brands.data ?? []} categories={categories.data ?? []} />
}