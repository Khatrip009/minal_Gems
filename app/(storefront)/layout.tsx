import { StorefrontFooter, StorefrontHeader } from '@/components/storefront/storefront-chrome'
import { InstallBanner } from '@/components/pwa/install-banner'

export const dynamic = 'force-dynamic'

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <StorefrontHeader />
      <main className="flex-1">{children}</main>
      <StorefrontFooter />
      <InstallBanner />
    </div>
  )
}