import { requireRole } from '@/lib/guard'
import { ReferenceTable } from '@/components/reference-table'

export default async function CertificateTypesPage() {
  const { supabase } = await requireRole(['admin', 'manager'])
  const { data: rows, error } = await supabase.from('certificate_types').select('*').order('name')
  if (error) return <div className="rounded bg-red-50 border border-red-200 p-4 text-red-700">{error.message}</div>

  return (
    <ReferenceTable
      title="Certificate Types"
      singular="Certificate type"
      table="certificate_types"
      rows={rows ?? []}
      columns={[{ key: 'name', label: 'Name' }]}
      fields={[{ name: 'name', label: 'Name', required: true, help: 'e.g. GIA, IGI, SGL' }]}
    />
  )
}