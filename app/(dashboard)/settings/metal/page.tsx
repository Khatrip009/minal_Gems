import { requireRole } from '@/lib/guard'
import { MetalTabs } from './metal-tabs'

export default async function MetalSettingsPage() {
  const { supabase } = await requireRole(['admin', 'manager'])
  const [types, purities, rates] = await Promise.all([
    supabase.from('metal_types').select('*').order('code'),
    supabase.from('metal_purities').select('*, metal_types(name)').order('code'),
    supabase.from('metal_rates').select('*, metal_purities(code)').order('effective_from', { ascending: false }),
  ])
  if (types.error || purities.error || rates.error) {
    return <div className="rounded bg-red-50 border border-red-200 p-4 text-red-700">
      {types.error?.message ?? purities.error?.message ?? rates.error?.message}
    </div>
  }

  return (
    <MetalTabs
      types={types.data ?? []}
      purities={purities.data ?? []}
      rates={rates.data ?? []}
      typeOptions={(types.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
      purityOptions={(purities.data ?? []).map((p) => ({ value: p.id, label: p.code }))}
    />
  )
}