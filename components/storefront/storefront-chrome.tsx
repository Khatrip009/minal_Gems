'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Search,
  ShoppingBag,
  User,
  Menu,
  X,
  ArrowRight,
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/shop', label: 'Shop' },
  { href: '/shop/rings', label: 'Rings' },
  { href: '/shop/earrings', label: 'Earrings' },
  { href: '/shop/necklaces', label: 'Necklaces' },
  { href: '/shop/bangles', label: 'Bangles' },
]

const MOBILE_SECONDARY = [
  { href: '/account', label: 'My account' },
  { href: '/account/orders', label: 'Track an order' },
  { href: '/cart', label: 'Cart' },
]

export function StorefrontHeader() {
  const [open, setOpen] = useState(false)

  // Lock body scroll + close on Escape while the drawer is open
  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/90 backdrop-blur-md">
        {/* Announcement strip */}
        <div className="hidden bg-stone-900 py-1.5 text-center text-[11px] font-medium uppercase tracking-widest text-stone-100 sm:block">
          Free insured shipping on orders above ₹50,000
        </div>

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          {/* Left — mobile menu + logo */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-full p-2 text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 lg:hidden"
              aria-label="Open menu"
              aria-expanded={open}
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              <Image
                src="/logo_minalgems.png"
                alt="Minal Gems"
                width={250}
                height={80}
                className="h-auto w-[250px] object-contain"
                priority
              />
             
            </Link>
          </div>

          {/* Center — desktop nav */}
          <nav className="hidden items-center gap-6 lg:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-stone-700 transition-colors hover:text-stone-900"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Right — actions */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link
              href="/shop"
              className="rounded-full p-2 text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Link>
            <Link
              href="/account"
              className="hidden rounded-full p-2 text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 sm:inline-flex"
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>
            <Link
              href="/cart"
              className="rounded-full p-2 text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ────────────────────────────────── */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm lg:hidden"
            onClick={close}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col bg-white shadow-2xl lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Image
                  src="/logo_minalgems.png"
                  alt="Minal Gems"
                  width={48}
                  height={48}
                  className="h-8 w-8 object-contain"
                />
                <span className="font-serif text-base font-medium text-stone-900">
                  Minal Gems
                </span>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-2 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                Shop
              </p>
              <ul>
                {NAV_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={close}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-100"
                    >
                      {l.label}
                      <ArrowRight className="h-4 w-4 text-stone-300" />
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="my-3 border-t border-stone-200" />

              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                Account
              </p>
              <ul>
                {MOBILE_SECONDARY.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={close}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-100"
                    >
                      {l.label}
                      <ArrowRight className="h-4 w-4 text-stone-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Drawer footer */}
            <div className="border-t border-stone-200 px-4 py-3">
              <p className="text-[11px] text-stone-500">
                33, Sant tukaram Society-2
                <br />
                Palanpur Jakatnaka, Surat
              </p>
              <p className="mt-1 text-[11px] font-medium text-stone-700">
                +91 70967 85900
              </p>
            </div>
          </aside>
        </>
      )}
    </>
  )
}

export function StorefrontFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <Image
              src="/logo_minalgems.png"
              alt="Minal Gems"
              width={64}
              height={64}
              className="h-9 w-9 object-contain"
            />
            <span className="font-serif text-lg font-medium text-stone-900">
              Minal Gems
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            Fine jewellery, handcrafted in Surat since 1998.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Shop
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/shop" className="text-stone-700 hover:text-stone-900">
                All collections
              </Link>
            </li>
            <li>
              <Link
                href="/shop/rings"
                className="text-stone-700 hover:text-stone-900"
              >
                Rings
              </Link>
            </li>
            <li>
              <Link
                href="/shop/earrings"
                className="text-stone-700 hover:text-stone-900"
              >
                Earrings
              </Link>
            </li>
            <li>
              <Link
                href="/shop/necklaces"
                className="text-stone-700 hover:text-stone-900"
              >
                Necklaces
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Support
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="/account/orders"
                className="text-stone-700 hover:text-stone-900"
              >
                Track order
              </Link>
            </li>
            <li>
              <Link
                href="/account"
                className="text-stone-700 hover:text-stone-900"
              >
                My account
              </Link>
            </li>
            <li>
              <Link
                href="/cart"
                className="text-stone-700 hover:text-stone-900"
              >
                Cart
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Contact
          </p>
          <ul className="mt-3 space-y-2 text-sm text-stone-600">
            <li>33, Sant tukaram Society-2</li>
            <li>Palanpur Jakatnaka, Surat</li>
            <li>+91 70967 85900</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-200 py-4 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} Minal Gems. All rights reserved.
      </div>
    </footer>
  )
}