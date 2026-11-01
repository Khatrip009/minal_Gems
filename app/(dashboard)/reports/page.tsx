import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import {
  Users,
  Receipt,
  Factory,
  Package,
  CircleDollarSign,
  Truck,
  FileSpreadsheet,
  ArrowUpRight,
  BookOpen,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

type ReportCard = {
  href: string
  label: string
  description: string
  icon: any
}

type ReportGroup = {
  title: string
  blurb: string
  reports: ReportCard[]
}

export default async function ReportsHubPage() {
  await requireRole(['admin', 'manager', 'accountant', 'sales'])

  const GROUPS: ReportGroup[] = [
    {
      title: 'Production',
      blurb: 'Craftsman settlement, material flow, job economics, stock valuation',
      reports: [
        {
          href: '/reports/craftsman-ledger',
          label: 'Craftsman Ledger',
          description:
            'Gold held, stones held, and labour owed per karigar — derived from issue/return event log',
          icon: Users,
        },
        {
          href: '/reports/stock-summary',
          label: 'Stock Summary',
          description:
            'Metal + stones + finished goods + WIP on one page with cost valuation',
          icon: Package,
        },
        {
          href: '/reports/production',
          label: 'Production Reports',
          description:
            'Settlement · Gold flow · Stone flow · Job profitability · Payments ledger (tabbed)',
          icon: Factory,
        },
      ],
    },
    {
      title: 'Sales',
      blurb: 'Invoices, receivables, and payment status',
      reports: [
        {
          href: '/reports/invoices',
          label: 'Invoice Register',
          description:
            'Every invoice with totals, payment status, channel split, and outstanding balance',
          icon: Receipt,
        },
      ],
    },
    {
      title: 'Finance',
      blurb: 'Double-entry books, statements, and reconciliations',
      reports: [
        {
          href: '/accounting',
          label: 'Accounting Suite',
          description:
            'Trial balance · Ledger · Journal · P&L · Balance sheet · Cash flow · Periods',
          icon: BookOpen,
        },
      ],
    },
  ]

  const COMING_SOON = [
    {
      label: 'Outstanding Dashboard',
      description: 'Receivables + payables + craftsman balances at a glance',
      icon: CircleDollarSign,
    },
    {
      label: 'Vendor Ledger',
      description: 'Purchases, payments, and running balance per supplier',
      icon: Truck,
    },
    {
      label: 'GST Register',
      description: 'B2B / B2C splits, HSN summary, GSTR-1 prep',
      icon: FileSpreadsheet,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">
          Operational and financial reports across the business. Every report is
          exportable as CSV (where it makes sense) or branded PDF.
        </p>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title}>
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {group.title}
            </h2>
            <span className="text-xs text-slate-400">{group.blurb}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.reports.map((r) => {
              const Icon = r.icon
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
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
      ))}

      <div>
        <div className="mb-3 flex items-baseline gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Coming soon
          </h2>
          <span className="text-xs text-slate-400">
            Not yet built — reserved for the next batch
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COMING_SOON.map((r) => {
            const Icon = r.icon
            return (
              <div
                key={r.label}
                className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500">
                      {r.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {r.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}