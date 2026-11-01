'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { uploadImage, deleteImage, resolveAssetUrl, toStoragePath } from '@/lib/storage-client'
import { slugify } from '@/lib/slug'
import { computeMakingCharge, type MakingChargeType } from '@/lib/making-charge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Check, ChevronDown, ChevronRight, Gem, Plus, Trash2, Upload, Star, X,
  ImagePlus, Sparkles, Package2, Layers, CircleDollarSign, Image as ImageIcon,
  ChevronLeft, AlertTriangle, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────

type MetalType = { id: string; name: string }
type Purity = { id: string; code: string; purity_percent: number; metal_type: MetalType | null }
type Category = { id: string; name: string; parent_id: string | null }
type Brand = { id: string; name: string }
type StoneMaster = {
  id: string
  category: 'diamond' | 'gemstone' | 'lab_grown' | 'synthetic' | 'other'
  name: string | null
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
  origin: string | null
}
type Material = { id: string; code: string; name: string; category: string; unit: string; default_rate: number }

type DesignStone = {
  key: string
  id?: string
  stone_master_id: string
  shape: string
  color: string
  clarity: string
  cut: string
  carat_each: string
  pcs: string
  tracking_mode: 'serialised' | 'lot'
}

type DesignMaterial = {
  key: string
  id?: string
  material_id: string
  quantity: string
  unit: string
}

type DesignVariant = {
  key: string
  id?: string
  sku: string
  size_code: string
  metal_purity_id: string
  approx_metal_weight_g: string
  approx_stone_carat: string
  approx_stone_pcs: string
  default_price: string
  is_default: boolean
  pos_enabled: boolean
  website_enabled: boolean
}

type DesignAsset = {
  key: string
  id?: string
  url: string
  alt_text: string
  is_primary: boolean
  asset_type?: 'image' | 'video' | '3d' | '360'
  isNew?: boolean
  uploading?: boolean
  progress?: number
}

type Design = {
  id: string
  design_code: string
  name: string
  slug: string
  category_id: string | null
  brand_id: string | null
  description: string | null
  short_description: string | null
  product_type: 'jewellery' | 'loose_stone' | 'service'
  fulfillment_type: 'in_stock' | 'made_to_order' | 'hybrid'
  default_purity_id: string | null
  making_charge_type: MakingChargeType
  making_charge_value: number | string
  is_published: boolean
  pos_enabled: boolean
  meta_title: string | null
  meta_description: string | null
  variants?: any[]
  stones?: any[]
  materials?: any[]
  assets?: any[]
}

type Props = {
  mode: 'create' | 'edit'
  initialDesign?: Design
  categories: Category[]
  brands: Brand[]
  purities: Purity[]
  stoneMasters: StoneMaster[]
  materials: Material[]
  latestRates: Record<string, number>
}

// ─── Constants ─────────────────────────────────────────────────────────

const PRODUCT_TYPES = [
  { value: 'jewellery',   label: 'Jewellery',    hint: 'Ring, chain, bangle, pendant — physical finished piece' },
  { value: 'loose_stone', label: 'Loose stone',  hint: 'Sold as a stone, no metal mounting' },
  { value: 'service',     label: 'Service',      hint: 'Repair, polishing, resizing — no physical item' },
] as const

const FULFILLMENT_TYPES = [
  { value: 'in_stock',      label: 'In stock',       hint: 'Ready to sell now' },
  { value: 'made_to_order', label: 'Made to order',  hint: 'Produced on order, delivered later' },
  { value: 'hybrid',        label: 'Hybrid',         hint: 'Sell from stock; reorder as needed' },
] as const

const MAKING_CHARGE_TYPES = [
  { value: 'fixed',            label: 'Fixed ₹',        hint: 'Flat amount per piece' },
  { value: 'per_gram',         label: '₹ per gram',     hint: 'Amount × net metal weight' },
  { value: 'percent_of_metal', label: '% of metal',     hint: 'Percent × metal value' },
  { value: 'percent_of_total', label: '% of total',     hint: 'Percent × (metal + stones)' },
] as const

const STONE_CATEGORIES = ['diamond', 'gemstone', 'lab_grown', 'synthetic', 'other'] as const

// ─── Helpers ───────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID()
const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'
}
const fmtRate = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—'
}

function emptyStone(): DesignStone {
  return {
    key: uid(),
    stone_master_id: '',
    shape: '', color: '', clarity: '', cut: '',
    carat_each: '0', pcs: '1', tracking_mode: 'lot',
  }
}
function emptyMaterial(materials: Material[]): DesignMaterial {
  const first = materials[0]
  return {
    key: uid(),
    material_id: first?.id ?? '',
    quantity: '1',
    unit: first?.unit ?? 'piece',
  }
}
function emptyVariant(defaultPurityId: string | null, isDefault = false): DesignVariant {
  return {
    key: uid(),
    sku: '',
    size_code: '',
    metal_purity_id: defaultPurityId ?? '',
    approx_metal_weight_g: '0',
    approx_stone_carat: '0',
    approx_stone_pcs: '0',
    default_price: '',
    is_default: isDefault,
    pos_enabled: true,
    website_enabled: false,
  }
}
function variantFromRow(v: any, isDefault: boolean): DesignVariant {
  return {
    key: uid(),
    id: v.id,
    sku: v.sku ?? '',
    size_code: v.size_code ?? '',
    metal_purity_id: v.metal_purity_id ?? '',
    approx_metal_weight_g: String(v.approx_metal_weight_g ?? '0'),
    approx_stone_carat: String(v.approx_stone_carat ?? '0'),
    approx_stone_pcs: String(v.approx_stone_pcs ?? '0'),
    default_price: String(v.default_price ?? ''),
    is_default: v.is_default ?? isDefault,
    pos_enabled: v.pos_enabled ?? true,
    website_enabled: v.website_enabled ?? false,
  }
}
function stoneFromRow(s: any): DesignStone {
  return {
    key: uid(),
    id: s.id,
    stone_master_id: s.stone_master_id ?? '',
    shape: s.shape ?? '',
    color: s.color ?? '',
    clarity: s.clarity ?? '',
    cut: s.cut ?? '',
    carat_each: String(s.carat_each ?? '0'),
    pcs: String(s.pcs ?? '1'),
    tracking_mode: s.tracking_mode ?? 'lot',
  }
}
function materialFromRow(m: any): DesignMaterial {
  return {
    key: uid(),
    id: m.id,
    material_id: m.material_id ?? '',
    quantity: String(m.quantity ?? '1'),
    unit: m.unit ?? 'piece',
  }
}
function assetFromRow(a: any): DesignAsset {
  return {
    key: uid(),
    id: a.id,
    url: a.asset_type === 'video' ? a.url : a.url,
    alt_text: a.alt_text ?? '',
    is_primary: a.is_primary ?? false,
    asset_type: a.asset_type ?? 'image',
  }
}

// ─── Main component ────────────────────────────────────────────────────

export function DesignForm({
  mode,
  initialDesign,
  categories,
  brands,
  purities,
  stoneMasters,
  materials,
  latestRates,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  // ── Basics ──
  const [name, setName] = useState(initialDesign?.name ?? '')
  const [slug, setSlug] = useState(initialDesign?.slug ?? '')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(mode === 'edit')
  const [categoryId, setCategoryId] = useState(initialDesign?.category_id ?? '')
  const [brandId, setBrandId] = useState(initialDesign?.brand_id ?? '')
  const [description, setDescription] = useState(initialDesign?.description ?? '')
  const [shortDescription, setShortDescription] = useState(initialDesign?.short_description ?? '')
  const [productType, setProductType] = useState<Design['product_type']>(initialDesign?.product_type ?? 'jewellery')
  const [fulfillmentType, setFulfillmentType] = useState<Design['fulfillment_type']>(initialDesign?.fulfillment_type ?? 'in_stock')

  // ── Metal ──
  const [defaultPurityId, setDefaultPurityId] = useState(initialDesign?.default_purity_id ?? '')
  const [makingChargeType, setMakingChargeType] = useState<MakingChargeType>(
    (initialDesign?.making_charge_type as MakingChargeType) ?? 'percent_of_metal',
  )
  const [makingChargeValue, setMakingChargeValue] = useState(
    String(initialDesign?.making_charge_value ?? '12'),
  )

  // ── Stones ──
  const [stones, setStones] = useState<DesignStone[]>(
    (initialDesign?.stones ?? []).map(stoneFromRow),
  )

  // ── Materials ──
  const [designMaterials, setDesignMaterials] = useState<DesignMaterial[]>(
    (initialDesign?.materials ?? []).map(materialFromRow),
  )

  // ── Variants ──
  const [variants, setVariants] = useState<DesignVariant[]>(() => {
    if (initialDesign?.variants && initialDesign.variants.length > 0) {
      return initialDesign.variants.map((v, idx) =>
        variantFromRow(v, v.is_default ?? idx === 0),
      )
    }
    return [emptyVariant(initialDesign?.default_purity_id ?? null, true)]
  })

  // ── Assets ──
  const [assets, setAssets] = useState<DesignAsset[]>(
    (initialDesign?.assets ?? []).map(assetFromRow),
  )

  // ── Publishing ──
  const [isPublished, setIsPublished] = useState(initialDesign?.is_published ?? false)
  const [posEnabled, setPosEnabled] = useState(initialDesign?.pos_enabled ?? true)
  const [metaTitle, setMetaTitle] = useState(initialDesign?.meta_title ?? '')
  const [metaDescription, setMetaDescription] = useState(initialDesign?.meta_description ?? '')

  // ── UI state ──
  const [saving, setSaving] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(['basics', 'metal']),
  )
  const [quickStoneOpen, setQuickStoneOpen] = useState(false)
  const [quickMaterialOpen, setQuickMaterialOpen] = useState(false)
  const [localStoneMasters, setLocalStoneMasters] = useState(stoneMasters)
  const [localMaterials, setLocalMaterials] = useState(materials)

  // ── Slug auto-fill ──
  useEffect(() => {
    if (!slugManuallyEdited && name) setSlug(slugify(name))
  }, [name, slugManuallyEdited])

  // ── Progress ──
  const progress = useMemo(() => {
    const s = {
      basics: !!(name && slug && categoryId),
      metal: productType !== 'jewellery' || !!defaultPurityId,
      stones: true,
      materials: true,
      variants: variants.length > 0 && variants.every((v) => v.sku && Number(v.default_price) > 0),
      images: assets.length > 0,
      publishing: true,
    }
    const total = Object.keys(s).length
    const done = Object.values(s).filter(Boolean).length
    return { sections: s, total, done, pct: Math.round((done / total) * 100) }
  }, [name, slug, categoryId, productType, defaultPurityId, variants, assets])

  // ── Making-charge preview ──
  const makingPreview = useMemo(() => {
    const defaultVariant = variants.find((v) => v.is_default) ?? variants[0]
    const purity = purities.find((p) => p.id === (defaultVariant?.metal_purity_id || defaultPurityId))
    const rate = purity ? latestRates[purity.id] ?? 0 : 0
    const netWeight = Number(defaultVariant?.approx_metal_weight_g ?? 0)
    const stoneCarat = Number(defaultVariant?.approx_stone_carat ?? 0)
    const stoneValue = stones.reduce((sum, s) => {
      const master = localStoneMasters.find((m) => m.id === s.stone_master_id)
      const stoneRate = 5000 // fallback; real rate comes from stone_lots at sale time
      return sum + Number(s.carat_each) * Number(s.pcs) * stoneRate
    }, 0)
    const metalValue = netWeight * rate
    try {
      return computeMakingCharge(
        { type: makingChargeType, value: Number(makingChargeValue) || 0 },
        { netMetalFineG: netWeight, metalRatePerG: rate, stoneValue },
      )
    } catch {
      return { amount: 0, basis: '—', formula: '—' }
    }
  }, [variants, purities, defaultPurityId, latestRates, stones, localStoneMasters, makingChargeType, makingChargeValue])

  // ── Section helpers ──
  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Stone ops ──
  function updateStone(key: string, patch: Partial<DesignStone>) {
    setStones((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  }
  function removeStone(key: string) {
    setStones((prev) => prev.filter((s) => s.key !== key))
  }
  function onStoneMasterChange(key: string, masterId: string) {
    const m = localStoneMasters.find((s) => s.id === masterId)
    updateStone(key, {
      stone_master_id: masterId,
      shape: m?.shape ?? '',
      color: m?.color ?? '',
      clarity: m?.clarity ?? '',
      cut: m?.cut ?? '',
    })
  }

  // ── Material ops ──
  function updateMaterial(key: string, patch: Partial<DesignMaterial>) {
    setDesignMaterials((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } : m)))
  }
  function removeMaterial(key: string) {
    setDesignMaterials((prev) => prev.filter((m) => m.key !== key))
  }

  // ── Variant ops ──
  function updateVariant(key: string, patch: Partial<DesignVariant>) {
    setVariants((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)))
  }
  function removeVariant(key: string) {
    setVariants((prev) => {
      const filtered = prev.filter((v) => v.key !== key)
      if (filtered.length > 0 && !filtered.some((v) => v.is_default)) {
        filtered[0] = { ...filtered[0], is_default: true }
      }
      return filtered
    })
  }
  function setDefaultVariant(key: string) {
    setVariants((prev) => prev.map((v) => ({ ...v, is_default: v.key === key })))
  }

  // ── Save ──
  async function save(e: React.FormEvent) {
    e.preventDefault()

    // ── Sync pre-flight ──
    if (!name.trim()) return toast.error('Design name is required')
    if (!slug.trim()) return toast.error('Slug is required')
    if (productType === 'jewellery' && !defaultPurityId) {
      return toast.error('Pick a default purity for a jewellery design')
    }
    const mcvNum = Number(makingChargeValue)
    if (!Number.isFinite(mcvNum) || mcvNum < 0) {
      return toast.error('Making charge value must be a non-negative number')
    }
    if (variants.length === 0) return toast.error('At least one variant is required')

    const badStone = stones.find((s) => !s.stone_master_id)
    if (badStone) return toast.error('Every stone row needs a stone type selected')

    const badMat = designMaterials.find((m) => !m.material_id)
    if (badMat) return toast.error('Every material row needs a material selected')

    const badVariant = variants.find((v) => !v.sku.trim() || !(Number(v.default_price) > 0))
    if (badVariant) {
      return toast.error(`Variant "${badVariant.sku || '(new)'}" needs an SKU and a default price > 0`)
    }

    // Form-level SKU uniqueness (case-insensitive)
    const seenSkus = new Set<string>()
    for (const v of variants) {
      const k = v.sku.trim().toLowerCase()
      if (seenSkus.has(k)) {
        return toast.error(`Duplicate SKU within this design: ${v.sku}`)
      }
      seenSkus.add(k)
    }

    setSaving(true)
    try {
      // ── Async uniqueness checks against DB ──
      // Slug
      const { data: slugClash, error: slugErr } = await supabase
        .from('product_designs')
        .select('id')
        .eq('slug', slug.trim())
        .maybeSingle()
      if (slugErr) throw slugErr
      if (slugClash && slugClash.id !== initialDesign?.id) {
        throw new Error('That slug is already used by another design — pick a different one')
      }

      // SKU (across all designs; variant uniqueness is table-wide)
      const skusToCheck = variants.map((v) => v.sku.trim())
      if (skusToCheck.length > 0) {
        const { data: skuClash, error: skuErr } = await supabase
          .from('product_variants')
          .select('sku, design_id')
          .in('sku', skusToCheck)
        if (skuErr) throw skuErr
        const conflicting = (skuClash ?? []).find((r) => r.design_id !== initialDesign?.id)
        if (conflicting) {
          throw new Error(`SKU "${conflicting.sku}" is already used by another design`)
        }
      }

      let designId: string
      let designCode: string

      if (mode === 'edit' && initialDesign) {
        const { error } = await supabase
          .from('product_designs')
          .update({
            name: name.trim(),
            slug: slug.trim(),
            category_id: categoryId || null,
            brand_id: brandId || null,
            description: description || null,
            short_description: shortDescription || null,
            product_type: productType,
            fulfillment_type: fulfillmentType,
            default_purity_id: defaultPurityId || null,
            making_charge_type: makingChargeType,
            making_charge_value: mcvNum,
            is_published: isPublished,
            pos_enabled: posEnabled,
            meta_title: metaTitle || null,
            meta_description: metaDescription || null,
          })
          .eq('id', initialDesign.id)
        if (error) throw error
        designId = initialDesign.id
        designCode = initialDesign.design_code
      } else {
        const { data, error } = await supabase
          .from('product_designs')
          .insert({
            name: name.trim(),
            slug: slug.trim(),
            category_id: categoryId || null,
            brand_id: brandId || null,
            description: description || null,
            short_description: shortDescription || null,
            product_type: productType,
            fulfillment_type: fulfillmentType,
            default_purity_id: defaultPurityId || null,
            making_charge_type: makingChargeType,
            making_charge_value: mcvNum,
            is_published: isPublished,
            pos_enabled: posEnabled,
            meta_title: metaTitle || null,
            meta_description: metaDescription || null,
          })
          .select('id, design_code')
          .single()
        if (error) throw error
        designId = data.id
        designCode = data.design_code
      }

      // ── Stones (delete-and-reinsert; safe — product_design_stones has no FK dependents) ──
      const { error: delStonesErr } = await supabase
        .from('product_design_stones').delete().eq('design_id', designId)
      if (delStonesErr) throw delStonesErr

      if (stones.length > 0) {
        const { error } = await supabase.from('product_design_stones').insert(
          stones.map((s, idx) => ({
            design_id: designId,
            stone_master_id: s.stone_master_id,
            shape: s.shape || null,
            color: s.color || null,
            clarity: s.clarity || null,
            cut: s.cut || null,
            carat_each: Math.max(0, Number(s.carat_each) || 0),
            pcs: Math.max(1, Number(s.pcs) || 1),
            sort_order: idx,
            tracking_mode: s.tracking_mode,
          })),
        )
        if (error) throw error
      }

      // ── Materials ──
      const { error: delMatsErr } = await supabase
        .from('product_design_materials').delete().eq('design_id', designId)
      if (delMatsErr) throw delMatsErr

      if (designMaterials.length > 0) {
        const { error } = await supabase.from('product_design_materials').insert(
          designMaterials.map((m, idx) => ({
            design_id: designId,
            material_id: m.material_id,
            quantity: Number(m.quantity) > 0 ? Number(m.quantity) : 1,
            unit: m.unit || null,
            sort_order: idx,
          })),
        )
        if (error) throw error
      }

      // ── Variants: upsert by id, delete removed, auto-fill SKU if blank ──
      const incomingIds = new Set(variants.filter((v) => v.id).map((v) => v.id!))
      if (mode === 'edit' && initialDesign?.variants) {
        const toDelete = initialDesign.variants
          .map((v) => v.id as string)
          .filter((id) => !incomingIds.has(id))
        if (toDelete.length > 0) {
          const { error: delVarErr } = await supabase
            .from('product_variants').delete().in('id', toDelete)
          if (delVarErr) {
            if (delVarErr.code === '23503') {
              throw new Error(
                'Cannot remove a variant that has inventory or jobs linked to it. ' +
                'Mark it inactive instead of deleting.',
              )
            }
            throw delVarErr
          }
        }
      }

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i]
        const computedSku = v.sku.trim() || `${designCode}-${v.size_code || 'STD'}-${i + 1}`
        const row = {
          design_id: designId,
          sku: computedSku,
          size_code: v.size_code || null,
          metal_purity_id: v.metal_purity_id || defaultPurityId || null,
          approx_metal_weight_g: Math.max(0, Number(v.approx_metal_weight_g) || 0),
          approx_stone_carat: Math.max(0, Number(v.approx_stone_carat) || 0),
          approx_stone_pcs: Math.max(0, Number(v.approx_stone_pcs) || 0),
          default_price: v.default_price ? Number(v.default_price) : null,
          is_default: v.is_default,
          pos_enabled: v.pos_enabled,
          website_enabled: v.website_enabled,
        }
        if (v.id) {
          const { error } = await supabase.from('product_variants').update(row).eq('id', v.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('product_variants').insert(row)
          if (error) throw error
        }
      }

      // ── Assets: delete removed, insert/update the rest ──
      const persistedAssetIds = assets.filter((a) => a.id).map((a) => a.id!)
      if (mode === 'edit' && initialDesign?.assets) {
        const toDelete = initialDesign.assets
          .map((a) => a.id as string)
          .filter((id) => !persistedAssetIds.includes(id))
        if (toDelete.length > 0) {
          const { error: delAssetErr } = await supabase
            .from('product_assets').delete().in('id', toDelete)
          if (delAssetErr) throw delAssetErr
          for (const id of toDelete) {
            const oldAsset = initialDesign.assets.find((a: any) => a.id === id)
            if (oldAsset?.url) await deleteImage(oldAsset.url).catch(() => {})
          }
        }
      }
      for (const a of assets) {
        if (!a.id) {
                    const { error } = await supabase.from('product_assets').insert({
            design_id: designId,
            asset_type: a.asset_type ?? 'image',
            url: a.asset_type === 'video' ? a.url : a.url,
            alt_text: a.alt_text || null,
            is_primary: a.is_primary,
            sort_order: assets.indexOf(a),
          })
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('product_assets')
            .update({ alt_text: a.alt_text || null, is_primary: a.is_primary })
            .eq('id', a.id)
          if (error) throw error
        }
      }

      toast.success(mode === 'edit' ? 'Design updated' : 'Design created')
      router.push('/designs')
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* Main column */}
      <div className="space-y-4">
        {/* Basics */}
        <Section
          id="basics"
          title="Identity & positioning"
          subtitle="What is this piece, who is it for, where does it belong?"
          icon={Sparkles}
          done={progress.sections.basics}
          open={openSections.has('basics')}
          onToggle={() => toggleSection('basics')}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Design name <span className="text-danger">*</span></Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Classic Solitaire Ring"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label>URL slug <span className="text-danger">*</span></Label>
              <Input
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugManuallyEdited(true) }}
                placeholder="classic-solitaire-ring"
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-fg-subtle">Auto-generated from the name. Must be unique.</p>
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">— Select category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Brand</Label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">— No brand —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Product type <span className="text-danger">*</span></Label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value as Design['product_type'])}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                {PRODUCT_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-fg-subtle">
                {PRODUCT_TYPES.find((p) => p.value === productType)?.hint}
              </p>
            </div>
            <div>
              <Label>Fulfillment <span className="text-danger">*</span></Label>
              <select
                value={fulfillmentType}
                onChange={(e) => setFulfillmentType(e.target.value as Design['fulfillment_type'])}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                {FULFILLMENT_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-fg-subtle">
                {FULFILLMENT_TYPES.find((f) => f.value === fulfillmentType)?.hint}
              </p>
            </div>
            <div className="md:col-span-2">
              <Label>Short description</Label>
              <Input
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="One line shown in catalogs and POS."
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Full description</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                placeholder="Craft notes, styling, occasion. Shown on the website if published."
              />
            </div>
          </div>
        </Section>

        {/* Metal */}
        <Section
          id="metal"
          title="Metal & making charge"
          subtitle="Default purity and how the workshop bills its labour."
          icon={CircleDollarSign}
          done={progress.sections.metal}
          open={openSections.has('metal')}
          onToggle={() => toggleSection('metal')}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Default metal purity {productType === 'jewellery' && <span className="text-danger">*</span>}</Label>
              <select
                value={defaultPurityId}
                onChange={(e) => setDefaultPurityId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">— Select purity —</option>
                {purities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.metal_type?.name ?? ''} {p.code} · {p.purity_percent}%
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Making charge type <span className="text-danger">*</span></Label>
              <select
                value={makingChargeType}
                onChange={(e) => setMakingChargeType(e.target.value as MakingChargeType)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                {MAKING_CHARGE_TYPES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label} — {m.hint}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Making charge value <span className="text-danger">*</span></Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={makingChargeValue}
                onChange={(e) => setMakingChargeValue(e.target.value)}
                className="mt-1 tabular-nums"
              />
            </div>
            <div className="rounded-md border border-border bg-surface-muted p-3">
              <div className="text-[11px] uppercase tracking-wide text-fg-muted">Preview (default variant)</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-fg">₹ {fmtMoney(makingPreview.amount)}</div>
              <div className="text-[11px] text-fg-muted">{makingPreview.formula}</div>
            </div>
          </div>
        </Section>

        {/* Stones */}
        <Section
          id="stones"
          title="Stones"
          subtitle="What stones sit on the piece, and how many."
          icon={Gem}
          done={progress.sections.stones}
          open={openSections.has('stones')}
          onToggle={() => toggleSection('stones')}
          badge={stones.length > 0 ? `${stones.length}` : undefined}
        >
          {localStoneMasters.length === 0 && (
            <Banner tone="warning">
              No stone types defined yet. Add one below, or seed <code className="font-mono">stone_master</code> in Settings.
            </Banner>
          )}

          {stones.length === 0 ? (
            <EmptyRow
              icon={Gem}
              title="No stones on this design"
              description="Add a stone row for each distinct stone type."
              cta="Add stone"
              onClick={() => setStones([...stones, emptyStone()])}
            />
          ) : (
            <div className="space-y-2">
              {stones.map((s, idx) => (
                <div key={s.key} className="rounded-md border border-border bg-surface-muted/40 p-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-4">
                      <Label className="text-xs">Stone type <span className="text-danger">*</span></Label>
                      <select
                        value={s.stone_master_id}
                        onChange={(e) => onStoneMasterChange(s.key, e.target.value)}
                        className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm"
                      >
                        <option value="">— Select —</option>
                        {localStoneMasters.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.category} {m.name ? `· ${m.name}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Shape</Label>
                      <Input
                        value={s.shape}
                        onChange={(e) => updateStone(s.key, { shape: e.target.value })}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Color</Label>
                      <Input
                        value={s.color}
                        onChange={(e) => updateStone(s.key, { color: e.target.value })}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <Label className="text-xs">Clarity</Label>
                      <Input
                        value={s.clarity}
                        onChange={(e) => updateStone(s.key, { clarity: e.target.value })}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <Label className="text-xs">Cut</Label>
                      <Input
                        value={s.cut}
                        onChange={(e) => updateStone(s.key, { cut: e.target.value })}
                        className="mt-1 h-9 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <Label className="text-xs">Ct each</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        value={s.carat_each}
                        onChange={(e) => updateStone(s.key, { carat_each: e.target.value })}
                        className="mt-1 h-9 text-right text-xs tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <Label className="text-xs">Pcs</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={s.pcs}
                        onChange={(e) => updateStone(s.key, { pcs: e.target.value })}
                        className="mt-1 h-9 text-right text-xs tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Tracking</Label>
                      <div className="flex rounded border border-border bg-surface p-0.5">
                        {(['lot', 'serialised'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => updateStone(s.key, { tracking_mode: mode })}
                            className={cn(
                              'rounded px-2 py-0.5 text-[11px] capitalize',
                              s.tracking_mode === mode ? 'bg-brand-50 text-brand-700' : 'text-fg-muted',
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-[11px] text-fg-muted">
                      Total: <span className="tabular-nums text-fg">{(Number(s.carat_each) * Number(s.pcs)).toFixed(3)} ct</span>
                    </div>
                    <Button
                      type="button"
                      variant="destructive-ghost"
                      size="sm"
                      onClick={() => removeStone(s.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setStones([...stones, emptyStone()])}>
                  <Plus className="h-3.5 w-3.5" /> Add another stone
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setQuickStoneOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5" /> Add new stone type
                </Button>
              </div>
            </div>
          )}
        </Section>

        {/* Materials */}
        <Section
          id="materials"
          title="Materials & findings"
          subtitle="Leather straps, clasps, threads, decorative findings — anything non-metal, non-stone."
          icon={Package2}
          done={progress.sections.materials}
          open={openSections.has('materials')}
          onToggle={() => toggleSection('materials')}
          badge={designMaterials.length > 0 ? `${designMaterials.length}` : undefined}
        >
          {designMaterials.length === 0 ? (
            <EmptyRow
              icon={Package2}
              title="No additional materials"
              description="Skip this if the piece is metal + stone only. Add a row for leather belts, clasps, threads, etc."
              cta="Add material"
              onClick={() => setDesignMaterials([...designMaterials, emptyMaterial(localMaterials)])}
            />
          ) : (
            <div className="space-y-2">
              {designMaterials.map((m) => (
                <div key={m.key} className="grid grid-cols-1 gap-2 rounded-md border border-border bg-surface-muted/40 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <Label className="text-xs">Material</Label>
                    <select
                      value={m.material_id}
                      onChange={(e) => {
                        const chosen = localMaterials.find((x) => x.id === e.target.value)
                        updateMaterial(m.key, {
                          material_id: e.target.value,
                          unit: chosen?.unit ?? m.unit,
                        })
                      }}
                      className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-2 text-sm"
                    >
                      <option value="">— Select —</option>
                      {localMaterials.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} {x.category ? `· ${x.category}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={m.quantity}
                      onChange={(e) => updateMaterial(m.key, { quantity: e.target.value })}
                      className="mt-1 h-9 text-right text-xs tabular-nums"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Unit</Label>
                    <Input
                      value={m.unit}
                      onChange={(e) => updateMaterial(m.key, { unit: e.target.value })}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="flex items-end justify-end sm:col-span-2">
                    <Button
                      type="button"
                      variant="destructive-ghost"
                      size="sm"
                      onClick={() => removeMaterial(m.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDesignMaterials([...designMaterials, emptyMaterial(localMaterials)])}>
                  <Plus className="h-3.5 w-3.5" /> Add material
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setQuickMaterialOpen(true)}>
                  <Sparkles className="h-3.5 w-3.5" /> Add new material type
                </Button>
              </div>
            </div>
          )}
        </Section>

        {/* Variants */}
        <Section
          id="variants"
          title="Variants"
          subtitle="One row per size / metal / finish combination you actually stock or sell."
          icon={Layers}
          done={progress.sections.variants}
          open={openSections.has('variants')}
          onToggle={() => toggleSection('variants')}
          badge={`${variants.length}`}
        >
          <div className="space-y-3">
            {variants.map((v, idx) => (
              <div key={v.key} className="rounded-md border border-border bg-surface-muted/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-fg">Variant {idx + 1}</span>
                    {v.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
                        <Star className="h-2.5 w-2.5 fill-current" /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!v.is_default && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDefaultVariant(v.key)}>
                        <Star className="h-3.5 w-3.5" /> Make default
                      </Button>
                    )}
                    {variants.length > 1 && (
                      <Button type="button" variant="destructive-ghost" size="sm" onClick={() => removeVariant(v.key)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-12">
                  <div className="col-span-2 sm:col-span-3">
                    <Label className="text-xs">SKU <span className="text-danger">*</span></Label>
                    <Input
                      value={v.sku}
                      onChange={(e) => updateVariant(v.key, { sku: e.target.value })}
                      placeholder={initialDesign ? `${initialDesign.design_code}-STD` : 'Auto after save'}
                      className="mt-1 h-9 font-mono text-xs"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-xs">Size</Label>
                    <Input
                      value={v.size_code}
                      onChange={(e) => updateVariant(v.key, { size_code: e.target.value })}
                      placeholder="14"
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-xs">Purity</Label>
                    <select
                      value={v.metal_purity_id}
                      onChange={(e) => updateVariant(v.key, { metal_purity_id: e.target.value })}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-xs"
                    >
                      <option value="">Inherit</option>
                      {purities.map((p) => (
                        <option key={p.id} value={p.id}>{p.code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <Label className="text-xs">Weight (g)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      value={v.approx_metal_weight_g}
                      onChange={(e) => updateVariant(v.key, { approx_metal_weight_g: e.target.value })}
                      className="mt-1 h-9 text-right text-xs tabular-nums"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-1">
                    <Label className="text-xs">Ct</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      value={v.approx_stone_carat}
                      onChange={(e) => updateVariant(v.key, { approx_stone_carat: e.target.value })}
                      className="mt-1 h-9 text-right text-xs tabular-nums"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-1">
                    <Label className="text-xs">Pcs</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      step="1"
                      value={v.approx_stone_pcs}
                      onChange={(e) => updateVariant(v.key, { approx_stone_pcs: e.target.value })}
                      className="mt-1 h-9 text-right text-xs tabular-nums"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs">Price ₹</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={v.default_price}
                      onChange={(e) => updateVariant(v.key, { default_price: e.target.value })}
                      className="mt-1 h-9 text-right text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  <Checkbox
                    checked={v.pos_enabled}
                    onChange={(x) => updateVariant(v.key, { pos_enabled: x })}
                    label="POS enabled"
                  />
                  <Checkbox
                    checked={v.website_enabled}
                    onChange={(x) => updateVariant(v.key, { website_enabled: x })}
                    label="Website enabled"
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVariants([...variants, emptyVariant(defaultPurityId, false)])}
            >
              <Plus className="h-3.5 w-3.5" /> Add variant
            </Button>
          </div>
        </Section>

        {/* Images */}
        <Section
          id="images"
          title="Images"
          subtitle="Product photos. Mark one as primary — it's the thumbnail everywhere."
          icon={ImageIcon}
          done={progress.sections.images}
          open={openSections.has('images')}
          onToggle={() => toggleSection('images')}
          badge={assets.length > 0 ? `${assets.length}` : undefined}
        >
          <ImageUploader assets={assets} onChange={setAssets} designId={initialDesign?.id} />
        </Section>

        {/* Publishing */}
        <Section
          id="publishing"
          title="Publishing & SEO"
          subtitle="Where this design is visible and how it appears."
          icon={Check}
          done={progress.sections.publishing}
          open={openSections.has('publishing')}
          onToggle={() => toggleSection('publishing')}
        >
          <div className="space-y-3">
            <Checkbox
              checked={isPublished}
              onChange={setIsPublished}
              label="Publish to website catalog"
              hint="Unpublished designs still appear in the internal Catalog and POS picker."
            />
            <Checkbox
              checked={posEnabled}
              onChange={setPosEnabled}
              label="Available at POS"
              hint="Shown in the 'Add piece' picker when creating invoices."
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label>Meta title</Label>
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="Overrides the design name in Google results."
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Meta description</Label>
                <Input
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="160-char summary for search engines."
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* Sticky summary */}
      <aside className="lg:sticky lg:top-20 lg:h-fit">
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Progress</span>
            <span className="text-xs tabular-nums text-fg">{progress.done}/{progress.total}</span>
          </div>
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${progress.pct}%` }}
            />
          </div>

          <ul className="space-y-1.5 text-xs">
            {[
              { id: 'basics', label: 'Basics', done: progress.sections.basics },
              { id: 'metal', label: 'Metal & making', done: progress.sections.metal },
              { id: 'stones', label: 'Stones', done: progress.sections.stones },
              { id: 'materials', label: 'Materials', done: progress.sections.materials },
              { id: 'variants', label: 'Variants', done: progress.sections.variants },
              { id: 'images', label: 'Images', done: progress.sections.images },
              { id: 'publishing', label: 'Publishing', done: progress.sections.publishing },
            ].map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    toggleSection(s.id)
                    document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="flex w-full items-center justify-between rounded px-1 py-0.5 text-left hover:bg-surface-muted"
                >
                  <span className="text-fg-muted">{s.label}</span>
                  {s.done ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-border pt-3">
            <Button type="submit" className="w-full" size="lg" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : mode === 'edit' ? (
                'Save changes'
              ) : (
                'Create design'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => router.push('/designs')}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>

          <div className="mt-4 rounded-md bg-surface-muted p-3 text-[11px] text-fg-muted">
            <p className="font-medium text-fg">After saving:</p>
            <ol className="mt-1 list-inside list-decimal space-y-0.5">
              <li>Send to a craftsman as a Job</li>
              <li>On completion, receive finished pieces into inventory</li>
              <li>Sell them at POS</li>
            </ol>
          </div>
        </div>
      </aside>

      {/* Quick-add dialogs */}
      <QuickAddStoneDialog
        open={quickStoneOpen}
        onOpenChange={setQuickStoneOpen}
        onCreated={(master) => {
          setLocalStoneMasters((prev) => [...prev, master])
          setStones((prev) => {
            const next = prev.length > 0 ? prev : [emptyStone()]
            const last = next[next.length - 1]
            return [
              ...next.slice(0, -1),
              {
                ...last,
                stone_master_id: master.id,
                shape: master.shape ?? '',
                color: master.color ?? '',
                clarity: master.clarity ?? '',
                cut: master.cut ?? '',
              },
            ]
          })
        }}
      />
      <QuickAddMaterialDialog
        open={quickMaterialOpen}
        onOpenChange={setQuickMaterialOpen}
        onCreated={(m) => {
          setLocalMaterials((prev) => [...prev, m])
          setDesignMaterials((prev) => [
            ...prev,
            { key: uid(), material_id: m.id, quantity: '1', unit: m.unit },
          ])
        }}
      />
    </form>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────

function Section({
  id, title, subtitle, icon: Icon, done, open, onToggle, children, badge,
}: {
  id: string
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  done: boolean
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: string
}) {
  return (
    <section id={`section-${id}`} className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            done ? 'bg-success-bg text-success' : 'bg-surface-sunken text-fg-muted',
          )}
        >
          {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-fg">{title}</h2>
            {badge && (
              <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] tabular-nums text-fg-muted">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-fg-muted">{subtitle}</p>}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-fg-subtle" /> : <ChevronRight className="h-4 w-4 text-fg-subtle" />}
      </button>
      {open && <div className="border-t border-border p-5">{children}</div>}
    </section>
  )
}

function Banner({ tone, children }: { tone: 'warning' | 'info'; children: React.ReactNode }) {
  const cls = tone === 'warning' ? 'border-warning/30 bg-warning-bg text-fg' : 'border-info/30 bg-info-bg text-fg'
  return (
    <div className={cn('mb-3 flex items-start gap-2 rounded-md border p-3 text-xs', cls)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

function EmptyRow({
  icon: Icon, title, description, cta, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  cta: string
  onClick: () => void
}) {
  return (
    <div className="rounded-md border border-dashed border-border-strong bg-surface-muted/40 p-6 text-center">
      <Icon className="mx-auto mb-2 h-6 w-6 text-fg-subtle" />
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-fg-muted">{description}</p>
      <Button type="button" variant="outline" size="sm" onClick={onClick} className="mt-3">
        <Plus className="h-3.5 w-3.5" /> {cta}
      </Button>
    </div>
  )
}

function Checkbox({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-border-strong text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="text-fg">{label}</span>
        {hint && <span className="block text-[11px] text-fg-muted">{hint}</span>}
      </span>
    </label>
  )
}

// ─── Image uploader ────────────────────────────────────────────────────

function ImageUploader({
  assets, onChange, designId,
}: {
  assets: DesignAsset[]
  onChange: (next: DesignAsset[]) => void
  designId?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [errored, setErrored] = useState<Set<string>>(new Set())

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const newAssets: DesignAsset[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        try {
          const url = await uploadImage(file, designId ? `designs/${designId}` : 'designs')
          newAssets.push({
            key: uid(),
            url,
            alt_text: '',
            is_primary: assets.length === 0 && newAssets.length === 0,
            isNew: true,
            asset_type: 'image',
          })
        } catch (err: any) {
          toast.error(err?.message ?? 'Upload failed')
        }
      }
      if (newAssets.length > 0) {
        onChange([...assets, ...newAssets])
        toast.success(`${newAssets.length} image${newAssets.length === 1 ? '' : 's'} uploaded`)
      }
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function setPrimary(key: string) {
    onChange(assets.map((a) => ({ ...a, is_primary: a.key === key })))
  }
  function removeAsset(key: string) {
    onChange(assets.filter((a) => a.key !== key))
  }
  function markErrored(key: string) {
    setErrored((prev) => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {assets.map((a) => {
          const resolved = resolveAssetUrl(a.url)
          const isVideo = a.asset_type === 'video'
          const isErrored = errored.has(a.key) || !resolved

          return (
            <div
              key={a.key}
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-surface-muted"
            >
              {isErrored ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-fg-subtle">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-[10px]">Failed to load</span>
                </div>
              ) : isVideo ? (
                <video
                  src={resolved}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  onError={() => markErrored(a.key)}
                />
              ) : (
                <img
                  src={resolved}
                  alt={a.alt_text}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                  onError={() => markErrored(a.key)}
                />
              )}

              {/* Video badge */}
              {isVideo && !isErrored && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">▶</span>
                </span>
              )}

              {/* Hover controls */}
              <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/60 via-transparent to-black/40 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setPrimary(a.key)}
                    className={cn(
                      'rounded-full p-1.5 backdrop-blur',
                      a.is_primary ? 'bg-brand-500 text-white' : 'bg-white/80 text-fg hover:bg-white',
                    )}
                    aria-label="Set primary"
                  >
                    <Star className={cn('h-3.5 w-3.5', a.is_primary && 'fill-current')} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAsset(a.key)}
                    className="rounded-full bg-white/80 p-1.5 text-danger hover:bg-white"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={a.alt_text}
                  onChange={(e) =>
                    onChange(assets.map((x) => (x.key === a.key ? { ...x, alt_text: e.target.value } : x)))
                  }
                  placeholder="Alt text…"
                  className="w-full rounded bg-white/90 px-1.5 py-1 text-[10px] text-fg placeholder:text-fg-subtle"
                />
              </div>

              {a.is_primary && (
                <span className="absolute left-2 top-2 rounded-full bg-brand-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white">
                  Primary
                </span>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-surface-muted text-fg-muted transition-colors hover:bg-surface-sunken"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <ImagePlus className="h-6 w-6" />
              <span className="mt-1 text-[11px]">Upload</span>
            </>
          )}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}

// ─── Quick-add dialogs ─────────────────────────────────────────────────

function QuickAddStoneDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (m: StoneMaster) => void
}) {
  const supabase = createClient()
  const [category, setCategory] = useState<StoneMaster['category']>('diamond')
  const [name, setName] = useState('')
  const [shape, setShape] = useState('')
  const [color, setColor] = useState('')
  const [clarity, setClarity] = useState('')
  const [cut, setCut] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('stone_master')
        .insert({
          category,
          name: name || null,
          shape: shape || null,
          color: color || null,
          clarity: clarity || null,
          cut: cut || null,
          is_active: true,
        })
        .select('id, category, name, shape, color, clarity, cut, origin')
        .single()
      if (error) throw error
      onCreated(data as StoneMaster)
      toast.success('Stone type added')
      onOpenChange(false)
      setName(''); setShape(''); setColor(''); setClarity(''); setCut('')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add stone type</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Category <span className="text-danger">*</span></Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as StoneMaster['category'])}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
            >
              {STONE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
            <div><Label>Shape</Label><Input value={shape} onChange={(e) => setShape(e.target.value)} className="mt-1" /></div>
            <div><Label>Color</Label><Input value={color} onChange={(e) => setColor(e.target.value)} className="mt-1" /></div>
            <div><Label>Clarity</Label><Input value={clarity} onChange={(e) => setClarity(e.target.value)} className="mt-1" /></div>
            <div className="col-span-2"><Label>Cut</Label><Input value={cut} onChange={(e) => setCut(e.target.value)} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add stone type'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function QuickAddMaterialDialog({
  open, onOpenChange, onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (m: Material) => void
}) {
  const supabase = createClient()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('other')
  const [unit, setUnit] = useState('piece')
  const [defaultRate, setDefaultRate] = useState('0')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('material_master')
        .insert({
          code: code || name.toUpperCase().replace(/\s+/g, '_').slice(0, 20),
          name,
          category,
          unit,
          default_rate: Number(defaultRate) || 0,
          is_active: true,
        })
        .select('id, code, name, category, unit, default_rate')
        .single()
      if (error) throw error
      onCreated(data as Material)
      toast.success('Material added')
      onOpenChange(false)
      setCode(''); setName(''); setDefaultRate('0')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add material</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto from name" className="mt-1 font-mono text-xs" /></div>
            <div><Label>Name <span className="text-danger">*</span></Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Leather strap 4mm" className="mt-1" /></div>
            <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1" /></div>
            <div><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1" /></div>
            <div className="col-span-2"><Label>Default rate (₹)</Label><Input type="number" inputMode="decimal" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} className="mt-1 tabular-nums" /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add material'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}