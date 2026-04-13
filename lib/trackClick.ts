// Fire-and-forget outbound click tracker.
//
// Used to log when a user taps a business phone/WhatsApp/website, or
// clicks a partner/outbound link. Never blocks the user's click — the
// tracker is started with keepalive:true so it survives the page
// navigation that follows.

type BusinessClick = {
  business_id: string
  click_type: 'phone' | 'whatsapp' | 'website' | 'address' | 'instagram' | 'facebook'
  port_id?: string
  referrer?: string
}

type LinkClick = {
  url: string
  context?: string
  port_id?: string
}

function fire(payload: BusinessClick | LinkClick) {
  if (typeof window === 'undefined') return
  try {
    fetch('/api/track/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* ignore */ })
  } catch { /* ignore */ }
}

export function trackBusinessClick(payload: BusinessClick): void {
  fire(payload)
}

export function trackLinkClick(payload: LinkClick): void {
  fire(payload)
}
