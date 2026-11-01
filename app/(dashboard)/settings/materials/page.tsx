import { requireRole } from '@/lib/guard'
import { PageHeader } from '@/components/primitives/page-header'
import { SettingsTabs } from '@/components/primitives/settings-tabs'
import { MaterialsTable } from './materials-table'

export const dynamic = 'force-dynamic'

export default async function MaterialsPage() {
  const { supabase } = await requireRole(['admin', 'manager'])

  const [
    { data: materials },
    { data: designUsage },
    { data: lotUsage },
  ] = await Promise.all([
    supabase
      .from('material_master')
      .select('id, code, name, category, unit, default_rate, is_active')
      .order('category')
      .order('name'),
    supabase.from('product_design_materials').select('material_id'),
    supabase.from('material_lots').select('material_id'),
  ])

  const designsByMaterial: Record<string, number> = {}
  for (const row of designUsage ?? []) {
    designsByMaterial[row.material_id] = (designsByMaterial[row.material_id] ?? 0) + 1
  }
  const lotsByMaterial: Record<string, number> = {}
  for (const row of lotUsage ?? []) {
    lotsByMaterial[row.material_id] = (lotsByMaterial[row.material_id] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Leather, threads, clasps, findings, packaging — anything consumed alongside metal and stones."
      />
      <SettingsTabs />
      <MaterialsTable
        materials={materials ?? []}
        designsByMaterial={designsByMaterial}
        lotsByMaterial={lotsByMaterial}
      />
    </div>
  )
}