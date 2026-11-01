'use client'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'
import type { Role } from '@/lib/roles'

export function TopBar({
  email,
  fullName,
  role,
  onMenuClick,
}: {
  email: string
  fullName: string
  role: Role | null
  onMenuClick: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click or Escape
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  async function signOut() {
    setOpen(false)
    try {
      await createClient().auth.signOut()
    } catch (err) {
      // Supabase clears the local session regardless, so we proceed.
      console.warn('Sign-out API call failed; local session cleared anyway', err)
    }
    // Hard navigation — bypasses any broken RSC fetch on /login
    window.location.href = '/login'
  }

  const initials = (fullName || email || '?')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-white/75 md:px-6">
      {/* Left — mobile hamburger + greeting */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="-ml-1 rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 truncate text-sm text-slate-500">
          Welcome back
          {fullName && (
            <span className="font-medium text-slate-800">
              , {fullName.split(' ')[0]}
            </span>
          )}
        </div>
      </div>

      {/* Right — role badge + avatar + dropdown */}
      <div className="relative flex items-center gap-2 sm:gap-3" ref={ref}>
        {role && (
          <span className="hidden rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600 sm:inline">
            {role}
          </span>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-200"
          aria-label="User menu"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {initials}
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-11 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-medium text-slate-900">
                {fullName || 'User'}
              </p>
              <p className="truncate text-xs text-slate-500">{email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start"
              onClick={signOut}
              role="menuitem"
            >
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}