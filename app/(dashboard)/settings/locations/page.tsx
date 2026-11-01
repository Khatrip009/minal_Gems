import { requireRole } from '@/lib/guard'
import { ReferenceTable } from '@/components/reference-table'

const TYPES = ['store','safe','counter','display','transit','craftsman','repair','scrap','loss']

export default async function LocationsPage() {
  const { supabase } = await requireRole(['admin', 'manager'])
  const { data: rows, error } = await supabase.from('locations').select('*').order('name')
  if (error) return <div className="rounded bg-red-50 border border-red-200 p-4 text-red-700">{error.message}</div>

  return (
    <ReferenceTable
      title="Locations"
      singular="Location"
      table="locations"
      rows={rows ?? []}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'is_active', label: 'Active', boolean: true },
      ]}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'type', label: 'Type', type: 'select', required: true,
          options: TYPES.map((t) => ({ value: t, label: t })) },
        { name: 'is_active', label: 'Active', type: 'checkbox', default: true },
      ]}
    />
  )
}