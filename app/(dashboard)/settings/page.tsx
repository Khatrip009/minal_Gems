// app/(dashboard)/settings/page.tsx
import Link from 'next/link'
import { requireRole } from '@/lib/guard'
import { PageHeader } from '@/components/primitives/page-header'
import { SettingsTabs } from '@/components/primitives/settings-tabs'
import {
  MapPin,
  Ruler,
  Gem,
  Package2,
  Award,
  Tag,
  ArrowRight,
  Image as ImageIcon,
  Building2,
  Users 
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const SECTIONS = [
  { href: '/settings/company',           label: 'Company Profile',    icon: Building2,  hint: 'Name, GSTIN, PAN, address, bank, tax defaults' },
  { href: '/settings/locations',         label: 'Locations',           icon: MapPin,     hint: 'Store, safe, counter, transit' },
  { href: '/settings/users', label: 'Users & Members', icon: Users, hint: 'Invite staff, set roles, manage access' },
  { href: '/settings/units',             label: 'Units',               icon: Ruler,      hint: 'Weight & length units' },
  { href: '/settings/metal',             label: 'Metal & Purity',      icon: Gem,        hint: '24K, 22K, 18K, alloys, rates' },
  { href: '/settings/stone-master',      label: 'Stone Types',         icon: Gem,        hint: 'Diamond, gemstone, CZ profiles' },
  { href: '/settings/materials',         label: 'Materials',           icon: Package2,   hint: 'Leather, clasps, findings' },
  { href: '/settings/certificate-types', label: 'Certificate Types',   icon: Award,      hint: 'IGI, GIA, SGL' },
  { href: '/settings/catalog-taxonomy',  label: 'Categories & Brands', icon: Tag,        hint: 'Product hierarchy' },
  { href: '/settings/hero-slides',       label: 'Hero Slides',         icon: ImageIcon,  hint: 'Homepage carousel images' },
]

export default async function SettingsPage() {
  await requireRole(['admin', 'manager'])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Master data and configuration for the entire system."
      />
      <SettingsTabs />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-start gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-muted"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
              <s.icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-fg">{s.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-0.5 text-xs text-fg-muted">{s.hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}