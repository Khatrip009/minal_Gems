// app/layout.tsx — PURE SHELL. No auth, no Supabase, no redirects.
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Minal Gems',
  description:
    'Fine gold and certified diamond jewellery, handcrafted in Surat since 1998.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Minal Gems',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Minal Gems',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
}

export const viewport: Viewport = {
  themeColor: '#0c0a09', // stone-950 — matches the manifest
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover', // safe for iPhone notch when installed as PWA
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}