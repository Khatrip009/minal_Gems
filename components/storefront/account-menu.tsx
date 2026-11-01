'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  User,
  Package,
  MapPin,
  Settings,
  LogOut,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { logoutCustomer } from '@/lib/storefront/account'

export function AccountMenu({ fullName }: { fullName: string }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleLogout() {
    setOpen(false)
    startTransition(async () => {
      try {
        await logoutCustomer()
      } catch (err) {
        console.error('[account-menu] logout failed:', err)
      }
    })
  }

  const firstName = (fullName || '').split(' ')[0] || 'Account'

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="hidden sm:inline-flex items-center gap-1.5 text-sm text-stone-700 hover:text-stone-900 px-2 py-1.5 rounded-md hover:bg-stone-100"
      >
        <User className="h-4 w-4" />
        <span className="hidden md:inline">{firstName}</span>
        <ChevronDown className="h-3 w-3 opacity-60 hidden md:inline" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-56 rounded-lg border border-stone-200 bg-white p-1 shadow-lg z-50">
          <div className="border-b border-stone-100 px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-stone-900">
              {fullName}
            </p>
          </div>

          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-md"
          >
            <User className="h-3.5 w-3.5" /> My account
          </Link>
          <Link
            href="/account/orders"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-md"
          >
            <Package className="h-3.5 w-3.5" /> Orders
          </Link>
          <Link
            href="/account/addresses"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-md"
          >
            <MapPin className="h-3.5 w-3.5" /> Addresses
          </Link>
          <Link
            href="/account/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-md"
          >
            <Settings className="h-3.5 w-3.5" /> Profile
          </Link>

          <button
            onClick={handleLogout}
            disabled={pending}
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 rounded-md border-t border-stone-100 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LogOut className="h-3.5 w-3.5" />
            )}
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}