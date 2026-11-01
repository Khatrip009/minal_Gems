'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { NAV } from '@/lib/nav'
import type { Role } from '@/lib/roles'

export function Sidebar({
  role,
  mobileOpen = false,
  onClose,
}: {
  role: Role | null
  mobileOpen?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()
  if (!role || role === 'karigar') return null

  const content = (
    <>
      {/* Header — logo above name + role */}
      <div className="relative border-b border-slate-200 px-5 py-5">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <Link
          href="/"
          onClick={onClose}
          className="flex flex-col items-center gap-2"
        >
          <Image
            src="/logo_minalgems.png"
            alt="Minal Gems"
            width={144}
            height={72}
            className="h-auto w-36 object-contain"
            priority
          />
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">Minal Gems</p>
            <p className="mt-0.5 text-xs capitalize text-slate-500">{role}</p>
          </div>
        </Link>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 p-3">
        {NAV.map((section) => {
          const items = section.items.filter((i) => i.roles.includes(role))
          if (!items.length) return null
          return (
            <div key={section.title} className="mb-4">
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== '/' && pathname.startsWith(item.href + '/'))
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center rounded-md border-l-2 px-2.5 py-1.5 text-sm transition ${
                          active
                            ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                            : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 p-3">
        <p className="text-[11px] text-slate-400">v0.1 · Phase 1</p>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop — persistent sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white md:flex md:flex-col">
        {content}
      </aside>

      {/* Mobile — slide-in drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-2xl md:hidden"
          >
            {content}
          </aside>
        </>
      )}
    </>
  )
}