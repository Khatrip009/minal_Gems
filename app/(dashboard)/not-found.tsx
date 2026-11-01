import Link from 'next/link'
export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <p className="text-sm font-medium text-brand-600">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-1 text-slate-500">We couldn’t find that record.</p>
        <Link href="/" className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}