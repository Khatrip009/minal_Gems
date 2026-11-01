import { requireRole } from '@/lib/guard'
import { VendorsTable } from './vendors-table'

export default async function VendorsPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])
  const { data, error } = await supabase.from('vendors').select('*').order('name')
  if (error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        {error.message}
      </div>
    )
  }
  return <VendorsTable rows={data ?? []} />
}