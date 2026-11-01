import { requireRole } from '@/lib/guard'
import { resolveAssetUrl } from '@/lib/storage-client'
import { InventoryGrid } from './inventory-grid'

export const dynamic = 'force-dynamic'

// PostgREST caps unbounded queries at 1000 rows. Raise it — but also log a
// warning if we hit it, so truncation doesn't silently cause missing images.
const ROW_LIMIT = 10000

export default async function InventoryPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  const [itemsRes, designsRes, variantsRes, locationsRes, jobsRes, assetsRes] =
    await Promise.all([
      supabase
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(ROW_LIMIT),
      supabase
        .from('product_designs')
        .select('id, name, design_code, product_type, category_id')
        .limit(ROW_LIMIT),
      supabase
        .from('product_variants')
        .select('id, design_id')
        .limit(ROW_LIMIT),
      supabase.from('locations').select('id, name'),
      supabase
        .from('craftsman_jobs')
        .select('id, design_id, inventory_item_id')
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
    itemsRes.error ??
    designsRes.error ??
    variantsRes.error ??
    locationsRes.error ??
    jobsRes.error ??
    assetsRes.error

  if (anyError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Failed to load inventory data</p>
        <p className="mt-1 text-sm">{anyError.message}</p>
      </div>
    )
  }

  const designMap: Record<
    string,
    { id: string; name: string; design_code: string; product_type: string }
  > = Object.fromEntries(
    (designsRes.data ?? []).map((d) => [
      d.id,
      {
        id: d.id,
        name: d.name,
        design_code: d.design_code,
        product_type: d.product_type,
      },
    ]),
  )

  const variantDesignMap: Record<string, string> = Object.fromEntries(
    (variantsRes.data ?? []).map((v) => [v.id, v.design_id]),
  )

  const locationMap: Record<string, string> = Object.fromEntries(
    (locationsRes.data ?? []).map((l) => [l.id, l.name]),
  )

  const itemDesignMap: Record<string, string> = {}
  for (const item of itemsRes.data ?? []) {
    if (item.variant_id && variantDesignMap[item.variant_id]) {
      itemDesignMap[item.id] = variantDesignMap[item.variant_id]
    }
  }
  for (const job of jobsRes.data ?? []) {
    if (
      job.inventory_item_id &&
      job.design_id &&
      !itemDesignMap[job.inventory_item_id]
    ) {
      itemDesignMap[job.inventory_item_id] = job.design_id
    }
  }

  const designImages: Record<string, string> = {}
  for (const a of assetsRes.data ?? []) {
    if (!a.design_id || !a.url) continue
    if (!designImages[a.design_id]) {
      designImages[a.design_id] = resolveAssetUrl(a.url)
    }
  }

  // Dev-only diagnostics — terminal, not browser
  if (process.env.NODE_ENV !== 'production') {
    const counts = {
      items: itemsRes.data?.length ?? 0,
      designs: designsRes.data?.length ?? 0,
      variants: variantsRes.data?.length ?? 0,
      jobs: jobsRes.data?.length ?? 0,
      assets: assetsRes.data?.length ?? 0,
      designImages: Object.keys(designImages).length,
      itemDesign: Object.keys(itemDesignMap).length,
    }
    if (Object.values(counts).some((n) => n >= ROW_LIMIT)) {
      console.warn('[inventory] row limit reached — truncated:', counts)
    }
    // Specific check: is INV-000027's design present?
    const testDesign = '31642b48-2e92-4119-885c-79bc5d411bf9'
    if (!designImages[testDesign]) {
      console.warn(
        '[inventory] designImages missing CIZER-5069 (31642b48-…). Asset count:',
        counts.assets,
      )
    }
  }

  return (
    <InventoryGrid
      items={itemsRes.data ?? []}
      designMap={designMap}
      itemDesignMap={itemDesignMap}
      locationMap={locationMap}
      designImages={designImages}
    />
  )
}