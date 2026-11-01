import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRole } from '@/lib/guard'
import { DesignCreateForm } from './design-create-form'

export const dynamic = 'force-dynamic'

export default async function NewDesignPage() {
  const { supabase } = await requireRole(['admin', 'manager'])

  const [
    { data: categories },
    { data: brands },
    { data: purities },
    { data: metalTypes },
    { data: stoneMaster },
  ] = await Promise.all([
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
  ])

  const metalTypeMap: Record<string, string> = Object.fromEntries(
    (metalTypes ?? []).map((m) => [m.id, m.name]),
  )

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

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New design</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define a design template — materials, stones, images, pricing. Jobs
          created from this design inherit these defaults.
        </p>
      </div>

      <DesignCreateForm
        categories={categories ?? []}
        brands={brands ?? []}
        purities={purities ?? []}
        stoneMaster={stoneMaster ?? []}
        metalTypeMap={metalTypeMap}
      />
    </div>
  )
}