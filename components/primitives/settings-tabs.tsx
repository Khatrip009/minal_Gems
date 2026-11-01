// components/primitives/settings-tabs.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/settings',                 label: 'General' },
  { href: '/settings/locations',       label: 'Locations' },
  { href: '/settings/units',           label: 'Units' },
  { href: '/settings/metal',           label: 'Metal & Purity' },
  { href: '/settings/stone-master',    label: 'Stone Types' },
  { href: '/settings/materials',       label: 'Materials' },
  { href: '/settings/certificate-types', label: 'Certificates' },
  { href: '/settings/catalog-taxonomy', label: 'Catalog' },
] as const

export function SettingsTabs() {
  const pathname = usePathname()
  return (
    <nav className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="flex min-w-max items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== '/settings' && pathname?.startsWith(t.href))
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'text-fg' : 'text-fg-muted hover:text-fg',
              )}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-500" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}