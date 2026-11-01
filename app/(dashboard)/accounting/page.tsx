import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  Package,
  ArrowUpRight,
  AlertTriangle,
  CircleDollarSign,
  BookOpen,
  Scale,
  FileText,
  PieChart,
  Clock,
  CheckCircle2,
  Lock,
  FileLock2,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0.00'
}
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const INVENTORY_CODES = ['1300', '1310', '1320', '1330', '1340', '1350', '1400', '1500']

export default async function AccountingOverviewPage() {
  const { supabase } = await requireRole(['admin', 'manager', 'accountant'])

  const now = new Date()
  const ytdStart = `${now.getFullYear()}-01-01`

  const [
    { data: accounts, error: accErr },
    { data: lines, error: linesErr },
    { data: recentEntries },
    { data: periods },
  ] = await Promise.all([
    supabase
      .from('gl_accounts')
      .select('id, code, name, type, is_cash, is_bank, opening_balance')
      .eq('is_active', true),
    supabase
      .from('journal_lines')
      .select('account_id, debit, credit, journal_entries!inner(entry_date)'),
    supabase
      .from('journal_entries')
      .select('id, entry_date, entry_number, description, voucher_type, total_amount')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('accounting_periods')
      .select('period_year, period_month, status, locked_at')
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(6),
  ])

  if (accErr || linesErr) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        Failed to load accounting data:{' '}
        {accErr?.message ?? linesErr?.message}
      </div>
    )
  }

  const accountById = new Map(
    (accounts ?? []).map((a: any) => [a.id, a]),
  )

  // ── Aggregate KPIs ──
  let cash = 0
  let bank = 0
  let ar = 0
  let ap = 0
  let inventory = 0
  let ytdRevenue = 0
  let ytdExpense = 0
  let totalDebit = 0
  let totalCredit = 0

  for (const line of lines ?? []) {
    const acct = accountById.get(line.account_id) as any
    if (!acct) continue
    const dr = Number(line.debit)
    const cr = Number(line.credit)
    totalDebit += dr
    totalCredit += cr
    const delta = dr - cr
    const entryDate = (line.journal_entries as any)?.entry_date as string

    if (acct.is_cash) cash += delta
    if (acct.is_bank) bank += delta
    if (acct.code === '1200') ar += delta
    if (acct.code === '2000') ap += delta
    if (INVENTORY_CODES.includes(acct.code)) inventory += delta

    if (entryDate && entryDate >= ytdStart) {
      if (acct.type === 'revenue') ytdRevenue += cr - dr
      if (acct.type === 'expense') ytdExpense += dr - cr
    }
  }

  const ytdProfit = ytdRevenue - ytdExpense
  const liquid = cash + bank
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01
  const diff = Math.abs(totalDebit - totalCredit)

  // Current month's period
  const currentPeriod = (periods ?? []).find(
    (p: any) =>
      p.period_year === now.getFullYear() &&
      p.period_month === now.getMonth() + 1,
  )

  const alerts: Array<{
    tone: 'rose' | 'amber' | 'emerald' | 'sky'
    title: string
    message: string
  }> = []

  if (!balanced) {
    alerts.push({
      tone: 'rose',
      title: 'Books do not balance',
      message: `Debits − Credits = ₹${fmtMoney(diff)}. Open the Journal register and look for entries flagged Unbalanced.`,
    })
  }
  if ((periods ?? []).length === 0) {
    alerts.push({
      tone: 'amber',
      title: 'No accounting periods seeded',
      message:
        'Lock and close controls need periods to exist. Run the seed SQL from Periods to create them.',
    })
  }
  if (currentPeriod?.status === 'open') {
    // fine, no alert
  } else if (currentPeriod?.status === 'locked') {
    alerts.push({
      tone: 'amber',
      title: `Current period ${currentPeriod.period_month}/${currentPeriod.period_year} is locked`,
      message: 'New entries for this month will be rejected by the posting RPCs.',
    })
  } else if (!currentPeriod) {
    alerts.push({
      tone: 'amber',
      title: `No period row for ${now.getMonth() + 1}/${now.getFullYear()}`,
      message: 'Create it on the Periods page before month-end.',
    })
  }
  if (inventory < 0) {
    alerts.push({
      tone: 'amber',
      title: 'Finished Goods Inventory is negative',
      message: `₹${fmtMoney(Math.abs(inventory))} net credit. Likely missing completion postings for recent craftsman jobs.`,
    })
  }

  const REPORTS = [
    {
      href: '/accounting/trial-balance',
      label: 'Trial Balance',
      description: 'Opening, debits, credits, and closing per account',
      icon: Scale,
    },
    {
      href: '/accounting/ledger',
      label: 'Account Ledger',
      description: 'Running balance for any single GL account',
      icon: BookOpen,
    },
    {
      href: '/accounting/journal',
      label: 'Journal Register',
      description: 'Every voucher with Dr/Cr total per entry',
      icon: FileText,
    },
    {
      href: '/accounting/pnl',
      label: 'Profit & Loss',
      description: 'Revenue, expense, and net profit for a period',
      icon: TrendingUp,
    },
    {
      href: '/accounting/balance-sheet',
      label: 'Balance Sheet',
      description: 'Assets, liabilities, and equity as of a date',
      icon: PieChart,
    },
    {
      href: '/accounting/cash-flow',
      label: 'Cash Flow',
      description: 'Movements on cash and bank accounts',
      icon: Wallet,
    },
    {
      href: '/accounting/periods',
      label: 'Periods',
      description: 'Open, locked, and closed accounting months',
      icon: Clock,
    },
  ]

  const TONE = {
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Accounting</h1>
          <p className="mt-1 text-sm text-slate-500">
            Double-entry books · YTD {now.getFullYear()} · last refreshed{' '}
            {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <Link
          href="/accounting/trial-balance"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
        >
          Open Trial Balance <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${TONE[a.tone]}`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">{a.title}</p>
                <p className="mt-0.5 text-xs opacity-80">{a.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Balance-sheet style KPIs */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Position today
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Liquid (Cash + Bank)"
            value={liquid}
            sub={`Cash ₹${fmtMoney(cash)} · Bank ₹${fmtMoney(bank)}`}
            icon={Wallet}
            tone="emerald"
          />
          <Kpi
            label="Receivables"
            value={ar}
            sub="Accounts Receivable (1200)"
            icon={CircleDollarSign}
            tone="sky"
          />
          <Kpi
            label="Payables"
            value={-ap}
            sub="Accounts Payable (2000)"
            icon={Users}
            tone="amber"
          />
          <Kpi
            label="Inventory"
            value={inventory}
            sub="Metal + stones + FG + WIP"
            icon={Package}
            tone={inventory < 0 ? 'rose' : 'slate'}
          />
        </div>
      </div>

      {/* P&L KPIs */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Year to date · {now.getFullYear()}
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Kpi
            label="Revenue"
            value={ytdRevenue}
            sub="Credits − debits on revenue accounts"
            icon={TrendingUp}
            tone="emerald"
          />
          <Kpi
            label="Expenses"
            value={ytdExpense}
            sub="Debits − credits on expense accounts"
            icon={TrendingDown}
            tone="rose"
          />
          <Kpi
            label="Net Profit"
            value={ytdProfit}
            sub={ytdRevenue > 0 ? `${((ytdProfit / ytdRevenue) * 100).toFixed(1)}% margin` : '—'}
            icon={CircleDollarSign}
            tone={ytdProfit >= 0 ? 'emerald' : 'rose'}
            bold
          />
        </div>
      </div>

      {/* Reports grid */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Reports
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REPORTS.map((r) => {
            const Icon = r.icon
            return (
              <Link
                key={r.href}
                href={r.href}
                className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-slate-50"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {r.description}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-brand-500" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Two-column: recent entries + period status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-900">Recent entries</h3>
            <Link
              href="/accounting/journal"
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Open register →
            </Link>
          </div>
          {(recentEntries ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No journal entries yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {(recentEntries ?? []).map((e: any) => (
                  <tr
                    key={e.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">
                      {fmtDate(e.entry_date)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link
                        href={`/accounting/journal/${e.id}`}
                        className="text-brand-700 hover:underline"
                      >
                        {e.entry_number ?? e.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                        {humanize(e.voucher_type ?? 'journal')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {e.description ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold tabular">
                      ₹ {fmtMoney(e.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-900">Periods</h3>
            <Link
              href="/accounting/periods"
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Manage →
            </Link>
          </div>
          {(periods ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No periods seeded.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(periods ?? []).map((p: any) => {
                const isCurrent =
                  p.period_year === now.getFullYear() &&
                  p.period_month === now.getMonth() + 1
                const label = new Date(p.period_year, p.period_month - 1, 1).toLocaleString(
                  'en-IN',
                  { month: 'short', year: 'numeric' },
                )
                return (
                  <li
                    key={`${p.period_year}-${p.period_month}`}
                    className={`flex items-center justify-between px-4 py-2 ${
                      isCurrent ? 'bg-brand-50/30' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {label}
                        {isCurrent && (
                          <span className="ml-1.5 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand-700">
                            current
                          </span>
                        )}
                      </p>
                      {p.locked_at && (
                        <p className="text-[10px] text-slate-500">
                          Locked {fmtDate(p.locked_at)}
                        </p>
                      )}
                    </div>
                    <PeriodBadge status={p.status} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  bold,
}: {
  label: string
  value: number
  sub?: string
  icon: any
  tone: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate'
  bold?: boolean
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: 'text-emerald-700 bg-emerald-50',
    sky: 'text-sky-700 bg-sky-50',
    amber: 'text-amber-700 bg-amber-50',
    rose: 'text-rose-700 bg-rose-50',
    slate: 'text-slate-700 bg-slate-50',
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${toneClass[tone]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p
        className={`mt-1.5 tabular ${
          bold ? 'text-2xl font-bold' : 'text-xl font-semibold'
        }`}
      >
        ₹ {fmtMoney(value)}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-500">{sub}</p>}
    </div>
  )
}

function PeriodBadge({ status }: { status: string }) {
  if (status === 'open') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Open
      </span>
    )
  }
  if (status === 'locked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
        <Lock className="h-3 w-3" /> Locked
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700 ring-1 ring-inset ring-slate-200">
      <FileLock2 className="h-3 w-3" /> Closed
    </span>
  )
}