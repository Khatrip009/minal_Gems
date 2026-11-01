import { requireRole } from '@/lib/guard'
import { PageHeader } from '@/components/primitives/page-header'
import { SettingsTabs } from '@/components/primitives/settings-tabs'
import { StoneMasterTable } from './stone-master-table'

export const dynamic = 'force-dynamic'

export default async function StoneMasterPage() {
  const { supabase } = await requireRole(['admin', 'manager'])

  const [{ data: stones }, { data: usage }] = await Promise.all([
    supabase
      .from('stone_master')
      .select('id, category, name, shape, color, clarity, cut, fluorescence, origin, is_active')
      .order('category')
      .order('name'),
    supabase.from('product_design_stones').select('stone_master_id'),
  ])

  // Usage count: how many designs reference each stone type.
  const usageByStone: Record<string, number> = {}
  for (const row of usage ?? []) {
    usageByStone[row.stone_master_id] = (usageByStone[row.stone_master_id] ?? 0) + 1
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stone types"
        description="Master list of every stone you can put on a design. Add once, reuse everywhere."
      />
      <SettingsTabs />
      <StoneMasterTable stones={stones ?? []} usageByStone={usageByStone} />
    </div>
  )
}