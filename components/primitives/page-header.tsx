import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: string
  description?: string
  actions?: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="mb-6">
      {backHref && (
        <a
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <span aria-hidden>←</span> {backLabel ?? 'Back'}
        </a>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}