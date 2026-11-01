import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Minal Gems',
    short_name: 'Minal',
    description:
      'Fine gold and certified diamond jewellery, handcrafted in Surat since 1998.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fafaf9', // stone-50
    theme_color: '#0c0a09',      // stone-950
    lang: 'en-IN',
    dir: 'ltr',
    categories: ['shopping', 'lifestyle'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Shop',
        short_name: 'Shop',
        url: '/shop',
        description: 'Browse the collection',
      },
      {
        name: 'My Orders',
        short_name: 'Orders',
        url: '/account/orders',
        description: 'Track your orders',
      },
      {
        name: 'Cart',
        short_name: 'Cart',
        url: '/cart',
        description: 'View your cart',
      },
    ],
  }
}