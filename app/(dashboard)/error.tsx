'use client'
import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // TODO: plug into Sentry / Axiom / PostHog
    console.error('[dashboard]', error)
  }, [error])

  const ref = error.digest ?? 'unknown'

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-red-900">Something went wrong</h2>
        <p className="mt-2 text-sm text-red-800">
          An unexpected error occurred. You can retry — if it keeps happening,
          contact support and quote ref <code className="font-mono text-red-900">{ref}</code>.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}