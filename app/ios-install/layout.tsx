import type { Metadata } from 'next'

// Metadata for the iOS install landing page. Body lives in page.tsx as
// a client component because the whole UX (detect standalone, copy-link,
// track events) needs browser APIs. Keeping metadata out in the layout
// is the Next 16 App Router way to ship static SEO on a 'use client'
// page without fighting the compiler.
export const metadata: Metadata = {
  title: 'Cruzar on iPhone — 3 taps to install',
  description: 'Get the free app on your iPhone in 3 taps. No App Store needed.',
  alternates: {
    canonical: 'https://cruzar.app/ios-install',
  },
  openGraph: {
    title: 'Cruzar on iPhone — 3 taps to install',
    description: 'Get the free app on your iPhone in 3 taps. No App Store needed.',
    url: 'https://cruzar.app/ios-install',
    siteName: 'Cruzar',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cruzar on iPhone — 3 taps to install',
    description: 'Get the free app on your iPhone in 3 taps. No App Store needed.',
  },
}

export default function IosInstallLayout({ children }: { children: React.ReactNode }) {
  return children
}
