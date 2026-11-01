'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Package, MapPin, Settings } from 'lucide-react'

const TABS = [
  { href: '/account', label: 'Overview', icon: User },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/profile', label: 'Profile', icon: Settings },
]

export function AccountTabs() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-stone-200">
      <ul className="flex gap-1 overflow-x-auto">
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/account'
              ? pathname === '/account'
              : pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-stone-900 border-stone-900'
                    : 'text-stone-600 border-transparent hover:text-stone-900 hover:border-stone-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}