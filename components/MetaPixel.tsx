'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// Meta Pixel client-side tag. Installed so boosted Meta ads can track
// which visitors convert into signups / Pro upgrades on cruzar.app.
// Falls back cleanly when NEXT_PUBLIC_META_PIXEL_ID is unset — the
// pixel just doesn't fire, no errors in the console.
//
// Standard events we fire:
//   PageView         — every route change
//   Lead             — on /signup success (wired from signup page)
//   CompleteRegistration — on /welcome completion (wired from /welcome)
//   Purchase         — on Stripe success webhook (server-side via CAPI)
//
// The complement to this is the server-side Conversions API at
// /api/meta/capi which fires from the Stripe webhook for iOS 17+ ATT-
// blocked events. Both combined give the boosted ads real attribution
// data even when the browser pixel is suppressed.

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

export function MetaPixel() {
  const pathname = usePathname()

  useEffect(() => {
    if (!PIXEL_ID || typeof window === 'undefined') return
    if (typeof window.fbq !== 'function') return
    window.fbq('track', 'PageView')
  }, [pathname])

  if (!PIXEL_ID) return null

  return (
    <>
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  )
}

// Call this from event handlers after a successful conversion event.
// Safe no-op when pixel is not configured or not loaded.
export function trackMetaEvent(name: 'Lead' | 'CompleteRegistration' | 'Subscribe' | 'StartTrial' | 'ViewContent', params?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (typeof window.fbq !== 'function') return
  try {
    window.fbq('track', name, params || {})
  } catch { /* ignore */ }
}
