import { requireRole } from '@/lib/guard'
import { NewInvoiceForm } from './new-invoice-form'
import { resolveAssetUrl } from '@/lib/storage-client'

export const dynamic = 'force-dynamic'

type StoneLine = {
  key: string
  category: string | null
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
  carat_each: number
  pcs: number
  carat_total: number
  rate_per_carat: number
  value: number
  source: 'actual' | 'design'
  stone_master_id: string | null
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ inventory?: string }>
}) {
  const { inventory } = await searchParams
  const { supabase } = await requireRole([
    'admin',
    'manager',
    'sales',
    'accountant',
  ])

  const {
    data: { user },
  } = await supabase.auth.getUser()
  const currentUserId = user?.id ?? null

  const [
    { data: customers },
    { data: rawItems },
    { data: rates },
    { data: metalTypes },
  ] = await Promise.all([
    supabase.from('customers').select('*').eq('is_active', true).order('name'),
    supabase
      .from('inventory_items')
      .select(
        `*, metal_purities(code, metal_type_id), product_variants(product_designs(id, name, design_code))`,
      )
      .eq('status', 'available')
      .order('inventory_tag'),
    supabase
      .from('metal_rates')
      .select('purity_id, rate_per_gram')
      .order('effective_from', { ascending: false })
      .limit(50),
    supabase.from('metal_types').select('id, name'),
  ])

  const latestRatesMap: Record<string, number> = {}
  for (const r of rates ?? []) {
    if (!latestRatesMap[r.purity_id]) {
      latestRatesMap[r.purity_id] = Number(r.rate_per_gram)
    }
  }
  const metalTypeMap = Object.fromEntries(
    (metalTypes ?? []).map((m) => [m.id, m.name]),
  )

  const availableItemIds = (rawItems ?? []).map((i) => i.id)

  const jobDesignMap: Record<string, string> = {}
  if (availableItemIds.length > 0) {
    const { data: jobs } = await supabase
      .from('craftsman_jobs')
      .select('inventory_item_id, design_id')
      .in('inventory_item_id', availableItemIds)
    for (const j of jobs ?? []) {
      if (j.inventory_item_id && j.design_id) {
        jobDesignMap[j.inventory_item_id] = j.design_id
      }
    }
  }

  const fallbackDesignIds = Object.values(jobDesignMap).filter(Boolean)
  const fallbackDesignMap: Record<
    string,
    { id: string; name: string; design_code: string }
  > = {}
  if (fallbackDesignIds.length > 0) {
    const { data: fallbackDesigns } = await supabase
      .from('product_designs')
      .select('id, name, design_code')
      .in('id', fallbackDesignIds)
    for (const d of fallbackDesigns ?? []) fallbackDesignMap[d.id] = d
  }

  // ── Stones: junction rows with stone_master link ──
  type RawStoneRow = {
    id: string
    inventory_item_id: string
    valuation: number | string
    carat: number | string
    pcs: number
    setting_type: string | null
    stone_item_id: string | null
    stone_lot_id: string | null
    stone_master_id: string | null
    category: string | null
    shape: string | null
    color: string | null
    clarity: string | null
    cut: string | null
    stone_item:
      | {
          id: string
          carat: number | string
          shape: string | null
          color: string | null
          clarity: string | null
          cut: string | null
          cost_per_carat: number | string | null
          selling_per_carat: number | string | null
          stone_master_id: string | null
        }
      | null
    stone_lot:
      | {
          id: string
          lot_number: string | null
          shape: string | null
          color: string | null
          clarity: string | null
          cut: string | null
          rate_per_carat: number | string | null
          stone_master_id: string | null
        }
      | null
  }

  let invStones: RawStoneRow[] = []
  if (availableItemIds.length > 0) {
    const { data, error: invStonesErr } = await supabase
      .from('inventory_item_stones')
      .select(`
        id,
        inventory_item_id,
        valuation,
        carat,
        pcs,
        setting_type,
        stone_item_id,
        stone_lot_id,
        stone_master_id,
        category,
        shape,
        color,
        clarity,
        cut,
        stone_item:stone_items!stone_item_id(
          id, carat, shape, color, clarity, cut,
          cost_per_carat, selling_per_carat, stone_master_id
        ),
        stone_lot:stone_lots!stone_lot_id(
          id, lot_number, shape, color, clarity, cut,
          rate_per_carat, stone_master_id
        )
      `)
      .in('inventory_item_id', availableItemIds)
    if (invStonesErr) {
      console.error(
        '[new-invoice-page] inventory_item_stones query failed:',
        invStonesErr.message,
      )
    }
    invStones = (data ?? []) as RawStoneRow[]
  }

  // ── Fetch stone_master for all referenced stone IDs ──
  const stoneMasterIds = new Set<string>()
  for (const s of invStones) {
    if (s.stone_master_id) stoneMasterIds.add(s.stone_master_id)
    if (s.stone_item?.stone_master_id) stoneMasterIds.add(s.stone_item.stone_master_id)
    if (s.stone_lot?.stone_master_id) stoneMasterIds.add(s.stone_lot.stone_master_id)
  }

  type StoneMaster = {
    id: string
    category: string | null
    shape: string | null
    color: string | null
    clarity: string | null
    cut: string | null
  }
  let stoneMasters: StoneMaster[] = []
  if (stoneMasterIds.size > 0) {
    const { data } = await supabase
      .from('stone_master')
      .select('id, category, shape, color, clarity, cut')
      .in('id', Array.from(stoneMasterIds))
    stoneMasters = (data ?? []) as StoneMaster[]
  }
  const stoneMasterMap: Record<string, StoneMaster> = Object.fromEntries(
    stoneMasters.map((m) => [m.id, m]),
  )

  // ── Fallback: product_design_stones ──
  const designIdsForStones = Array.from(
    new Set(
      (rawItems ?? [])
        .map(
          (item) =>
            item.product_variants?.product_designs?.id || jobDesignMap[item.id],
        )
        .filter(Boolean),
    ),
  )

  type DesignStone = {
    design_id: string
    stone_master_id: string
    shape: string | null
    color: string | null
    clarity: string | null
    carat_each: number | string
    pcs: number
    cut: string | null
  }

  let designStones: DesignStone[] = []
  if (designIdsForStones.length > 0) {
    const { data } = await supabase
      .from('product_design_stones')
      .select(
        'design_id, stone_master_id, shape, color, clarity, carat_each, pcs, cut',
      )
      .in('design_id', designIdsForStones)
    designStones = (data ?? []) as DesignStone[]
  }

  const designStonesByDesign: Record<string, DesignStone[]> = {}
  for (const ds of designStones) {
    if (!designStonesByDesign[ds.design_id]) designStonesByDesign[ds.design_id] = []
    designStonesByDesign[ds.design_id].push(ds)
  }

  // ── Build stone_lines per item ──
  const stoneLinesByItem: Record<string, StoneLine[]> = {}
  const stoneCostMap: Record<string, number> = {}

  for (const s of invStones) {
    const itemId = s.inventory_item_id
    if (!stoneLinesByItem[itemId]) stoneLinesByItem[itemId] = []

    const pcs = Number(s.pcs) || 1
    const caratTotal = Number(s.carat) || 0
    const caratEach = pcs > 0 ? caratTotal / pcs : 0
    const valuation = Number(s.valuation) || 0

    // ★ Prefer direct snapshot columns, then join to stone_item/stone_lot
    let category = s.category ?? null
    let shape = s.shape ?? null
    let color = s.color ?? null
    let clarity = s.clarity ?? null
    let cut = s.cut ?? null
    let masterId = s.stone_master_id ?? null
    let rate = 0

    // If direct columns empty, try stone_item/stone_lot join
    if (!category && !shape && !color && !clarity) {
      if (s.stone_item) {
        const si = s.stone_item
        const master = si.stone_master_id
          ? stoneMasterMap[si.stone_master_id]
          : null
        category = master?.category ?? null
        shape = si.shape ?? master?.shape ?? null
        color = si.color ?? master?.color ?? null
        clarity = si.clarity ?? master?.clarity ?? null
        cut = si.cut ?? master?.cut ?? null
        masterId = masterId ?? si.stone_master_id ?? null
        rate = Number(si.cost_per_carat) || 0
      } else if (s.stone_lot) {
        const sl = s.stone_lot
        const master = sl.stone_master_id
          ? stoneMasterMap[sl.stone_master_id]
          : null
        category = master?.category ?? null
        shape = sl.shape ?? master?.shape ?? null
        color = sl.color ?? master?.color ?? null
        clarity = sl.clarity ?? master?.clarity ?? null
        cut = sl.cut ?? master?.cut ?? null
        masterId = masterId ?? sl.stone_master_id ?? null
        rate = Number(sl.rate_per_carat) || 0
      }
    }

    if (rate <= 0 && caratTotal > 0 && valuation > 0) {
      rate = valuation / caratTotal
    }
    const value = rate > 0 ? rate * caratTotal : valuation

    stoneLinesByItem[itemId].push({
      key: `row-${s.id}`,
      category,
      shape,
      color,
      clarity,
      cut,
      carat_each: caratEach,
      pcs,
      carat_total: caratTotal,
      rate_per_carat: rate,
      value,
      source: 'actual',
      stone_master_id: masterId,
    })

    stoneCostMap[itemId] = (stoneCostMap[itemId] || 0) + (valuation || value)
  }

  for (const item of rawItems ?? []) {
    if (stoneCostMap[item.id]) continue
    const legacyDiamond = Number(
      (item.pricing_snapshot as any)?.legacy_total_diamond_price ?? 0,
    )
    if (legacyDiamond > 0) stoneCostMap[item.id] = legacyDiamond
  }

  for (const item of rawItems ?? []) {
    if ((stoneLinesByItem[item.id] ?? []).length > 0) continue

    const designId =
      item.product_variants?.product_designs?.id || jobDesignMap[item.id]
    if (!designId) continue

    const specs = designStonesByDesign[designId] ?? []
    if (specs.length === 0) continue

    const designTotalCarat = specs.reduce(
      (s, ds) => s + (Number(ds.carat_each) || 0) * (Number(ds.pcs) || 0),
      0,
    )
    const actualCaratTotal = Number(item.stone_carat_total) || 0
    const actualValue = stoneCostMap[item.id] || 0

    const scale =
      designTotalCarat > 0 && actualCaratTotal > 0
        ? actualCaratTotal / designTotalCarat
        : 1
    const impliedRate =
      actualCaratTotal > 0 && actualValue > 0
        ? actualValue / actualCaratTotal
        : 0

    stoneLinesByItem[item.id] = specs.map((ds, i) => {
      const pcs = Number(ds.pcs) || 1
      const caratEach = (Number(ds.carat_each) || 0) * scale
      const caratTotal = caratEach * pcs
      const master = ds.stone_master_id
        ? stoneMasterMap[ds.stone_master_id]
        : null

      return {
        key: `design-${designId}-${i}`,
        category: master?.category ?? null,
        shape: ds.shape ?? master?.shape ?? null,
        color: ds.color ?? master?.color ?? null,
        clarity: ds.clarity ?? master?.clarity ?? null,
        cut: ds.cut ?? master?.cut ?? null,
        carat_each: caratEach,
        pcs,
        carat_total: caratTotal,
        rate_per_carat: impliedRate,
        value: impliedRate * caratTotal,
        source: 'design' as const,
        stone_master_id: ds.stone_master_id ?? null,
      }
    })
  }

  const designIds = (rawItems ?? [])
    .map((i) => {
      const variantDesignId = i.product_variants?.product_designs?.id
      if (variantDesignId) return variantDesignId
      return jobDesignMap[i.id] || null
    })
    .filter(Boolean)

  const designImageMap: Record<string, string> = {}
  if (designIds.length > 0) {
    const { data: assets } = await supabase
      .from('product_assets')
      .select('design_id, url, is_primary')
      .in('design_id', designIds)
      .eq('asset_type', 'image')
      .order('is_primary', { ascending: false })
    for (const a of assets ?? []) {
      if (a.design_id && a.url && !designImageMap[a.design_id]) {
        designImageMap[a.design_id] = resolveAssetUrl(a.url)
      }
    }
  }

  const availableItems = (rawItems ?? []).map((item) => {
    let design = item.product_variants?.product_designs
    if (!design && jobDesignMap[item.id]) {
      design = fallbackDesignMap[jobDesignMap[item.id]]
    }

    const metalTypeName = item.metal_purities?.metal_type_id
      ? metalTypeMap[item.metal_purities.metal_type_id]
      : 'Metal'

    return {
      ...item,
      design_name: design?.name || null,
      image_url: design?.id
        ? resolveAssetUrl(designImageMap[design.id] ?? '')
        : null,
      metal_display: `${metalTypeName} ${item.metal_purities?.code || ''}`.trim(),
      stone_lines: stoneLinesByItem[item.id] ?? [],
    }
  })

  const { data: purities } = await supabase
    .from('metal_purities')
    .select('id, code')
    .eq('is_active', true)
  const finalMetalRates = (purities ?? []).map((p) => ({
    purity_id: p.id,
    code: p.code,
    rate_per_gram: latestRatesMap[p.id] || 0,
  }))

  return (
    <NewInvoiceForm
      customers={customers ?? []}
      availableItems={availableItems as any}
      presetInventoryId={inventory}
      metalRates={finalMetalRates}
      stoneCostMap={stoneCostMap}
      currentUserId={currentUserId}
    />
  )
}