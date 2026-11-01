import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-32 text-center px-4">
      <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
        404
      </p>
      <h1 className="mt-4 text-3xl font-semibold text-stone-900">
        We couldn't find this piece.
      </h1>
      <p className="mt-3 text-sm text-stone-600">
        It may have been sold, moved, or renamed. Try browsing our collections.
      </p>
      <Link
        href="/shop"
        className="mt-8 inline-flex items-center rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6 py-3 text-sm font-semibold transition-colors"
      >
        Back to Shop
      </Link>
    </div>
  )
}