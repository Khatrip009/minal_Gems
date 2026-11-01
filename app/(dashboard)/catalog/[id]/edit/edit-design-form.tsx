'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  uploadImage,
  deleteImage,
  resolveAssetUrl,
  toStoragePath,
} from '@/lib/storage-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Upload, AlertCircle, Loader2, Save } from 'lucide-react'

type Design = Record<string, any>
type Option = { id: string; name: string }
type Purity = {
  id: string
  code: string
  purity_percent: number
  metal_type_id: string | null
}
type StoneMaster = {
  id: string
  category: string
  name: string | null
  shape: string | null
  color: string | null
  clarity: string | null
  cut: string | null
}
type ExistingStone = {
  id: string
  stone_master_id: string
  shape: string | null
  color: string | null
  clarity: string | null
  carat_each: number | string
  pcs: number
  sort_order: number
}
type ExistingAsset = {
  id: string
  url: string
  alt_text: string | null
  is_primary: boolean
  sort_order: number
  asset_type: string
}

type StoneLine = {
  key: string
  stone_master_id: string
  carat_each: string
  pcs: string
}

type AssetRow = {
  key: string
  id: string | null
  previewUrl: string
  file: File | null
  alt_text: string
  is_primary: boolean
  sort_order: number
  marked_for_delete: boolean
  asset_type: string
}

const PRODUCT_TYPES = [
  { value: 'jewellery', label: 'Jewellery' },
  { value: 'loose_stone', label: 'Loose stone' },
  { value: 'service', label: 'Service' },
] as const

const FULFILLMENT_TYPES = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'made_to_order', label: 'Made to order' },
  { value: 'hybrid', label: 'Hybrid' },
] as const

const MAKING_CHARGE_TYPES = [
  { value: 'fixed', label: 'Fixed amount', hint: 'Amount in ₹' },
  { value: 'per_gram', label: 'Per gram', hint: '₹ per gram of finished weight' },
  { value: 'percent_of_metal', label: 'Percent of metal', hint: '0–100' },
  { value: 'percent_of_total', label: 'Percent of total', hint: '0–100' },
] as const

const selectCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
const selectSm =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
const inputSm =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
const textareaCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

const UPLOAD_FOLDER = 'designs'

export function EditDesignForm({
  design,
  existingStones,
  existingAssets,
  categories,
  brands,
  purities,
  stoneMaster,
  metalTypeMap,
}: {
  design: Design
  existingStones: ExistingStone[]
  existingAssets: ExistingAsset[]
  categories: Option[]
  brands: Option[]
  purities: Purity[]
  stoneMaster: StoneMaster[]
  metalTypeMap: Record<string, string>
}) {
  const supabase = useMemo(() => createClient(), [])

  // ── Identity ──
  const [name, setName] = useState<string>(design.name ?? '')
  const [categoryId, setCategoryId] = useState<string>(design.category_id ?? '')
  const [brandId, setBrandId] = useState<string>(design.brand_id ?? '')
  const [productType, setProductType] = useState<string>(
    design.product_type ?? 'jewellery',
  )
  const [fulfillmentType, setFulfillmentType] = useState<string>(
    design.fulfillment_type ?? 'in_stock',
  )

  // ── Description ──
  const [shortDescription, setShortDescription] = useState<string>(
    design.short_description ?? '',
  )
  const [description, setDescription] = useState<string>(
    design.description ?? '',
  )

  // ── Material ──
  const [purityId, setPurityId] = useState<string>(
    design.default_purity_id ?? '',
  )

  // ── Stones ──
  const [stones, setStones] = useState<StoneLine[]>(
    existingStones.map((s) => ({
      key: s.id,
      stone_master_id: s.stone_master_id,
      carat_each: String(s.carat_each ?? ''),
      pcs: String(s.pcs ?? 1),
    })),
  )

  // ── Assets ──
  // NOTE: previewUrl stores the raw URL from the DB (relative "products/x.png"
  // or absolute). We resolve at render, not at load, so nothing mutates the
  // canonical stored value.
  const [assets, setAssets] = useState<AssetRow[]>(
    existingAssets.map((a) => ({
      key: a.id,
      id: a.id,
      previewUrl: a.url,
      file: null,
      alt_text: a.alt_text ?? '',
      is_primary: a.is_primary,
      sort_order: a.sort_order,
      marked_for_delete: false,
      asset_type: a.asset_type || 'image',
    })),
  )

  // ── Pricing ──
  const [makingChargeType, setMakingChargeType] = useState<string>(
    design.making_charge_type ?? 'fixed',
  )
  const [makingChargeValue, setMakingChargeValue] = useState<string>(
    String(design.making_charge_value ?? 0),
  )

  // ── Publishing ──
  const [isPublished, setIsPublished] = useState<boolean>(
    Boolean(design.is_published),
  )
  const [posEnabled, setPosEnabled] = useState<boolean>(
    Boolean(design.pos_enabled ?? true),
  )

  // ── SEO ──
  const [metaTitle, setMetaTitle] = useState<string>(design.meta_title ?? '')
  const [metaDescription, setMetaDescription] = useState<string>(
    design.meta_description ?? '',
  )

  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  // ── Stone helpers ──
  function addStone() {
    if (stoneMaster.length === 0) {
      setError('No stone specs exist. Ask an admin to seed stone_master.')
      return
    }
    setStones((s) => [
      ...s,
      {
        key: crypto.randomUUID(),
        stone_master_id: stoneMaster[0].id,
        carat_each: '',
        pcs: '1',
      },
    ])
  }
  function updateStone(key: string, patch: Partial<StoneLine>) {
    setStones((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  }
  function removeStone(key: string) {
    setStones((s) => s.filter((x) => x.key !== key))
  }

  // ── Asset helpers ──
  function addFiles(files: FileList) {
    if (files.length === 0) return
    const next: AssetRow[] = Array.from(files).map((f) => ({
      key: crypto.randomUUID(),
      id: null,
      previewUrl: URL.createObjectURL(f),
      file: f,
      alt_text: '',
      is_primary: false,
      sort_order: 0,
      marked_for_delete: false,
      // Detect type from MIME so videos don't get mislabelled as images
      asset_type: f.type.startsWith('video/') ? 'video' : 'image',
    }))
    setAssets((a) => {
      const merged = [...a, ...next]
      if (merged.some((x) => x.is_primary && !x.marked_for_delete)) {
        return merged
      }
      const firstLiveIdx = merged.findIndex((x) => !x.marked_for_delete)
      if (firstLiveIdx === -1) return merged
      return merged.map((x, i) =>
        i === firstLiveIdx ? { ...x, is_primary: true } : x,
      )
    })
  }
  function updateAsset(key: string, patch: Partial<AssetRow>) {
    setAssets((a) => a.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  }
  function removeAsset(key: string) {
    setAssets((a) =>
      a.map((x) =>
        x.key === key
          ? { ...x, marked_for_delete: true, is_primary: false }
          : x,
      ),
    )
  }
  function undeleteAsset(key: string) {
    setAssets((a) =>
      a.map((x) => (x.key === key ? { ...x, marked_for_delete: false } : x)),
    )
  }
  function setPrimary(key: string) {
    setAssets((a) =>
      a.map((x) => ({
        ...x,
        is_primary: x.key === key && !x.marked_for_delete,
      })),
    )
  }

  // ── Submit ──
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Design name is required.')
      return
    }
    if (!categoryId) {
      setError('Category is required.')
      return
    }
    const mcv = Number(makingChargeValue)
    if (!Number.isFinite(mcv) || mcv < 0) {
      setError('Making charge value must be a non-negative number.')
      return
    }
    if (
      (makingChargeType === 'percent_of_metal' ||
        makingChargeType === 'percent_of_total') &&
      mcv > 100
    ) {
      setError('Percentage must be between 0 and 100.')
      return
    }
    const liveStones = stones.filter((s) => s.stone_master_id)
    if (liveStones.some((s) => Number(s.pcs) < 1)) {
      setError('Every stone line needs at least 1 piece.')
      return
    }
    const liveAssets = assets.filter((a) => !a.marked_for_delete)
    if (liveAssets.length > 0 && !liveAssets.some((a) => a.is_primary)) {
      setError('Mark one image as primary.')
      return
    }

    const newFilesToUpload = liveAssets.filter((a) => a.file)
    setSaving(true)
    setUploadProgress({ done: 0, total: newFilesToUpload.length })

    // Track paths uploaded this run so a failed RPC can clean up.
    const uploadedPaths: string[] = []

    try {
      // 1. Upload NEW files
      let uploadCounter = 0
      const uploadedMap = new Map<string, string>()

      for (const a of liveAssets) {
        if (!a.file) continue
        const url = await uploadImage(a.file, UPLOAD_FOLDER)
        uploadedMap.set(a.key, url)
        uploadedPaths.push(toStoragePath(url))
        uploadCounter++
        setUploadProgress({
          done: uploadCounter,
          total: newFilesToUpload.length,
        })
      }

      // 2. Build the assets payload — strip STORAGE_BASE so the DB stays
      // portable. Idempotent: an existing relative URL is returned unchanged.
      const p_assets = liveAssets.map((a, idx) => {
        const rawUrl = a.id ? a.previewUrl : uploadedMap.get(a.key)!
        return {
          id: a.id ?? undefined,
          url: toStoragePath(rawUrl),
          alt_text: a.alt_text,
          is_primary: a.is_primary,
          sort_order: idx,
          asset_type: a.asset_type || 'image',
        }
      })

      // 3. Stones payload
      const p_stones = liveStones.map((s) => {
        const master = stoneMaster.find((m) => m.id === s.stone_master_id)
        return {
          stone_master_id: s.stone_master_id,
          shape: master?.shape ?? null,
          color: master?.color ?? null,
          clarity: master?.clarity ?? null,
          carat_each: Number(s.carat_each) || 0,
          pcs: Number(s.pcs) || 1,
        }
      })

      // 4. RPC — atomic update
      const { error: rpcErr } = await supabase.rpc('fn_update_design_full', {
        p_design_id: design.id,
        p_design: {
          name: name.trim(),
          category_id: categoryId,
          brand_id: brandId || null,
          description: description.trim(),
          short_description: shortDescription.trim(),
          product_type: productType,
          fulfillment_type: fulfillmentType,
          default_purity_id: purityId || null,
          making_charge_type: makingChargeType,
          making_charge_value: mcv,
          is_published: isPublished,
          pos_enabled: posEnabled,
          meta_title: metaTitle.trim(),
          meta_description: metaDescription.trim(),
        },
        p_stones,
        p_assets,
      })

      if (rpcErr) throw new Error(rpcErr.message)

      // 5. Best-effort: delete storage files for removed assets
      const removed = assets.filter((a) => a.marked_for_delete && a.id)
      for (const a of removed) {
        await deleteImage(a.previewUrl)
      }

      window.location.href = `/catalog/${design.id}`
    } catch (err: any) {
      // Best-effort cleanup of files uploaded before the failure.
      await Promise.allSettled(uploadedPaths.map((p) => deleteImage(p)))
      setError(err?.message ?? 'Failed to save design.')
      setSaving(false)
    }
  }

  const makingChargeTypeMeta = MAKING_CHARGE_TYPES.find(
    (m) => m.value === makingChargeType,
  )
  const liveAssets = assets.filter((a) => !a.marked_for_delete)
  const newFileCount = liveAssets.filter((a) => a.file).length

  return (
    <form onSubmit={submit} className="space-y-8 pb-32">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ═══════ IDENTITY ═══════ */}
      <Section
        title="Identity"
        description="Basic identification and classification"
      >
        <Field label="Name" htmlFor="name" required className="md:col-span-2">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field label="Design code" htmlFor="design_code">
          <Input
            id="design_code"
            value={design.design_code ?? ''}
            disabled
            className="font-mono text-slate-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            Auto-generated, cannot be edited.
          </p>
        </Field>

        <Field label="Slug" htmlFor="slug">
          <Input
            id="slug"
            value={design.slug ?? ''}
            disabled
            className="font-mono text-slate-500"
          />
          <p className="mt-1 text-xs text-slate-500">
            URL identifier — immutable after creation.
          </p>
        </Field>

        <Field label="Category" htmlFor="category_id" required>
          <select
            id="category_id"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className={selectCls}
          >
            <option value="">— Select —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Brand" htmlFor="brand_id">
          <select
            id="brand_id"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className={selectCls}
          >
            <option value="">— None —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Product type" htmlFor="product_type" required>
          <select
            id="product_type"
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className={selectCls}
          >
            {PRODUCT_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fulfillment" htmlFor="fulfillment_type" required>
          <select
            id="fulfillment_type"
            value={fulfillmentType}
            onChange={(e) => setFulfillmentType(e.target.value)}
            className={selectCls}
          >
            {FULFILLMENT_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ═══════ DESCRIPTION ═══════ */}
      <Section
        title="Description"
        description="Copy shown on the design detail page"
      >
        <Field
          label="Short description"
          htmlFor="short_description"
          className="md:col-span-2"
        >
          <Input
            id="short_description"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field
          label="Full description"
          htmlFor="description"
          className="md:col-span-2"
        >
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className={textareaCls}
          />
        </Field>
      </Section>

      {/* ═══════ MATERIAL ═══════ */}
      <Section title="Material" description="Default metal for this design">
        <Field label="Default purity" htmlFor="purity" required>
          <select
            id="purity"
            value={purityId}
            onChange={(e) => setPurityId(e.target.value)}
            required
            className={selectCls}
          >
            <option value="">— Select —</option>
            {purities.map((p) => {
              const metalName = p.metal_type_id
                ? (metalTypeMap[p.metal_type_id] ?? 'Metal')
                : 'Metal'
              return (
                <option key={p.id} value={p.id}>
                  {metalName} {p.code} ({Number(p.purity_percent).toFixed(2)}%)
                </option>
              )
            })}
          </select>
        </Field>
      </Section>

      {/* ═══════ STONES ═══════ */}
      <Section title="Stones" description="Planned stones per finished piece">
        <div className="md:col-span-2 space-y-3">
          {stoneMaster.length === 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No stone specs exist in <code>stone_master</code>.
            </div>
          )}

          {stones.length === 0 && stoneMaster.length > 0 && (
            <p className="text-xs text-slate-500">
              No stones attached. Click "Add stone" to add one.
            </p>
          )}

          {stones.map((s, i) => {
            const master = stoneMaster.find((m) => m.id === s.stone_master_id)
            return (
              <div
                key={s.key}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700">
                    Stone {i + 1}
                    {master && (
                      <span className="ml-2 font-normal text-slate-500">
                        ({master.category} · {master.shape ?? '—'} ·{' '}
                        {master.color ?? '—'}/{master.clarity ?? '—'})
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeStone(s.key)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    <Trash2 className="inline h-3 w-3" /> Remove
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={s.stone_master_id}
                    onChange={(e) =>
                      updateStone(s.key, { stone_master_id: e.target.value })
                    }
                    className={selectSm}
                  >
                    {stoneMaster.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.category} · {m.shape ?? '—'} · {m.color ?? '—'}/
                        {m.clarity ?? '—'} · {m.cut ?? '—'}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="carat each"
                    value={s.carat_each}
                    onChange={(e) =>
                      updateStone(s.key, { carat_each: e.target.value })
                    }
                    className={inputSm}
                  />
                  <Input
                    type="number"
                    min="1"
                    placeholder="pcs"
                    value={s.pcs}
                    onChange={(e) =>
                      updateStone(s.key, { pcs: e.target.value })
                    }
                    className={inputSm}
                  />
                </div>
              </div>
            )
          })}

          {stoneMaster.length > 0 && (
            <button
              type="button"
              onClick={addStone}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" /> Add stone
            </button>
          )}
        </div>
      </Section>

      {/* ═══════ MEDIA ═══════ */}
      <Section
        title="Media"
        description="Design photos, diamond macro shots, certificates"
      >
        <div className="md:col-span-2 space-y-3">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 hover:border-brand-400 hover:bg-brand-50/30">
            <Upload className="h-4 w-4" /> Add more images (JPG, PNG, WebP ·
            10MB max)
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => e.target.files && addFiles(e.target.files)}
              className="hidden"
            />
          </label>

          {assets.length === 0 && (
            <p className="text-xs text-slate-500">
              No images yet. Upload one above.
            </p>
          )}

          {assets.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {assets.map((a) => (
                <div
                  key={a.key}
                  className={`group relative rounded-lg border-2 ${
                    a.marked_for_delete
                      ? 'border-red-400 opacity-50'
                      : a.is_primary
                        ? 'border-brand-500'
                        : 'border-slate-200'
                  } bg-white overflow-hidden`}
                >
                  {a.asset_type === 'video' ? (
                    <video
                      src={resolveAssetUrl(a.previewUrl)}
                      muted
                      playsInline
                      preload="metadata"
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <img
                      src={resolveAssetUrl(a.previewUrl)}
                      alt={a.alt_text}
                      className="aspect-square w-full object-cover"
                    />
                  )}

                  {a.is_primary && !a.marked_for_delete && (
                    <span className="absolute top-1 left-1 rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      PRIMARY
                    </span>
                  )}
                  {a.id === null && (
                    <span className="absolute top-1 right-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      NEW
                    </span>
                  )}
                  {a.marked_for_delete && (
                    <span className="absolute top-1 left-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      WILL DELETE
                    </span>
                  )}

                  <div className="space-y-1 p-2">
                    <Input
                      value={a.alt_text}
                      onChange={(e) =>
                        updateAsset(a.key, { alt_text: e.target.value })
                      }
                      placeholder="alt text"
                      className={inputSm}
                      disabled={a.marked_for_delete}
                    />
                    {a.marked_for_delete ? (
                      <button
                        type="button"
                        onClick={() => undeleteAsset(a.key)}
                        className="w-full text-[10px] text-slate-600 hover:underline"
                      >
                        Undo delete
                      </button>
                    ) : (
                      <>
                        {!a.is_primary && (
                          <button
                            type="button"
                            onClick={() => setPrimary(a.key)}
                            className="w-full text-[10px] text-brand-600 hover:underline"
                          >
                            Set as primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeAsset(a.key)}
                          className="w-full text-[10px] text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ═══════ PRICING ═══════ */}
      <Section title="Pricing" description="Making charge configuration">
        <Field
          label="Making charge type"
          htmlFor="making_charge_type"
          required
        >
          <select
            id="making_charge_type"
            value={makingChargeType}
            onChange={(e) => setMakingChargeType(e.target.value)}
            className={selectCls}
          >
            {MAKING_CHARGE_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Making charge value"
          htmlFor="making_charge_value"
          required
          hint={makingChargeTypeMeta?.hint}
        >
          <Input
            id="making_charge_value"
            type="number"
            step="0.01"
            min="0"
            value={makingChargeValue}
            onChange={(e) => setMakingChargeValue(e.target.value)}
            required
          />
        </Field>
      </Section>

      {/* ═══════ PUBLISHING ═══════ */}
      <Section title="Publishing" description="Visibility and POS availability">
        <ToggleField
          label="Published"
          hint="Design is active and can create jobs"
          checked={isPublished}
          onChange={setIsPublished}
        />
        <ToggleField
          label="Available in POS"
          hint="Showroom counter can select this"
          checked={posEnabled}
          onChange={setPosEnabled}
        />
      </Section>

      {/* ═══════ SEO ═══════ */}
      <Section
        title="SEO"
        description="Search-engine metadata for the storefront"
      >
        <Field label="Meta title" htmlFor="meta_title" className="md:col-span-2">
          <Input
            id="meta_title"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            maxLength={70}
          />
        </Field>
        <Field
          label="Meta description"
          htmlFor="meta_description"
          className="md:col-span-2"
        >
          <textarea
            id="meta_description"
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={3}
            maxLength={160}
            className={textareaCls}
          />
        </Field>
      </Section>

      {/* ═══════ STICKY FOOTER ═══════ */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {saving && uploadProgress.total > 0 && (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading {uploadProgress.done} / {uploadProgress.total}…
              </span>
            )}
            {!saving && newFileCount > 0 && (
              <span>
                {newFileCount} new image{newFileCount === 1 ? '' : 's'} will be
                uploaded
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={`/catalog/${design.id}`}>
              <Button type="button" variant="outline" disabled={saving}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}

/* ── Presentation helpers ──────────────────────────────── */

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  className = '',
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:border-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </label>
  )
}