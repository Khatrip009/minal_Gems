import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getDesignBySlug } from '@/lib/storefront/catalog'
import { getCurrentCustomer } from '@/lib/storefront/actions'
import { ProductDetailClient } from '@/components/storefront/product-detail-client'

export const dynamic = 'force-dynamic'

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '917096785900'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { slug } = await params
  const design = await getDesignBySlug(slug)
  if (!design) return { title: 'Not found' }

  return {
    title: design.meta_title ?? `${design.name} · Minal Gems`,
    description:
      design.meta_description ??
      design.short_description ??
      design.description?.slice(0, 160),
    openGraph: {
      title: design.name,
      images: design.primary_image ? [{ url: design.primary_image }] : [],
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { slug } = await params
  const [design, auth] = await Promise.all([
    getDesignBySlug(slug),
    getCurrentCustomer(),
  ])

  if (!design) notFound()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-stone-500 mb-8">
        <Link href="/" className="hover:text-stone-700">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/shop" className="hover:text-stone-700">Shop</Link>
        {design.category_name && design.category_slug && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/shop/${design.category_slug}`} className="hover:text-stone-700">
              {design.category_name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="text-stone-900 font-medium">{design.name}</span>
      </nav>

      <ProductDetailClient
        design={design}
        whatsappNumber={WHATSAPP_NUMBER}
        loggedIn={!!auth}
      />
    </div>
  )
}