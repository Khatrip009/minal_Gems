'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import type { Role } from '@/lib/roles'

export function DashboardShell({
  role,
  email,
  fullName,
  children,
}: {
  role: Role | null
  email: string
  fullName: string
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close the drawer on any route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!mobileOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [mobileOpen])

  // Escape closes the drawer
  useEffect(() => {
    if (!mobileOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        role={role}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          email={email}
          fullName={fullName}
          role={role}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}