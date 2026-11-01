'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/primitives/page-header'
import { EmptyState } from '@/components/primitives/empty-state'
import {
  FileText,
  Search,
  Plus,
  X,
  Printer,
} from 'lucide-react'

type Invoice = {
  id: string
  invoice_number: string
  invoice_date: string
  customer_id: string | null
  status: string
  payment_status: string
  subtotal: number | string
  discount: number | string
  tax_amount: number | string
  total: number | string
  amount_paid: number | string
  balance: number | string
  customers: {
    id: string
    name: string
    phone: string | null
    gstin: string | null
  } | null
}

const fmtMoney = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n)
    ? n.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'
}
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}
const humanize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const STATUS_TABS = ['all', 'paid', 'unpaid', 'partially_paid', 'voided'] as const
type StatusTab = (typeof STATUS_TABS)[number]

export function InvoicesTable({
  rows,
  currentCustomerFilter,
}: {
  rows: Invoice[]
  currentCustomerFilter: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [statusTab, setStatusTab] = useState<StatusTab>('all')

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length }
    for (const i of rows) {
      c[i.payment_status] = (c[i.payment_status] ?? 0) + 1
    }
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((i) => {
      if (statusTab !== 'all' && i.payment_status !== statusTab) return false
      if (!q) return true
      return (
        i.invoice_number.toLowerCase().includes(q) ||
        (i.customers?.name ?? '').toLowerCase().includes(q) ||
        (i.customers?.phone ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, query, statusTab])

  const totals = filtered.reduce(
    (a, i) => ({
      total: a.total + Number(i.total || 0),
      paid: a.paid + Number(i.amount_paid || 0),
      balance: a.balance + Number(i.balance || 0),
    }),
    { total: 0, paid: 0, balance: 0 },
  )

  function clearCustomerFilter() {
    router.push('/invoices')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description={`${rows.length} invoice${rows.length === 1 ? '' : 's'}`}
        actions={
          <Link href="/invoices/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New invoice
            </Button>
          </Link>
        }
      />

      {currentCustomerFilter && (
        <div className="flex items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
          Filtered by customer
          <button
            type="button"
            onClick={clearCustomerFilter}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab
          const count = counts[tab] ?? 0
          if (tab !== 'all' && count === 0) return null
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusTab(tab)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab === 'all' ? 'All' : humanize(tab)}
              <span className={`tabular ${active ? 'text-brand-100' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by invoice #, customer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title={rows.length === 0 ? 'No invoices yet' : 'No matches'}
          description={
            rows.length === 0
              ? 'Create your first invoice to sell a finished piece.'
              : 'Try a different search or filter.'
          }
          action={
            rows.length === 0 ? (
              <Link href="/invoices/new">
                <Button>+ New invoice</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  Invoice
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  Date
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  Customer
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  Total
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  Paid
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-slate-600">
                  Balance
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600">
                  Status
                </th>
                <th className="w-1 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const isVoid = i.status === 'voided'
                return (
                  <tr
                    key={i.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                      isVoid ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link
                        href={`/invoices/${i.id}`}
                        className={`text-brand-700 hover:underline ${
                          isVoid ? 'line-through' : ''
                        }`}
                      >
                        {i.invoice_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {fmtDate(i.invoice_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      {i.customers ? (
                        <div>
                          <div className="text-slate-900">{i.customers.name}</div>
                          {i.customers.phone && (
                            <div className="text-xs text-slate-500">
                              {i.customers.phone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular font-semibold">
                      ₹ {fmtMoney(i.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular text-emerald-700">
                      ₹ {fmtMoney(i.amount_paid)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular font-semibold ${
                        Number(i.balance) > 0.01
                          ? 'text-amber-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {Number(i.balance) > 0.01
                        ? `₹ ${fmtMoney(i.balance)}`
                        : '✓ paid'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          isVoid
                            ? 'bg-slate-100 text-slate-500 ring-slate-200'
                            : i.payment_status === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                              : i.payment_status === 'partially_paid'
                                ? 'bg-amber-50 text-amber-700 ring-amber-200'
                                : 'bg-rose-50 text-rose-700 ring-rose-200'
                        }`}
                      >
                        {humanize(i.payment_status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <a
                        href={`/invoices/print/${i.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                      >
                        <Printer className="h-3.5 w-3.5" /> Print
                      </a>
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                <td colSpan={3} className="px-4 py-2.5">
                  Totals
                </td>
                <td className="px-4 py-2.5 text-right tabular">
                  ₹ {fmtMoney(totals.total)}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-emerald-700">
                  ₹ {fmtMoney(totals.paid)}
                </td>
                <td className="px-4 py-2.5 text-right tabular text-amber-700">
                  ₹ {fmtMoney(totals.balance)}
                </td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}