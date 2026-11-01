import { redirect } from 'next/navigation'
import { getSessionInfo } from '@/lib/storefront/actions'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Sign In · Minal Gems' }

const STAFF_ROLES = ['admin', 'manager', 'sales', 'accountant']

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; next?: string }>
}) {
  const session = await getSessionInfo()

  if (session) {
    if (STAFF_ROLES.includes(session.profile.role)) redirect('/dashboard')
    if (session.profile.customer_id) redirect('/shop')
  }

  // Read the query string on the SERVER. Client form gets the value as a prop.
  const params = await searchParams
  const redirectTo = params.redirect ?? params.next ?? '/shop'

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-stone-900">Welcome back</h1>
          <p className="mt-2 text-sm text-stone-600">
            Sign in to access your account and orders.
          </p>
        </div>
        <div className="mt-8">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  )
}