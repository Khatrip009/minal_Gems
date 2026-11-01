import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { SignupForm } from './signup-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Create Account · Minal Gems' }

export default async function SignupPage() {
  const auth = await getCurrentCustomer()
  if (auth) redirect('/shop')

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-stone-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Save addresses, track orders, and get personalised recommendations.
          </p>
        </div>

        <div className="mt-8">
          <SignupForm />
        </div>

        <p className="mt-8 text-center text-sm text-stone-600">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-amber-700 hover:text-amber-800"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}