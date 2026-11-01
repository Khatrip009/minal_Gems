import Link from 'next/link'
import { cn } from '@/lib/utils'

export type StatAccent = 'slate' | 'brand' | 'amber' | 'red' | 'green'

const accents: Record<StatAccent, string> = {
  slate: 'bg-slate-50 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red:   'bg-red-50 text-red-700 ring-red-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

export function StatCard({
  label,
  value,
  href,
  accent = 'slate',
}: {
  label: string
  value: number | string
  href?: string
  accent?: StatAccent
}) {
  const inner = (
    <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className={cn('h-2 w-2 rounded-full ring-4', accents[accent])} aria-hidden />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  )

  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      {inner}
    </Link>
  ) : (
    inner
  )
}