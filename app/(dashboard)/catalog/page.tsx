import { requireRole } from '@/lib/guard'
import { resolveAssetUrl } from '@/lib/storage-client'
import { CatalogView } from './catalog-view'

export const dynamic = 'force-dynamic'

// PostgREST caps unbounded queries at 1000 rows. Raise explicitly to avoid
// silent truncation (variants, assets) as the catalog grows.
const ROW_LIMIT = 10000

export default async function CatalogPage() {
  const { supabase } = await requireRole([
    'admin',
    'manager',
    'sales',
    'accountant',
  ])

  const [
    designsRes,
    categoriesRes,
    brandsRes,
    puritiesRes,
    jobsRes,
    variantsRes,
    inventoryRes,
    assetsRes,
  ] = await Promise.all([
    supabase.from('product_designs').select('*').order('name').limit(ROW_LIMIT),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('metal_purities').select('id, code').eq('is_active', true),
    supabase
      .from('craftsman_jobs')
      .select('id, design_id, planned_finished_purity_id')
      .limit(ROW_LIMIT),
    // default_price is REQUIRED for the catalog card to show a price when
    // no inventory pieces exist yet. Without it, cards show "No pricing yet".
    supabase
      .from('product_variants')
      .select('id, design_id, default_price')
      .limit(ROW_LIMIT),
    supabase
      .from('inventory_items')
      .select(
        'id, inventory_tag, variant_id, status, floor_price, cost_price, net_metal_weight_g, net_fine_weight_g, stone_pcs_total, stone_carat_total',
      )
      .limit(ROW_LIMIT),
    supabase
      .from('product_assets')
      .select('design_id, url, is_primary, sort_order, asset_type')
      .eq('asset_type', 'image')
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true })
      .limit(ROW_LIMIT),
  ])

  const anyError =
    designsRes.error ??
    categoriesRes.error ??
    brandsRes.error ??
    puritiesRes.error ??
    jobsRes.error ??
    variantsRes.error ??
    inventoryRes.error ??
    assetsRes.error

  if (anyError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Failed to load catalog data</p>
        <p className="mt-1 text-sm">{anyError.message}</p>
      </div>
    )
  }

  const designImages: Record<string, string> = {}
  for (const a of assetsRes.data ?? []) {
    if (!a.design_id || !a.url) continue
    if (!designImages[a.design_id]) {
      designImages[a.design_id] = resolveAssetUrl(a.url)
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const counts = {
      designs: designsRes.data?.length ?? 0,
      variants: variantsRes.data?.length ?? 0,
      inventory: inventoryRes.data?.length ?? 0,
      assets: assetsRes.data?.length ?? 0,
    }
    if (Object.values(counts).some((n) => n >= ROW_LIMIT)) {
      console.warn('[catalog] row limit reached — truncated:', counts)
    }
  }

  return (
    <CatalogView
      designs={designsRes.data ?? []}
      categories={categoriesRes.data ?? []}
      brands={brandsRes.data ?? []}
      purities={puritiesRes.data ?? []}
      jobs={jobsRes.data ?? []}
      variants={variantsRes.data ?? []}
      inventory={inventoryRes.data ?? []}
      designImages={designImages}
    />
  )
}