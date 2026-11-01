import { redirect } from 'next/navigation'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { AccountTabs } from './account-tabs'

export const dynamic = 'force-dynamic'

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = await getCurrentCustomer()
  if (!auth) redirect('/login?next=/account')

  const firstName = (auth.customer.name || '').split(' ')[0] || 'there'

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
          My Account
        </p>
        <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-stone-900">
          Hi, {firstName}
        </h1>
      </div>

      <AccountTabs />

      <div className="mt-8">{children}</div>
    </div>
  )
}