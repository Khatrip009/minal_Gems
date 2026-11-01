import { createClient } from '@/lib/supabase/server'
import { resolveAssetUrl } from '@/lib/storage-client'
import type {
  StorefrontCategory,
  StorefrontDesign,
  StorefrontPurity,
  StorefrontVariant,
  StorefrontInventoryItem,
  ShopFilters,
} from './types'

// ── Categories ─────────────────────────────────────────────────────────

export async function getTopLevelCategories(): Promise<StorefrontCategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url, sort_order, parent_id')
    .eq('is_active', true)
    .is('parent_id', null)
    .order('sort_order')

  if (error) {
    console.error('[catalog] top-level categories failed:', error.message)
    return []
  }

  return (data ?? []).map((c) => ({
    ...c,
    image_url: c.image_url ? resolveAssetUrl(c.image_url) : null,
  })) as StorefrontCategory[]
}

export async function getAllCategories(): Promise<StorefrontCategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url, sort_order, parent_id')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('[catalog] all categories failed:', error.message)
    return []
  }

  return (data ?? []).map((c) => ({
    ...c,
    image_url: c.image_url ? resolveAssetUrl(c.image_url) : null,
  })) as StorefrontCategory[]
}

/**
 * Returns ALL active categories (parents + children) so FilterBar can
 * build its optgroup hierarchy. Falls back to a flat A→Z list if there
 * are no parent_id relationships in the data.
 */
export async function getCategories(): Promise<StorefrontCategory[]> {
  return getAllCategories()
}

export async function getCategoryBySlug(
  slug: string,
): Promise<StorefrontCategory | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, image_url, sort_order, parent_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null
  return {
    ...data,
    image_url: data.image_url ? resolveAssetUrl(data.image_url) : null,
  } as StorefrontCategory
}

// ── Gold rates ────────────────────────────────────────────────────────

export async function getPuritiesWithLatestRate(): Promise<StorefrontPurity[]> {
  const supabase = await createClient()
  const [{ data: purities }, { data: rates }] = await Promise.all([
    supabase
      .from('metal_purities')
      .select('id, code')
      .eq('is_active', true)
      .order('purity_percent', { ascending: false }),
    supabase
      .from('metal_rates')
      .select('purity_id, rate_per_gram, effective_from')
      .order('effective_from', { ascending: false })
      .limit(500),
  ])

  const latest = new Map<string, number>()
  for (const r of rates ?? []) {
    if (!latest.has(r.purity_id))
      latest.set(r.purity_id, Number(r.rate_per_gram))
  }

  return (purities ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    rate_per_gram: latest.get(p.id) ?? 0,
  }))
}

// ── Designs ───────────────────────────────────────────────────────────

type RawStoneMaster = {
  name: string | null
  category: string
  shape: string | null
  color: string | null
  clarity: string | null
}

type RawDesign = {
  id: string
  design_code: string
  name: string
  slug: string
  description: string | null
  short_description: string | null
  category_id: string | null
  product_type: string
  fulfillment_type: string
  default_purity_id: string | null
  meta_title: string | null
  meta_description: string | null
  categories: { id: string; name: string; slug: string } | null
  brands: { name: string } | null
  metal_purities: { code: string } | null
  product_assets:
    | {
        url: string
        alt_text: string | null
        is_primary: boolean
        sort_order: number
        asset_type: string
      }[]
    | null
  product_design_stones:
    | {
        shape: string | null
        color: string | null
        clarity: string | null
        carat_each: number
        pcs: number
        cut: string | null
        stone_master: RawStoneMaster | null
      }[]
    | null
  product_variants:
    | {
        id: string
        sku: string
        size_code: string | null
        approx_metal_weight_g: number | null
        approx_stone_carat: number | null
        approx_stone_pcs: number | null
        default_price: number | null
        is_default: boolean
        website_enabled: boolean
        metal_purities: { code: string } | null
      }[]
    | null
}

// Left join on product_variants (no `!inner`) so designs with zero
// variants still appear. PostgREST caps at max_rows (1000 default); we
// request a wider range so every published design comes back.
const DESIGN_SELECT = `
  id, design_code, name, slug, description, short_description,
  category_id, product_type, fulfillment_type, default_purity_id,
  meta_title, meta_description,
  categories(id, name, slug),
  brands(name),
  metal_purities!default_purity_id(code),
  product_assets(url, alt_text, is_primary, sort_order, asset_type),
  product_design_stones(
    shape, color, clarity, carat_each, pcs, cut,
    stone_master(name, category, shape, color, clarity)
  ),
  product_variants(
    id, sku, size_code,
    approx_metal_weight_g, approx_stone_carat, approx_stone_pcs,
    default_price, is_default, website_enabled,
    metal_purities(code)
  )
`

async function hydrateDesigns(
  rawDesigns: RawDesign[],
): Promise<StorefrontDesign[]> {
  if (rawDesigns.length === 0) return []

  const supabase = await createClient()

  // Only website-enabled variants contribute to inventory lookup.
  const variantIds = rawDesigns.flatMap((d) =>
    (d.product_variants ?? [])
      .filter((v) => v.website_enabled)
      .map((v) => v.id),
  )

  const inventoryByVariant = new Map<string, StorefrontInventoryItem[]>()
  if (variantIds.length > 0) {
    const { data: inv } = await supabase
      .from('inventory_items')
      .select(
        'id, inventory_tag, floor_price, variant_id, net_metal_weight_g, stone_carat_total, stone_pcs_total, metal_purity_id, metal_purities(code)',
      )
      .in('variant_id', variantIds)
      .eq('status', 'available')
      .not('floor_price', 'is', null)
      .gt('floor_price', 0)

    for (const row of inv ?? []) {
      const list = inventoryByVariant.get(row.variant_id!) ?? []
      list.push({
        id: row.id,
        inventory_tag: row.inventory_tag,
        floor_price: Number(row.floor_price),
        net_metal_weight_g: Number(row.net_metal_weight_g ?? 0),
        stone_carat_total: Number(row.stone_carat_total ?? 0),
        stone_pcs_total: Number(row.stone_pcs_total ?? 0),
        metal_purity_code: (row as any).metal_purities?.code ?? null,
      })
      inventoryByVariant.set(row.variant_id!, list)
    }
  }

  return rawDesigns.map((d) => {
    const rawVariants = d.product_variants ?? []
    const variants: StorefrontVariant[] = rawVariants
      .filter((v) => v.website_enabled)
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        size_code: v.size_code,
        metal_purity_code: v.metal_purities?.code ?? null,
        approx_metal_weight_g: v.approx_metal_weight_g,
        approx_stone_carat: v.approx_stone_carat,
        approx_stone_pcs: v.approx_stone_pcs,
        default_price: v.default_price,
        is_default: v.is_default,
        available_items: inventoryByVariant.get(v.id) ?? [],
      }))

    const inStockCount = variants.reduce(
      (n, v) => n + v.available_items.length,
      0,
    )

    const inStockPrices = variants.flatMap((v) =>
      v.available_items.map((it) => it.floor_price),
    )
    const variantPrices = variants
      .map((v) => v.default_price)
      .filter((p): p is number => p != null && p > 0)

    const allPrices = [...inStockPrices, ...variantPrices]
    const minPrice =
      allPrices.length > 0 ? Math.min(...allPrices) : null

    const rawAssets = d.product_assets ?? []
    const images = rawAssets
      .filter((a) => a.asset_type === 'image')
      .map((a) => ({
        url: resolveAssetUrl(a.url),
        alt: a.alt_text,
        is_primary: a.is_primary,
        sort_order: a.sort_order,
      }))
      .sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        return a.sort_order - b.sort_order
      })

    const rawStones = d.product_design_stones ?? []
    const stones = rawStones.map((s) => ({
      shape: s.shape,
      color: s.color,
      clarity: s.clarity,
      carat_each: Number(s.carat_each ?? 0),
      pcs: s.pcs,
      cut: s.cut,
      category: s.stone_master?.category ?? null,
      stone_master: s.stone_master,
    }))

    return {
      id: d.id,
      design_code: d.design_code,
      name: d.name,
      slug: d.slug,
      description: d.description,
      short_description: d.short_description,
      category_id: d.category_id,
      category_name: d.categories?.name ?? null,
      category_slug: d.categories?.slug ?? null,
      brand_name: d.brands?.name ?? null,
      product_type: d.product_type,
      fulfillment_type:
        d.fulfillment_type as StorefrontDesign['fulfillment_type'],
      default_purity_id: d.default_purity_id,
      default_purity_code: d.metal_purities?.code ?? null,
      meta_title: d.meta_title,
      meta_description: d.meta_description,
      images,
      primary_image: images[0]?.url ?? null,
      stones,
      variants,
      in_stock_count: inStockCount,
      min_price: minPrice,
      has_price: minPrice !== null,
      available_inventory_item_ids: variants.flatMap((v) =>
        v.available_items.map((it) => it.id),
      ),
    }
  })
}

export async function getDesigns(
  filters: ShopFilters = {},
): Promise<StorefrontDesign[]> {
  const supabase = await createClient()

  let query = supabase
    .from('product_designs')
    .select(DESIGN_SELECT)
    .eq('is_published', true)

  if (filters.category) {
    const cat = await getCategoryBySlug(filters.category)
    if (cat) {
      const { data: children } = await supabase
        .from('categories')
        .select('id')
        .eq('parent_id', cat.id)
      const ids = [cat.id, ...(children ?? []).map((c) => c.id)]
      query = query.in('category_id', ids)
    }
  }

  if (filters.q) {
    const term = `%${filters.q}%`
    query = query.or(
      `name.ilike.${term},description.ilike.${term},short_description.ilike.${term}`,
    )
  }

  if (filters.purity) {
    const { data: p } = await supabase
      .from('metal_purities')
      .select('id')
      .eq('code', filters.purity)
      .maybeSingle()
    if (p) query = query.eq('default_purity_id', p.id)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(0, 9999)

  if (error) {
    console.error('[catalog] designs failed:', error.message)
    return []
  }

  let designs = await hydrateDesigns((data ?? []) as unknown as RawDesign[])

  if (filters.min_price) {
    const min = Number(filters.min_price)
    if (!Number.isNaN(min)) {
      designs = designs.filter(
        (d) => d.min_price !== null && d.min_price >= min,
      )
    }
  }
  if (filters.max_price) {
    const max = Number(filters.max_price)
    if (!Number.isNaN(max)) {
      designs = designs.filter(
        (d) => d.min_price !== null && d.min_price <= max,
      )
    }
  }

  const sort = filters.sort ?? 'newest'
  switch (sort) {
    case 'price_asc':
      designs.sort(
        (a, b) => (a.min_price ?? Infinity) - (b.min_price ?? Infinity),
      )
      break
    case 'price_desc':
      designs.sort(
        (a, b) => (b.min_price ?? -1) - (a.min_price ?? -1),
      )
      break
    case 'name_asc':
      designs.sort((a, b) => a.name.localeCompare(b.name))
      break
    default:
      break
  }

  return designs
}

export async function getDesignBySlug(
  slug: string,
): Promise<StorefrontDesign | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_designs')
    .select(DESIGN_SELECT)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (error || !data) return null
  const designs = await hydrateDesigns([
    data as unknown as RawDesign,
  ])
  return designs[0] ?? null
}

export async function getFeaturedDesigns(
  limit = 8,
): Promise<StorefrontDesign[]> {
  const designs = await getDesigns({ sort: 'newest' })
  return designs.filter((d) => d.in_stock_count > 0).slice(0, limit)
}

export async function getNewArrivals(limit = 8): Promise<StorefrontDesign[]> {
  const designs = await getDesigns({ sort: 'newest' })
  return designs.slice(0, limit)
}

export async function getAllPublishedSlugs(): Promise<
  { slug: string; category_slug: string | null }[]
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_designs')
    .select('slug, categories(slug)')
    .eq('is_published', true)
    .range(0, 9999)

  return (data ?? []).map((d: any) => ({
    slug: d.slug,
    category_slug: d.categories?.slug ?? null,
  }))
}   