import { requireRole } from '@/lib/guard'
import { MetalLotsTable } from './metal-lots-table'

export default async function MetalLotsPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [lots, locations, purities] = await Promise.all([
    supabase.from('v_metal_lot_balances').select('*'),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
    supabase.from('metal_purities').select('id, code').eq('is_active', true).order('code'),
  ])

  if (lots.error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        {lots.error.message}
      </div>
    )
  }

  const locationMap: Record<string, string> = Object.fromEntries(
    (locations.data ?? []).map((l) => [l.id, l.name]),
  )

  return (
    <MetalLotsTable
      lots={lots.data ?? []}
      locationMap={locationMap}
      purityOptions={(purities.data ?? []).map((p) => ({ id: p.id, label: p.code }))}
      locationOptions={(locations.data ?? []).map((l) => ({ id: l.id, label: l.name }))}
    />
  )
}