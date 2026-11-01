import { requireRole } from '@/lib/guard'
import { CustomersTable } from './customers-table'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  // Fetch base customers AND their financial ledger stats
  const [{ data: customers }, { data: ledger }] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('v_customer_ledger').select('*')
  ])

  const ledgerMap = Object.fromEntries((ledger ?? []).map(l => [l.customer_id, l]))

  // Merge them together
  const mergedData = (customers ?? []).map(c => ({
    ...c,
    total_invoices: ledgerMap[c.id]?.total_invoices || 0,
    total_invoiced: ledgerMap[c.id]?.total_invoiced || 0,
    total_paid: ledgerMap[c.id]?.total_paid || 0,
    balance_due: ledgerMap[c.id]?.balance_due || 0,
  }))

  return <CustomersTable rows={mergedData} />
}