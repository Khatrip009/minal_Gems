import { requireRole } from '@/lib/guard'
import { resolveAssetUrl } from '@/lib/storage-client'
import { PageHeader } from '@/components/primitives/page-header'
import { DesignsTable } from './designs-table'

export const dynamic = 'force-dynamic'

const ROW_LIMIT = 10000

export default async function DesignsPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  const { data: designs, error } = await supabase
    .from('product_designs')
    .select(`
      id,
      design_code,
      name,
      is_published,
      pos_enabled,
      created_at,
      product_type,
      fulfillment_type,
      making_charge_type,
      making_charge_value,
      category:categories(id, name),
      brand:brands(id, name),
      variants:product_variants(id, sku, is_default, default_price)
    `)
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT)

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Failed to load designs</p>
        <p className="mt-1 text-sm">{error.message}</p>
      </div>
    )
  }

  // Primary image per design — for the table thumbnails
  const designIds = (designs ?? []).map((d) => d.id)
  const { data: assetRows } = designIds.length > 0
    ? await supabase
        .from('product_assets')
        .select('design_id, url, is_primary, sort_order, asset_type')
        .eq('asset_type', 'image')
        .in('design_id', designIds)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true })
    : { data: [] as Array<{ design_id: string; url: string }> }

  const designImages: Record<string, string> = {}
  for (const a of assetRows ?? []) {
    if (!a.design_id || !a.url) continue
    if (!designImages[a.design_id]) {
      designImages[a.design_id] = resolveAssetUrl(a.url)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Designs"
        description="Product design master — one design, many variants, many finished pieces."
        action={{ label: '+ New design', href: '/designs/new' }}
      />
      <DesignsTable designs={designs ?? []} designImages={designImages} />
    </div>
  )
}