'use client'

import { ReactNode, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type Column<T> = {
  key: string
  header: string
  cell: (row: T) => ReactNode
  sortable?: boolean
  hideOnMobile?: boolean
  hideOnTablet?: boolean
  align?: 'left' | 'right' | 'center'
}

export type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  mobileCard: (row: T) => ReactNode
  emptyState?: ReactNode
  onRowClick?: (row: T) => void
  searchPlaceholder?: string
  pageSize?: number
  loading?: boolean
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  mobileCard,
  emptyState,
  onRowClick,
  searchPlaceholder = 'Search…',
  pageSize = 25,
  loading = false,
}: DataTableProps<T>) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!q) return rows
    const needle = q.toLowerCase()
    return rows.filter((r) =>
      columns.some((c) => String((r as any)[c.key] ?? '').toLowerCase().includes(needle)),
    )
  }, [q, rows, columns])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const slice = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize)

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-surface-muted" />
        ))}
      </div>
    )
  }

  if (rows.length === 0 && emptyState) return <>{emptyState}</>

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0) }}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="md" className="shrink-0">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </Button>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface sm:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-fg-muted',
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slice.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-surface-muted',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-4 py-3',
                      c.align === 'right' && 'text-right tabular-nums',
                      c.align === 'center' && 'text-center',
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {slice.map((row) => (
          <button
            type="button"
            key={rowKey(row)}
            onClick={() => onRowClick?.(row)}
            className="w-full rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-muted active:bg-surface-sunken"
          >
            {mobileCard(row)}
          </button>
        ))}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-fg-muted">
          <span>
            {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 tabular-nums">{safePage + 1} / {pageCount}</span>
            <Button
              variant="ghost" size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}