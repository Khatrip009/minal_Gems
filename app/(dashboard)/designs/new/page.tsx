import { requireRole } from '@/lib/guard'
import { PageHeader } from '@/components/primitives/page-header'
import { DesignForm } from '../design-form'

export const dynamic = 'force-dynamic'

export default async function NewDesignPage() {
  const { supabase } = await requireRole(['admin', 'manager'])

  const [
    { data: categories },
    { data: brands },
    { data: purities },
    { data: stoneMasters },
    { data: materials },
    { data: rates },
  ] = await Promise.all([
    supabase.from('categories').select('id, name, parent_id').eq('is_active', true).order('name'),
    supabase.from('brands').select('id, name').order('name'),
    supabase
      .from('metal_purities')
      .select('id, code, purity_percent, metal_type:metal_types(id, name)')
      .eq('is_active', true)
      .order('code'),
    supabase
      .from('stone_master')
      .select('id, category, name, shape, color, clarity, cut, origin')
      .eq('is_active', true)
      .order('category')
      .order('name'),
    supabase
      .from('material_master')
      .select('id, code, name, category, unit, default_rate')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('metal_rates')
      .select('purity_id, rate_per_gram, effective_from')
      .order('effective_from', { ascending: false })
      .limit(200),
  ])

  const latestRates: Record<string, number> = {}
  for (const r of rates ?? []) {
    if (!latestRates[r.purity_id]) latestRates[r.purity_id] = Number(r.rate_per_gram)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New design"
        description="Define the template once. Physical pieces are received later and become inventory."
        backHref="/designs"
        backLabel="Back to designs"
      />
      <DesignForm
        mode="create"
        categories={categories ?? []}
        brands={brands ?? []}
        purities={purities ?? []}
        stoneMasters={stoneMasters ?? []}
        materials={materials ?? []}
        latestRates={latestRates}
      />
    </div>
  )
}