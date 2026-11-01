'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
]

export function OrdersFilterBar() {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')

  function push(next: URLSearchParams) {
    router.push(`/orders?${next.toString()}`)
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    push(next)
  }

  const hasFilters = !!params.get('q') || !!params.get('status')

  return (
    <div className="flex flex-wrap gap-3 mb-4 items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setParam('q', q.trim())
        }}
        className="relative flex-1 min-w-[260px]"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search order number, customer, phone, emailâ€¦"
          className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </form>

      <select
        value={params.get('status') ?? ''}
        onChange={(e) => setParam('status', e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => {
            const next = new URLSearchParams()
            const tab = params.get('tab')
            if (tab) next.set('tab', tab)
            push(next)
            setQ('')
          }}
          className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  )
}