import { requireRole } from '@/lib/guard'
import { StoneLotsTable, type StoneLotRow } from './stone-lots-table'

export const dynamic = 'force-dynamic'

export default async function StoneLotsPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const [lots, vendors, masters, locations] = await Promise.all([
    supabase.from('stone_lots').select('*').order('received_date', { ascending: false }),
    supabase.from('vendors').select('id, name').eq('is_active', true).order('name'),
    supabase.from('stone_master').select('*').order('id'),
    supabase.from('locations').select('id, name').eq('is_active', true).order('name'),
  ])

  if (lots.error) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
        {lots.error.message}
      </div>
    )
  }

  const vendorMap: Record<string, string> = Object.fromEntries(
    (vendors.data ?? []).map((v) => [v.id, v.name]),
  )
  const masterMap: Record<string, string> = Object.fromEntries(
    (masters.data ?? []).map((m) => [
      m.id,
      String((m as Record<string, unknown>).name ?? (m as Record<string, unknown>).code ?? m.id),
    ]),
  )

  // Map DB shape → client shape (original_pcs/carat → total_pcs/carat, derive cost)
  const mappedLots: StoneLotRow[] = (lots.data ?? []).map((r: any) => {
    const originalPcs = Number(r.original_pcs ?? 0)
    const originalCarat = Number(r.original_carat ?? 0)
    const rate = Number(r.rate_per_carat ?? 0)
    return {
      id: r.id,
      lot_number: r.lot_number,
      vendor_id: r.vendor_id,
      stone_master_id: r.stone_master_id,
      invoice_no: r.invoice_no,
      invoice_date: r.invoice_date,
      rate_per_carat: r.rate_per_carat ?? 0,
      total_carat: originalCarat,
      total_pcs: originalPcs,
      currency: r.currency ?? 'INR',
      cost: originalCarat * rate,
      received_date: r.received_date,
      notes: r.notes,
      created_at: r.created_at,
    }
  })

  return (
    <StoneLotsTable
      lots={mappedLots}
      vendorMap={vendorMap}
      masterMap={masterMap}
      vendorOptions={(vendors.data ?? []).map((v) => ({ id: v.id, label: v.name }))}
      masterOptions={(masters.data ?? []).map((m) => ({
        id: m.id,
        label: String(
          (m as Record<string, unknown>).name ??
            (m as Record<string, unknown>).code ??
            m.id,
        ),
      }))}
      locationOptions={(locations.data ?? []).map((l) => ({ id: l.id, label: l.name }))}
    />
  )
}