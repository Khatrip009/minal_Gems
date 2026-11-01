import { getCurrentCustomer } from '@/lib/storefront/actions'
import { ProfileForm } from './profile-form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Profile · Minal Gems' }

export default async function ProfilePage() {
  const auth = await getCurrentCustomer()
  if (!auth) return null

  return (
    <ProfileForm
      initialName={auth.customer.name ?? ''}
      initialPhone={auth.customer.phone ?? ''}
      email={auth.customer.email ?? auth.user.email ?? ''}
    />
  )
}