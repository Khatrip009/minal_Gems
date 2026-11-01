'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'

type PromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'minal-pwa-install-dismissed-at'
const DISMISS_DAYS = 14
const SHOW_DELAY_MS = 6000

export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Already installed?
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (standalone) {
      setIsInstalled(true)
      return
    }

    // Recently dismissed?
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const days =
        (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24)
      if (days < DISMISS_DAYS) return
    }

    const ua = window.navigator.userAgent
    const isIPadOS =
      window.navigator.platform === 'MacIntel' &&
      window.navigator.maxTouchPoints > 1
    const ios = /iPad|iPhone|iPod/.test(ua) || isIPadOS

    if (ios) {
      // iOS Safari doesn't fire beforeinstallprompt — show custom hint
      setIsIOS(true)
      const t = setTimeout(() => setShow(true), SHOW_DELAY_MS)
      return () => clearTimeout(t)
    }

    // Android / desktop Chromium — use the native prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as PromptEvent)
      setTimeout(() => setShow(true), SHOW_DELAY_MS)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setShow(false)
      setPromptEvent(null)
      setIsInstalled(true)
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  function dismiss() {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      setIsInstalled(true)
    } else {
      dismiss()
    }
    setPromptEvent(null)
  }

  if (!show || isInstalled) return null

  return (
    <div
      role="dialog"
      aria-label="Install app"
      className="fixed inset-x-3 bottom-3 z-50 sm:bottom-4 sm:left-auto sm:right-4 sm:inset-x-auto sm:max-w-sm"
    >
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_minalgems.png"
              alt=""
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-base font-semibold text-stone-900">
              Install Minal Gems
            </p>
            {isIOS ? (
              <p className="mt-1 text-xs leading-snug text-stone-600">
                Tap{' '}
                <Share className="mx-0.5 inline h-3.5 w-3.5 text-sky-600" />{' '}
                then{' '}
                <span className="inline-flex items-center gap-0.5 font-medium text-stone-800">
                  <Plus className="inline h-3 w-3" /> Add to Home Screen
                </span>
              </p>
            ) : (
              <p className="mt-1 text-xs leading-snug text-stone-600">
                Faster browsing, offline access, and a home-screen shortcut.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isIOS ? (
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Got it
          </button>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={install}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800"
            >
              <Download className="h-4 w-4" /> Install
            </button>
          </div>
        )}
      </div>
    </div>
  )
}