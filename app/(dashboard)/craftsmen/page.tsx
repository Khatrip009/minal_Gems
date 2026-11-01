import { requireRole } from '@/lib/guard'
import { CraftsmenTable } from './craftsmen-table'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CraftsmenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const { supabase } = await requireRole(['admin', 'manager', 'sales', 'accountant'])

  const [{ data: craftsmen, error }, { data: balances, error: balancesError }] =
    await Promise.all([
      supabase.from('craftsmen').select('*').order('name'),
      supabase.from('v_craftsman_balances').select('*'),
    ])

  // Fail loudly if the balances view is broken — never silently show ₹0
  if (error || balancesError) {
    return (
      <div className="space-y-4 p-6">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-rose-900">
                Craftsmen ledger could not be loaded
              </p>
              <ul className="mt-2 space-y-1">
                {error && (
                  <li className="rounded bg-white/70 px-2 py-1 font-mono text-xs">
                    craftsmen: {error.message}
                  </li>
                )}
                {balancesError && (
                  <li className="rounded bg-white/70 px-2 py-1 font-mono text-xs">
                    v_craftsman_balances: {balancesError.message}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const balanceMap = Object.fromEntries(
    (balances ?? []).map((b: any) => [b.craftsman_id, b]),
  )

  const mergedData = (craftsmen ?? []).map((c: any) => ({
    ...c,
    total_earnings: Number(balanceMap[c.id]?.total_earnings ?? 0),
    total_paid: Number(balanceMap[c.id]?.total_paid ?? 0),
    balance_owed: Number(balanceMap[c.id]?.balance ?? 0),
  }))

  return <CraftsmenTable rows={mergedData} initialQuery={q ?? ''} />
}