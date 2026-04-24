import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// H9 fix (audit 2026-04-23): per-token rate limit + token age check.
//
// Rate limit: 60 req/hour per token. In-memory Map; per-instance only
// (Vercel serverless instances each have their own counter — H7 is the
// follow-up to make this shared). Even per-instance is enough to stop
// a single bad actor flooding dispatcher view from one origin.
//
// Token age: a token is valid for 180 days from the LATER of created_at
// or last_checkin_at. Active drivers (checking in regularly) extend
// their own validity. Stale tokens stop authenticating, so a token
// leaked years ago can't update a driver that's no longer using the
// system.
const RATE_BUCKET = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 60 * 60 * 1000  // 1 hour
const RATE_LIMIT = 60                   // 60 req/hour per token
const TOKEN_MAX_AGE_DAYS = 180

function rateLimited(token: string): boolean {
  const now = Date.now()
  const bucket = RATE_BUCKET.get(token)
  if (!bucket || bucket.resetAt < now) {
    RATE_BUCKET.set(token, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  bucket.count++
  return bucket.count > RATE_LIMIT
}

function tokenExpired(driver: { last_checkin_at?: string | null; created_at?: string | null }): boolean {
  const now = Date.now()
  const cutoff = now - TOKEN_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const lastTouch = Math.max(
    driver.last_checkin_at ? new Date(driver.last_checkin_at).getTime() : 0,
    driver.created_at ? new Date(driver.created_at).getTime() : 0,
  )
  // If both timestamps are missing/zero, treat as legacy (don't expire).
  if (lastTouch === 0) return false
  return lastTouch < cutoff
}

// GET — load driver info by token (no auth required)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  if (rateLimited(token)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes.' },
      { status: 429 }
    )
  }

  const db = getServiceClient()
  const { data: driver, error } = await db
    .from('drivers')
    .select('id, name, carrier, current_status, current_port_id, last_checkin_at, owner_id, dispatcher_phone, created_at')
    .eq('checkin_token', token)
    .single()

  if (error || !driver) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  if (tokenExpired(driver)) {
    return NextResponse.json(
      { error: 'This check-in link has expired. Please ask your dispatcher for a new one.' },
      { status: 410 }
    )
  }

  // Get owner business name
  const { data: owner } = await db
    .from('profiles')
    .select('full_name, company')
    .eq('id', driver.owner_id)
    .single()

  return NextResponse.json({
    driver: {
      name: driver.name,
      carrier: driver.carrier,
      current_status: driver.current_status,
      current_port_id: driver.current_port_id,
      last_checkin_at: driver.last_checkin_at,
      company: owner?.company || owner?.full_name || null,
      dispatcher_phone: driver.dispatcher_phone || null,
    }
  })
}

// POST — update driver status by token (no auth required)
export async function POST(req: NextRequest) {
  const { token, status, portId } = await req.json()
  if (!token || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  if (rateLimited(token)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes.' },
      { status: 429 }
    )
  }

  const VALID_STATUSES = ['available', 'en_route', 'in_line', 'at_bridge', 'cleared', 'delivered']
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const db = getServiceClient()

  const { data: driver, error } = await db
    .from('drivers')
    .select('id, name, owner_id, last_checkin_at, created_at')
    .eq('checkin_token', token)
    .single()

  if (error || !driver) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  if (tokenExpired(driver)) {
    return NextResponse.json(
      { error: 'This check-in link has expired. Please ask your dispatcher for a new one.' },
      { status: 410 }
    )
  }

  await db.from('drivers').update({
    current_status: status,
    current_port_id: portId || null,
    last_checkin_at: new Date().toISOString(),
  }).eq('id', driver.id)

  // Notify broker if shipment cleared at this port
  if (status === 'cleared') {
    try {
      // Only query by port_id if we actually have one — empty string won't match anything
      let shipmentQuery = db
        .from('shipments')
        .select('id, reference_id, broker_email, broker_name')
        .eq('user_id', driver.owner_id)
        .eq('status', 'crossing')

      if (portId) shipmentQuery = shipmentQuery.eq('port_id', portId)

      const { data: shipment } = await shipmentQuery.limit(1).single()

      if (shipment?.broker_email) {
        const PORT_NAMES: Record<string, string> = {
          '230501': 'Hidalgo / McAllen', '230502': 'Pharr–Reynosa',
          '230503': 'Anzaldúas', '230901': 'Progreso', '230902': 'Donna',
          '230701': 'Rio Grande City', '231001': 'Roma',
          '535501': 'Brownsville Gateway', '535502': 'Brownsville Veterans',
          '535503': 'Los Tomates', '230401': 'Laredo I', '230402': 'Laredo II',
          '230301': 'Eagle Pass', '240201': 'El Paso', '250401': 'San Ysidro',
        }
        const portName = portId ? (PORT_NAMES[portId] || portId) : 'border crossing'
        const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

        // Call Resend directly — no internal HTTP hop needed
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'Cruzar Alerts <onboarding@resend.dev>',
            to: [shipment.broker_email],
            subject: `✅ Shipment ${shipment.reference_id} cleared at ${portName}`,
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:500px;margin:0 auto;padding:24px">
                <h2 style="color:#16a34a;margin-bottom:8px">✅ Shipment Cleared</h2>
                <p style="color:#374151">Hello ${shipment.broker_name || 'there'},</p>
                <p style="color:#374151">Shipment <strong>${shipment.reference_id}</strong> has cleared customs.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                  <tr style="background:#f9fafb"><td style="padding:10px 16px;color:#6b7280;font-size:14px;width:140px">Port of Entry</td><td style="padding:10px 16px;font-weight:600;color:#111827;font-size:14px">${portName}</td></tr>
                  <tr><td style="padding:10px 16px;color:#6b7280;font-size:14px">Driver</td><td style="padding:10px 16px;color:#111827;font-size:14px">${driver.name}</td></tr>
                  <tr style="background:#f9fafb"><td style="padding:10px 16px;color:#6b7280;font-size:14px">Cleared at</td><td style="padding:10px 16px;color:#111827;font-size:14px">${time}</td></tr>
                </table>
                <p style="color:#9ca3af;font-size:12px;margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px">
                  Sent via Cruzar Border Intelligence · <a href="https://cruzar.app" style="color:#3b82f6">cruzar.app</a>
                </p>
              </div>`,
          }),
        }).then(async (r) => {
          if (!r.ok) console.error('broker email failed:', await r.text())
        }).catch((err) => console.error('broker email error:', err))
      }
    } catch (err) { console.error('broker notify error:', err) }
  }

  return NextResponse.json({ success: true, driverName: driver.name })
}
