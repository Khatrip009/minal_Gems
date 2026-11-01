import { requireRole } from '@/lib/guard'
import { ReferenceTable } from '@/components/reference-table'

export default async function UnitsPage() {
  const { supabase } = await requireRole(['admin', 'manager'])
  const { data: rows, error } = await supabase.from('units_of_measure').select('*').order('code')
  if (error) return <div className="rounded bg-red-50 border border-red-200 p-4 text-red-700">{error.message}</div>

  return (
    <ReferenceTable
      title="Units of Measure"
      singular="Unit"
      table="units_of_measure"
      rows={rows ?? []}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Name' },
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true, help: 'e.g. g, ct, pcs' },
        { name: 'name', label: 'Name', required: true, help: 'e.g. gram, carat, pieces' },
      ]}
    />
  )
}