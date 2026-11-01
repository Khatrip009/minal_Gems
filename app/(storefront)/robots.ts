import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://minalgem.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account/', '/cart', '/checkout', '/order/', '/login', '/signup'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}