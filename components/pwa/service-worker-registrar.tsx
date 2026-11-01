'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    // Only register in production to keep HMR fast during development
    if (process.env.NODE_ENV !== 'production') return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.error('[pwa] SW registration failed:', err))
  }, [])

  return null
}