'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PieChart,
  Scale,
  BookOpen,
  FileText,
  TrendingUp,
  Wallet,
  Clock,
  Activity,
} from 'lucide-react'

const TABS = [
  { href: '/accounting', label: 'Overview', icon: PieChart, exact: true },
  { href: '/accounting/trial-balance', label: 'Trial Balance', icon: Scale },
  { href: '/accounting/ledger', label: 'Ledger', icon: BookOpen },
  { href: '/accounting/journal', label: 'Journal', icon: FileText },
  { href: '/accounting/pnl', label: 'P&L', icon: TrendingUp },
  { href: '/accounting/balance-sheet', label: 'Balance Sheet', icon: PieChart },
  { href: '/accounting/cash-flow', label: 'Cash Flow', icon: Wallet },
  { href: '/accounting/periods', label: 'Periods', icon: Clock },
]

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200">
        <Link
          href="/accounting"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800"
        >
          <Activity className="h-3.5 w-3.5" /> Accounting
        </Link>
        <nav className="-mb-px mt-2 flex flex-wrap gap-1">
          {TABS.map((t) => {
            const active = t.exact
              ? pathname === t.href
              : pathname?.startsWith(t.href)
            const Icon = t.icon
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  )
}