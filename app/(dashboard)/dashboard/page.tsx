import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { canSeeCosts, canSeeFinance, type Role } from '@/lib/roles'
import { PageHeader } from '@/components/primitives/page-header'
import { StatCard } from '@/components/primitives/stat-card'
import { AlertList } from '@/components/primitives/alert-list'
import { RecentActivity } from '@/components/primitives/recent-activity'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  noStore()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null // layout already guards

  const [{ data: roleData }, { data: profile }] = await Promise.all([
    supabase.rpc('current_user_role'),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])
  const role = (roleData as Role) ?? null
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const showCosts = canSeeCosts(role)
  const showFinance = canSeeFinance(role)

  // ---- Parallel data fetch ---------------------------------------------------
  const [
    jobsInProgress,
    jobsOverdue,
    inventoryAvailable,
    craftsmenActive,
    metalLots,
    stoneItems,
    unpaidInvoices,
    installmentsOverdue,
  ] = await Promise.all([
    supabase.from('craftsman_jobs').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase
      .from('craftsman_jobs')
      .select('*', { count: 'exact', head: true })
      .lt('due_date', new Date().toISOString().slice(0, 10))
      .in('status', ['pending', 'in_progress']),
    supabase.from('v_inventory_sellable').select('*', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('craftsmen').select('*', { count: 'exact', head: true }).eq('is_active', true),
    showCosts
      ? supabase.from('metal_lots').select('*', { count: 'exact', head: true })
      : Promise.resolve({ count: null, data: null, error: null }),
    showCosts
      ? supabase.from('stone_items').select('*', { count: 'exact', head: true }).eq('status', 'available')
      : Promise.resolve({ count: null, data: null, error: null }),
    showFinance
      ? supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .in('payment_status', ['unpaid', 'partially_paid'])
          .neq('status', 'voided')
      : Promise.resolve({ count: null, data: null, error: null }),
    showFinance
      ? supabase
          .from('scheme_installments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .lt('due_date', new Date().toISOString().slice(0, 10))
      : Promise.resolve({ count: null, data: null, error: null }),
  ])

  // ---- Alerts ----------------------------------------------------------------
  const alerts = [
    jobsOverdue.count
      ? { tone: 'red' as const, label: `${jobsOverdue.count} job(s) overdue`, href: '/jobs?filter=overdue' }
      : null,
    unpaidInvoices.count
      ? { tone: 'amber' as const, label: `${unpaidInvoices.count} unpaid invoice(s)`, href: '/invoices?filter=unpaid' }
      : null,
    installmentsOverdue.count
      ? { tone: 'amber' as const, label: `${installmentsOverdue.count} scheme installment(s) overdue`, href: '/schemes/installments?filter=overdue' }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description={role ? `Signed in as ${role}.` : 'Signed in.'}
      />

      {alerts.length > 0 && <AlertList items={alerts} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jobs in progress" value={jobsInProgress.count ?? 0} href="/jobs" accent="amber" />
        <StatCard label="Available inventory" value={inventoryAvailable.count ?? 0} href="/inventory" />
        <StatCard label="Active craftsmen" value={craftsmenActive.count ?? 0} href="/craftsmen" />
        {showCosts && <StatCard label="Metal lots" value={metalLots.count ?? 0} href="/metal/lots" accent="brand" />}
        {showCosts && <StatCard label="Stones available" value={stoneItems.count ?? 0} href="/stones/lots" accent="brand" />}
        {showFinance && (
          <StatCard
            label="Unpaid invoices"
            value={unpaidInvoices.count ?? 0}
            href="/invoices?filter=unpaid"
            accent="red"
          />
        )}
      </div>

      <RecentActivity limit={10} />
    </div>
  )
}