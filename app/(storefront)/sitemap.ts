import type { MetadataRoute } from 'next'
import { getCategories, getAllPublishedSlugs } from '@/lib/storefront/catalog'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://minalgems.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, designs] = await Promise.all([
    getCategories(),
    getAllPublishedSlugs(),
  ])

  const staticPages = ['', '/shop', '/about', '/contact'].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.8,
  }))

  const catPages = categories.map((c) => ({
    url: `${BASE_URL}/shop/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  const designPages = designs.map((d) => ({
    url: `${BASE_URL}/shop/${d.category_slug ?? 'all'}/${d.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...catPages, ...designPages]
}