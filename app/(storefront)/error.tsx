'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[storefront] error:', error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-32 text-center px-4">
      <h1 className="text-2xl font-semibold text-stone-900">Something went wrong</h1>
      <p className="mt-3 text-sm text-stone-600">
        We hit an unexpected snag. Please try again.
      </p>
      <button
        onClick={reset}
        className="mt-8 rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 text-sm font-semibold transition-colors"
      >
        Try again
      </button>
    </div>
  )
}