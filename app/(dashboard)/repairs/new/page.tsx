import { requireRole } from '@/lib/guard'
import { NewRepairForm } from './new-repair-form'

export const dynamic = 'force-dynamic'

export default async function NewRepairPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales'])

  const [{ data: customers }, { data: craftsmen }, { data: invoiceItems }] = await Promise.all([
    supabase.from('customers').select('id, name, phone').eq('is_active', true).order('name'),
    supabase.from('craftsmen').select('id, name').eq('is_active', true).order('name'),
    // ★ Fetch all items sold, so we can link them to the repair
    supabase
      .from('invoice_items')
      .select(`
        id, 
        inventory_item_id, 
        item_description,
        invoices!inner ( customer_id ),
        inventory_items ( id, inventory_tag, net_metal_weight_g, stone_carat_total, stone_pcs_total )
      `)
      .not('inventory_item_id', 'is', null)
  ])

  return (
    <NewRepairForm 
      customers={customers ?? []} 
      craftsmen={craftsmen ?? []} 
      soldItems={invoiceItems ?? []}
    />
  )
}