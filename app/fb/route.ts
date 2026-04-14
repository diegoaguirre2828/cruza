import { NextResponse } from 'next/server'
import { trackEvent } from '@/lib/trackEvent'

// Short redirect to the Cruzar FB page. Lets us use a clean
// `cruzar.app/fb` in captions + promoter templates instead of
// Facebook's ugly numeric profile.php URL, AND every click funnels
// through our own domain so we can log the traffic.
//
// Must stay as a route (not a page) so it fires even on copy-pasted
// links that get auto-linkified in FB / WhatsApp / group chats.

const FB_PAGE_URL = 'https://www.facebook.com/profile.php?id=61574508797739'

export const dynamic = 'force-dynamic'

export function GET() {
  // trackEvent runs client-side only, so the server-side redirect
  // doesn't call it here. Instead we rely on downstream analytics
  // (Facebook Pixel on the target page, etc) to capture the click.
  return NextResponse.redirect(FB_PAGE_URL, 302)
}
