import Link from 'next/link'
import { AlertTriangle, AlertOctagon, Info, ArrowRight } from 'lucide-react'
import type { Tone } from '@/lib/status-maps'
import { cn } from '@/lib/utils'

export type AlertItem = {
  tone: Tone
  label: string
  href?: string
}

const TONE_STYLE: Record<Tone, { wrap: string; icon: React.ComponentType<{ className?: string }> }> = {
  danger:  { wrap: 'border-danger/30 bg-danger-bg text-fg',        icon: AlertOctagon },
  warning: { wrap: 'border-warning/30 bg-warning-bg text-fg',      icon: AlertTriangle },
  info:    { wrap: 'border-info/30 bg-info-bg text-fg',            icon: Info },
  success: { wrap: 'border-success/30 bg-success-bg text-fg',      icon: Info },
  neutral: { wrap: 'border-border bg-surface-muted text-fg',       icon: Info },
  brand:   { wrap: 'border-brand-200 bg-brand-50 text-fg',         icon: Info },
  muted:   { wrap: 'border-border bg-surface-muted text-fg-muted', icon: Info },
}

export function AlertList({ items }: { items: AlertItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      {items.map((a, i) => {
        // ★ Defensive: fall back to neutral if a.tone is missing or invalid
        const style = TONE_STYLE[a.tone] ?? TONE_STYLE.neutral
        const Icon = style.icon

        // ★ Dev-only hint so the bad value shows up in the console
        if (process.env.NODE_ENV !== 'production' && !TONE_STYLE[a.tone]) {
          console.warn(
            `[AlertList] invalid tone="${String(a.tone)}" on item:`,
            a.label,
            '— falling back to neutral',
          )
        }

        return (
          <div
            key={i}
            className={cn(
              'flex items-center gap-3 rounded-md border px-4 py-3 text-sm',
              style.wrap,
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 font-medium">{a.label}</span>
            {a.href && (
              <Link
                href={a.href}
                className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
              >
                View <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )
      })}
    </div>
  )
}