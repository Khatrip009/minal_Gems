import { requireRole } from '@/lib/guard'
import { ReportsTabs } from './reports-tabs'

export const dynamic = 'force-dynamic'

export default async function ProductionReportsPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [
    craftsmenRes,
    jobsRes,
    paymentsRes,
    metalLotsRes,
    metalTxnsRes,
    stoneIssuesRes,
    stoneReturnsRes,
    stoneItemsRes,
    inventoryRes,
    designsRes,
  ] = await Promise.all([
    supabase.from('craftsmen').select('id, code, name, is_active, skill_type'),
    supabase
      .from('craftsman_jobs')
      .select(
        'id, job_number, craftsman_id, design_id, status, issued_fine_g, returned_fine_g, finished_fine_g, wastage_fine_g, making_charge_amount, completed_at, created_at, due_date',
      ),
    supabase
      .from('craftsman_job_payments')
      .select(
        'id, craftsman_id, job_id, amount, payment_date, payment_method, reference, notes, voided_at, void_reason, created_at',
      )
      .order('payment_date', { ascending: false }),
    supabase
      .from('v_metal_lot_balances')
      .select(
        'metal_lot_id, lot_number, purity_code, purity_percent, opening_fine_weight_g, txn_fine_g, balance_fine_g, rate_per_gram, location_id',
      ),
    supabase
      .from('metal_transactions')
      .select(
        'id, metal_lot_id, txn_type, fine_weight_change_g, reference_type, reference_id, notes, created_at',
      )
      .order('created_at', { ascending: false }),
    // ★ cost_per_carat (not cost_price) — will be turned into cost_price below
    supabase
      .from('craftsman_job_stone_issues')
      .select(
        'id, job_id, stone_item_id, issued_at, stone_items(inventory_tag, carat, shape, color, clarity, cut, cost_per_carat, status)',
      ),
    supabase
      .from('craftsman_job_stone_returns')
      .select(
        'id, job_id, stone_item_id, return_condition, carat_returned, received_at',
      ),
    // ★ same — cost_per_carat
    supabase
      .from('stone_items')
      .select(
        'id, inventory_tag, carat, status, shape, color, clarity, cut, cost_per_carat, stone_master_id, stone_lot_id, location_id',
      ),
    supabase
      .from('inventory_items')
      .select(
        'id, inventory_tag, craftsman_job_id, net_fine_weight_g, cost_price, making_charge_amount, floor_price, status, sold_at, created_at',
      ),
    supabase.from('product_designs').select('id, name, design_code'),
  ])

  if (stoneItemsRes.error) {
    console.error('[reports/production] stone_items:', stoneItemsRes.error)
  }
  if (stoneIssuesRes.error) {
    console.error(
      '[reports/production] craftsman_job_stone_issues:',
      stoneIssuesRes.error,
    )
  }

  // ★ Derive cost_price = rate_per_carat × carat for the client
  const stoneItems = (stoneItemsRes.data ?? []).map((s: any) => {
    const carat = Number(s.carat ?? 0)
    const rate = s.cost_per_carat != null ? Number(s.cost_per_carat) : null
    return {
      ...s,
      cost_price: rate != null ? rate * carat : null,
    }
  })

  const stoneIssues = (stoneIssuesRes.data ?? []).map((si: any) => {
    const s = si.stone_items
    if (!s) return { ...si, stone_items: null }
    const carat = Number(s.carat ?? 0)
    const rate = s.cost_per_carat != null ? Number(s.cost_per_carat) : null
    return {
      ...si,
      stone_items: {
        ...s,
        cost_price: rate != null ? rate * carat : null,
      },
    }
  })

  return (
    <ReportsTabs
      craftsmen={craftsmenRes.data ?? []}
      jobs={jobsRes.data ?? []}
      payments={paymentsRes.data ?? []}
      metalLots={metalLotsRes.data ?? []}
      metalTxns={metalTxnsRes.data ?? []}
      stoneIssues={stoneIssues}
      stoneReturns={stoneReturnsRes.data ?? []}
      stoneItems={stoneItems}
      inventory={inventoryRes.data ?? []}
      designs={designsRes.data ?? []}
    />
  )
}