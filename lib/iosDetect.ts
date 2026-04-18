// iOS Safari detection — used to route iOS users to `/ios-install`, a
// dedicated Safari-only walkthrough. Funnel data (2026-04-17): iOS is
// 2× Android in registered users but iOS users mostly fail to install
// the PWA. Sending them to a tailored page at the three critical entry
// points (/welcome mount, /signup hero copy, push-install gate) is
// meant to close that gap.
//
// Three conditions that isolate the "needs the /ios-install walkthrough"
// audience:
//   1. `isIosSafari()` — iOS device AND Safari (excluding FB/IG/TikTok/
//      WhatsApp/X/Snapchat/LINE/Pinterest in-app browsers and Chrome on
//      iOS — those are handled separately).
//   2. `isPwaInstalled()` — already installed as a PWA. If true, skip
//      the walkthrough entirely (standalone display-mode match).
// The call site composes these two checks and decides whether to route.
//
// This MUST stay aligned with `lib/detectClient.ts` detection rules.
// If the FB/IG IAB regex in `app/signup/page.tsx` grows a new match,
// grow this one too.

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIos = /iPhone|iPad|iPod/i.test(ua)
  if (!isIos) return false
  // Exclude FB/IG/TikTok/WhatsApp in-app browsers (already handled separately)
  const isIab = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|TikTok|WhatsApp|Messenger|Twitter|X-App|Snapchat|LINE|Pinterest/i.test(ua)
  if (isIab) return false
  // Exclude Chrome on iOS (it's still WebKit but behaves differently for Add-to-Home)
  const isChrome = /CriOS/i.test(ua)
  if (isChrome) return false
  return /Safari/i.test(ua)
}

export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}
