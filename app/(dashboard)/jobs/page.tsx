import { requireRole } from '@/lib/guard'
import { JobsTable } from './jobs-table'

export const dynamic = 'force-dynamic'

export default async function JobsPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  const [jobs, craftsmen, designs, purities] = await Promise.all([
    supabase.from('craftsman_jobs').select('*').order('created_at', { ascending: false }),
    supabase.from('craftsmen').select('id, name, code').eq('is_active', true).order('name'),
    supabase
      .from('product_designs')
      .select(
        'id, name, design_code, product_type, making_charge_type, making_charge_value',
      )
      .order('name'),
    supabase
      .from('metal_purities')
      .select('id, code, purity_percent')
      .eq('is_active', true)
      .order('code'),
  ])

  if (jobs.error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        {jobs.error.message}
      </div>
    )
  }

  const craftsmanMap: Record<string, { name: string; code: string }> =
    Object.fromEntries(
      (craftsmen.data ?? []).map((c) => [c.id, { name: c.name, code: c.code }]),
    )
  const designMap: Record<string, { name: string; code: string; product_type: string }> =
    Object.fromEntries(
      (designs.data ?? []).map((d) => [
        d.id,
        { name: d.name, code: d.design_code, product_type: d.product_type },
      ]),
    )

  return (
    <JobsTable
      jobs={jobs.data ?? []}
      craftsmanMap={craftsmanMap}
      designMap={designMap}
      craftsmanOptions={(craftsmen.data ?? []).map((c) => ({
        id: c.id,
        label: `${c.code} · ${c.name}`,
      }))}
      designOptions={(designs.data ?? []).map((d) => ({
        id: d.id,
        label: `${d.design_code} · ${d.name}`,
        default_making_charge_type: d.making_charge_type,
        default_making_charge_value: d.making_charge_value,
      }))}
      purityOptions={(purities.data ?? []).map((p) => ({
        id: p.id,
        label: p.code,
        purity_percent: Number(p.purity_percent),
      }))}
    />
  )
}