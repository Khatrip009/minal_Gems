import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { StatusDef, Tone } from '@/lib/status-maps'
import {
  buybackStatusMap,
  inventoryStatusMap,
  invoicePaymentStatusMap,
  invoiceStatusMap,
  jobStatusMap,
  returnStatusMap,
  schemeEnrollmentStatusMap,
} from '@/lib/status-maps'

// ── Tone → Tailwind class map (single source of truth) ─────────────────
export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info:    'bg-blue-50 text-blue-700',
  warning: 'bg-amber-50 text-amber-700',
  success: 'bg-emerald-50 text-emerald-700',
  danger:  'bg-rose-50 text-rose-700',
  brand:   'bg-brand-50 text-brand-700',
  muted:   'bg-slate-100 text-slate-500',
}

const ALL_MAPS: Record<string, StatusDef>[] = [
  jobStatusMap,
  invoiceStatusMap,
  invoicePaymentStatusMap,
  inventoryStatusMap,
  returnStatusMap,
  buybackStatusMap,
  schemeEnrollmentStatusMap,
]

function resolveStatus(status: string): StatusDef | undefined {
  for (const m of ALL_MAPS) if (m[status]) return m[status]
  return undefined
}

/**
 * Legacy helper — maps a status string OR a tone name to a Tailwind class
 * string. Supports all DB statuses defined in `lib/status-maps.ts`.
 *
 * Usage preserved from previous module:
 *   <span className={statusVariant(row.status)}>{row.status}</span>
 *   <Badge variant={statusVariant(row.status)} />
 */
export function statusVariant(status: string | null | undefined): string {
  if (!status) return TONE_CLASS.neutral
  const def = resolveStatus(status)
  if (def) return TONE_CLASS[def.tone]
  if ((status as Tone) in TONE_CLASS) return TONE_CLASS[status as Tone]
  return TONE_CLASS.neutral
}

// ── Component (flexible props: new + legacy) ───────────────────────────

type StatusBadgeProps = {
  /** New API — pass a StatusDef from `lib/status-maps.ts` */
  def?: StatusDef
  /** Convenience — pass a raw DB status; label/icon/color auto‑resolved */
  status?: string
  /** Legacy — pass a className/tone name (from `statusVariant(...)`) */
  variant?: string
  /** Legacy — pass a tone directly */
  tone?: Tone
  icon?: ComponentType<{ className?: string }>
  children?: ReactNode
  className?: string
}

export function StatusBadge({
  def,
  status,
  variant,
  tone,
  icon,
  children,
  className,
}: StatusBadgeProps) {
  const resolved = def ?? (status ? resolveStatus(status) : undefined)
  const label = children ?? resolved?.label ?? status ?? null
  const Icon = icon ?? resolved?.icon

  const cls = variant
    ? variant in TONE_CLASS
      ? TONE_CLASS[variant as Tone]
      : variant // treat as raw className
    : resolved
      ? TONE_CLASS[resolved.tone]
      : tone
        ? TONE_CLASS[tone]
        : TONE_CLASS.neutral

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        cls,
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  )
}