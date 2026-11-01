import { requireRole } from '@/lib/guard'
import { InvoicesTable } from './invoices-table'

export const dynamic = 'force-dynamic'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; status?: string }>
}) {
  const { customer, status } = await searchParams
  const { supabase } = await requireRole([
    'admin',
    'manager',
    'sales',
    'accountant',
  ])

  let query = supabase
    .from('invoices')
    .select('*, customers(id, name, phone, gstin)')
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (customer) query = query.eq('customer_id', customer)
  if (status) query = query.eq('status', status)

  const { data: invoices, error } = await query

  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        {error.message}
      </div>
    )
  }

  return (
    <InvoicesTable
      rows={(invoices ?? []) as any}
      currentCustomerFilter={customer ?? ''}
    />
  )
}