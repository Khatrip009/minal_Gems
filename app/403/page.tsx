import Link from 'next/link'

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">403</h1>
        <p className="text-slate-600 mt-2">You don&apos;t have permission to view this page.</p>
        <Link href="/" className="mt-4 inline-block text-blue-600 hover:underline">Back to dashboard</Link>
      </div>
    </div>
  )
}