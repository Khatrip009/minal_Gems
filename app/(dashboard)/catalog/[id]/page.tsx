import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { resolveAssetUrl } from '@/lib/storage-client'
import { StatusBadge, statusVariant } from '@/components/primitives/status-badge'
import { MediaGallery } from './media-gallery'
import {
  Gem,
  Coins,
  Sparkles,
  Plus,
  Edit3,
  ArrowLeft,
  Package,
  Clock,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}
const fmtG = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}
const fmtCt = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(3) : '0.000'
}
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function describeMakingCharge(type: string, value: number): string {
  switch (type) {
    case 'fixed':
      return `₹${value.toLocaleString('en-IN')} flat`
    case 'per_gram':
      return `₹${value.toLocaleString('en-IN')}/g`
    case 'percent_of_metal':
      return `${value}% of metal`
    case 'percent_of_total':
      return `${value}% of total`
    default:
      return String(value)
  }
}

// ... (Piece type definition stays the same)

export default async function CatalogDesignPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole([
    'admin',
    'manager',
    'sales',
    'accountant',
  ])

  const { data: design, error } = await supabase
    .from('product_designs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !design) notFound()

  const [
    { data: category },
    { data: brand },
    { data: purity },
    { data: jobs },
    { data: locations },
    { data: assets },
  ] = await Promise.all([
    design.category_id
      ? supabase.from('categories').select('id, name').eq('id', design.category_id).maybeSingle()
      : Promise.resolve({ data: null }),
    design.brand_id
      ? supabase.from('brands').select('id, name').eq('id', design.brand_id).maybeSingle()
      : Promise.resolve({ data: null }),
    design.default_purity_id
      ? supabase.from('metal_purities').select('id, code, purity_percent').eq('id', design.default_purity_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('craftsman_jobs').select('id').eq('design_id', design.id),
    supabase.from('locations').select('id, name'),
    // Fetch all assets (images + videos), ordered by primary first
    supabase
      .from('product_assets')
      .select('id, url, alt_text, is_primary, sort_order, asset_type')
      .eq('design_id', design.id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true }),
  ])

  const jobIds = (jobs ?? []).map((j) => j.id)
  const { data: pieces } = jobIds.length
    ? await supabase
        .from('inventory_items')
        .select('*')
        .in('craftsman_job_id', jobIds)
        .order('created_at', { ascending: false })
    : { data: [] as any[] }

  const locationMap: Record<string, string> = Object.fromEntries(
    (locations ?? []).map((l) => [l.id, l.name]),
  )

  // Normalize asset URLs server-side so MediaGallery (and anything
  // downstream) always receives absolute URLs. Legacy rows store
  // "products/x.png"; resolveAssetUrl() turns them into
  // "http://localhost:4900/products/x.png" (or the prod base).
  // resolveAssetUrl is idempotent on already-absolute URLs, so this is
  // safe to re-run if a future refactor adds the call again at the client.
  const resolvedAssets = (assets ?? []).map((a: any) => ({
    ...a,
    url: resolveAssetUrl(a.url),
  }))

  const allPieces = pieces ?? []
  const available = allPieces.filter(
    (p) => p.status === 'available' || p.status === 'reserved',
  )
  const sold = allPieces.filter(
    (p) => p.status === 'sold' || p.status === 'delivered',
  )

  const floors = allPieces.map((p) => Number(p.floor_price ?? 0)).filter((n) => n > 0)
  const minFloor = floors.length > 0 ? Math.min(...floors) : null
  const maxFloor = floors.length > 0 ? Math.max(...floors) : null

  const avgNetWeight = allPieces.length > 0
      ? allPieces.reduce((a, p) => a + Number(p.net_fine_weight_g ?? 0), 0) / allPieces.length
      : null
  const avgStones = allPieces.length > 0
      ? allPieces.reduce((a, p) => a + Number(p.stone_pcs_total ?? 0), 0) / allPieces.length
      : null
  const avgStoneCarat = allPieces.length > 0
      ? allPieces.reduce((a, p) => a + Number(p.stone_carat_total ?? 0), 0) / allPieces.length
      : null

  const isService = design.product_type === 'service'

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to catalog
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">
            {design.name}
          </h1>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">
            {design.design_code}
          </span>
          {category && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {category.name}
            </span>
          )}
          {brand && (
            <span className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
              {brand.name}
            </span>
          )}
          {!design.is_published && (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              Draft
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/catalog/${design.id}/edit`}>
            <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50">
              <Edit3 className="h-3.5 w-3.5" /> Edit design
            </button>
          </Link>
          {!isService && (
            <Link href={`/jobs?design=${design.id}`}>
              <button className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                <Plus className="h-3.5 w-3.5" /> Create job
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Hero + specs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {/* Render the interactive gallery with resolved URLs */}
          <MediaGallery
            assets={resolvedAssets}
            productName={design.name}
          />
        </div>

        <div className="lg:col-span-3 space-y-4">
          {design.short_description && (
            <p className="text-sm text-slate-700">
              {design.short_description}
            </p>
          )}
          {design.description && (
            <p className="whitespace-pre-line text-sm text-slate-600">
              {design.description}
            </p>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm font-semibold text-slate-900">
              Design specifications
            </p>
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Product type</dt>
                <dd className="mt-0.5 font-medium">{humanize(design.product_type)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Fulfillment</dt>
                <dd className="mt-0.5 font-medium">{humanize(design.fulfillment_type)}</dd>
              </div>
              {purity && (
                <div>
                  <dt className="text-xs text-slate-500">Default purity</dt>
                  <dd className="mt-0.5 font-medium">
                    {purity.code}{' '}
                    <span className="text-xs text-slate-500">({Number(purity.purity_percent).toFixed(2)}%)</span>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-500">Making charge</dt>
                <dd className="mt-0.5 font-medium">
                  {describeMakingCharge(design.making_charge_type, Number(design.making_charge_value))}
                </dd>
              </div>
              {avgNetWeight != null && (
                <div>
                  <dt className="text-xs text-slate-500">Avg metal</dt>
                  <dd className="mt-0.5 font-medium tabular">{fmtG(avgNetWeight)} g fine</dd>
                </div>
              )}
              {avgStones != null && avgStones > 0 && (
                <div>
                  <dt className="text-xs text-slate-500">Avg stones</dt>
                  <dd className="mt-0.5 font-medium tabular">
                    {avgStones.toFixed(0)} pcs · {fmtCt(avgStoneCarat)} ct
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatBox
              label="In stock"
              value={String(available.length)}
              accent={available.length > 0 ? 'emerald' : 'slate'}
              hint="available + reserved"
            />
            <StatBox
              label="Sold"
              value={String(sold.length)}
              accent={sold.length > 0 ? 'brand' : 'slate'}
            />
            <StatBox
              label="Total made"
              value={String(allPieces.length)}
              accent="slate"
            />
            <StatBox
              label="Floor range"
              value={
                minFloor && maxFloor
                  ? minFloor === maxFloor
                    ? `₹${fmtMoney(minFloor)}`
                    : `₹${fmtMoney(minFloor)}–${fmtMoney(maxFloor)}`
                  : '—'
              }
              accent="brand"
            />
          </div>
        </div>
      </div>

      {/* Available pieces */}
      {available.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Package className="h-4 w-4 text-emerald-600" /> Available now
              <span className="text-sm font-normal text-slate-500">
                ({available.length} piece{available.length === 1 ? '' : 's'})
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {available.map((p) => (
              <PieceCard key={p.id} piece={p} locationMap={locationMap} />
            ))}
          </div>
        </section>
      )}

      {/* Sold pieces */}
      {sold.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Clock className="h-4 w-4 text-slate-400" /> Sold / delivered
              <span className="text-sm font-normal text-slate-500">({sold.length})</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {sold.map((p) => (
              <PieceCard key={p.id} piece={p} locationMap={locationMap} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {allPieces.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-900">
            {isService ? 'No pieces yet — this is a service design' : 'No pieces made yet'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {isService
              ? 'Service designs don’t produce physical inventory. Create a job when a customer requests this service.'
              : 'Create a job for this design to produce the first finished piece. It will appear here once the job is completed.'}
          </p>
          {!isService && (
            <Link href={`/jobs?design=${design.id}`}>
              <button className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                <Plus className="h-4 w-4" /> Create job
              </button>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, hint, accent = 'slate' }: { label: string; value: string; hint?: string; accent?: 'slate' | 'brand' | 'emerald' }) {
  const accentMap = { slate: 'text-slate-900', brand: 'text-brand-700', emerald: 'text-emerald-700' }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 tabular text-lg font-semibold ${accentMap[accent]}`}>{value}</p>
      {hint && <p className="text-[9px] text-slate-500">{hint}</p>}
    </div>
  )
}

function PieceCard({ piece, locationMap }: { piece: any; locationMap: Record<string, string> }) {
  const isSold = piece.status === 'sold' || piece.status === 'delivered'
  return (
    <Link
      href={`/inventory/${piece.id}`}
      className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] text-slate-500">{piece.inventory_tag}</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {piece.location_id ? (locationMap[piece.location_id] ?? '—') : '—'}
          </p>
        </div>
        <StatusBadge variant={statusVariant(piece.status)}>{humanize(piece.status)}</StatusBadge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Net metal</p>
          <p className="tabular font-medium">{fmtG(piece.net_metal_weight_g)} g</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Gross</p>
          <p className="tabular font-medium">{fmtG(piece.gross_weight_g)} g</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Stones</p>
          <p className="tabular font-medium">{piece.stone_pcs_total} pcs · {fmtCt(piece.stone_carat_total)} ct</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Floor</p>
          <p className="tabular font-medium">{piece.floor_price ? `₹ ${fmtMoney(piece.floor_price)}` : '—'}</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-500">
        <span>{isSold ? 'Sold' : 'Made'} {fmtDate(isSold ? piece.sold_at : piece.created_at)}</span>
        <span className="font-medium text-brand-700 group-hover:underline">View →</span>
      </div>
    </Link>
  )
}