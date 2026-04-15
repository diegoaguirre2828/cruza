import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

// Meta Conversions API — server-side event forwarding for conversions
// that the browser Pixel can't track (iOS 17+ App Tracking Transparency
// blocks 3rd-party cookies in Safari, Firefox blocks by default, Brave
// blocks by default). Without this, boosted ads lose most of their
// attribution data for the 58% iOS majority.
//
// Called server-side from:
//   - Stripe webhook on subscription.created (Purchase + StartTrial)
//   - /api/profile on first profile creation (CompleteRegistration)
//
// Requires env vars:
//   META_PIXEL_ID             — same value as NEXT_PUBLIC_META_PIXEL_ID
//   META_CAPI_ACCESS_TOKEN    — Meta-issued long-lived access token
//                                from Business Manager → System User
//
// If either is missing, we silently no-op so the calling code doesn't
// need to gate its own behavior on pixel config.

interface CapiEvent {
  eventName: 'Lead' | 'CompleteRegistration' | 'StartTrial' | 'Subscribe' | 'Purchase'
  eventTime?: number
  eventId?: string
  email?: string
  externalId?: string
  value?: number
  currency?: string
  actionSource?: 'website' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other'
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export async function POST(req: NextRequest) {
  const pixelId = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID
  const token = process.env.META_CAPI_ACCESS_TOKEN

  if (!pixelId || !token) {
    // Silent no-op — pixel not configured yet
    return NextResponse.json({ ok: true, skipped: 'not_configured' })
  }

  let body: CapiEvent
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const userData: Record<string, string> = {}
  if (body.email) userData.em = sha256Hex(body.email)
  if (body.externalId) userData.external_id = sha256Hex(body.externalId)

  // Client IP + user agent help Meta match to the browser pixel event
  // if both fire for the same conversion (server + client dedupe via
  // eventId). Falls through cleanly if headers are missing.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? ''
  const ua = req.headers.get('user-agent') ?? ''
  if (ip) userData.client_ip_address = ip
  if (ua) userData.client_user_agent = ua

  const event: Record<string, unknown> = {
    event_name: body.eventName,
    event_time: body.eventTime ?? Math.floor(Date.now() / 1000),
    event_source_url: 'https://cruzar.app',
    action_source: body.actionSource ?? 'website',
    user_data: userData,
  }
  if (body.eventId) event.event_id = body.eventId
  if (body.value != null) {
    event.custom_data = { value: body.value, currency: body.currency ?? 'USD' }
  }

  const capiUrl = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`
  const res = await fetch(capiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [event] }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ ok: false, error: text }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
