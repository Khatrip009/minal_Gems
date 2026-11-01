import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/guard'
import { PageHeader } from '@/components/primitives/page-header'
import { resolveAssetUrl } from '@/lib/storage-client'
import { DesignForm } from '../design-form'

export const dynamic = 'force-dynamic'

export default async function EditDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager'])

  const [
    { data: design },
    { data: categories },
    { data: brands },
    { data: purities },
    { data: stoneMasters },
    { data: materials },
    { data: rates },
  ] = await Promise.all([
    supabase
      .from('product_designs')
      .select(`
        *,
        variants:product_variants(*),
        stones:product_design_stones(*),
        materials:product_design_materials(*),
        assets:product_assets(*)
      `)
      .eq('id', id)
      .single(),
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

  if (!design) notFound()

  const latestRates: Record<string, number> = {}
  for (const r of rates ?? []) {
    if (!latestRates[r.purity_id]) latestRates[r.purity_id] = Number(r.rate_per_gram)
  }

  // Resolve asset URLs server-side so DesignForm and every consumer
  // downstream receives absolute URLs. Legacy rows store "products/x.png";
  // this turns them into "http://localhost:4900/products/x.png" (or prod base).
  const resolvedDesign = {
    ...design,
    assets: (design.assets ?? []).map((a: any) => ({
      ...a,
      url: resolveAssetUrl(a.url),
    })),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={design.name}
        description={`Design ${design.design_code}`}
        backHref="/designs"
        backLabel="Back to designs"
      />
      <DesignForm
        mode="edit"
        initialDesign={resolvedDesign}
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