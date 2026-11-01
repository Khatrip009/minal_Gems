import { requireRole } from '@/lib/guard'
import { NewReturnForm } from './new-return-form'

export const dynamic = 'force-dynamic'

export default async function NewReturnPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales'])

  // Fetch invoices
  const { data: invoices } = await supabase
  .from('invoices')
  .select(`
    id, invoice_number, total, customer_id, payment_status,
    customers ( id, name, phone ),
    invoice_items ( 
      id, inventory_item_id, item_description, subtotal, 
      inventory_items ( id, inventory_tag, status ) 
    )
  `)
  .neq('status', 'voided')              // ← exclude voided only
  .order('created_at', { ascending: false })
  .limit(10000)

  // Fetch Metal Rates for Gold Exchange calculation
  const { data: rates } = await supabase
    .from('metal_rates')
    .select('purity_id, rate_per_gram')
    .order('effective_from', { ascending: false })
    .limit(50)

  const latestRatesMap: Record<string, number> = {}
  for (const r of rates ?? []) {
    if (!latestRatesMap[r.purity_id]) latestRatesMap[r.purity_id] = Number(r.rate_per_gram)
  }

  const { data: purities } = await supabase.from('metal_purities').select('id, code').eq('is_active', true)
  
  const finalMetalRates = (purities ?? []).map(p => ({
    purity_id: p.id,
    code: p.code,
    rate_per_gram: latestRatesMap[p.id] || 0
  }))

  return <NewReturnForm invoices={invoices ?? []} metalRates={finalMetalRates} />
}