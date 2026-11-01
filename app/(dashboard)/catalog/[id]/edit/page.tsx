import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/guard'
import { EditDesignForm } from './edit-design-form'

export const dynamic = 'force-dynamic'

export default async function EditDesignPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase } = await requireRole(['admin', 'manager'])

  const [
    { data: design, error },
    { data: categories },
    { data: brands },
    { data: purities },
    { data: metalTypes },
    { data: stoneMaster },
    { data: stones },
    { data: assets },
  ] = await Promise.all([
    supabase.from('product_designs').select('*').eq('id', id).single(),
    supabase.from('categories').select('id, name').eq('is_active', true).order('name'),
    supabase.from('brands').select('id, name').order('name'),
    supabase
      .from('metal_purities')
      .select('id, code, purity_percent, metal_type_id')
      .eq('is_active', true),
    supabase.from('metal_types').select('id, name'),
    supabase
      .from('stone_master')
      .select('id, category, name, shape, color, clarity, cut')
      .eq('is_active', true)
      .order('category')
      .order('name'),
    supabase
      .from('product_design_stones')
      .select('id, stone_master_id, shape, color, clarity, carat_each, pcs, sort_order')
      .eq('design_id', id)
      .order('sort_order'),
    supabase
      .from('product_assets')
      .select('id, url, alt_text, is_primary, sort_order, asset_type')
      .eq('design_id', id)
      .order('sort_order'),
  ])

  if (error || !design) notFound()

  const metalTypeMap: Record<string, string> = Object.fromEntries(
    (metalTypes ?? []).map((m) => [m.id, m.name]),
  )

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/catalog/${design.id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to design
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit design</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update the design template. Changes apply to future jobs; existing
          pieces keep their snapshotted values.
        </p>
      </div>

      <EditDesignForm
        design={design}
        existingStones={stones ?? []}
        existingAssets={assets ?? []}
        categories={categories ?? []}
        brands={brands ?? []}
        purities={purities ?? []}
        stoneMaster={stoneMaster ?? []}
        metalTypeMap={metalTypeMap}
      />
    </div>
  )
}