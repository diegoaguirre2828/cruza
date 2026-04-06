import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET — load driver info by token (no auth required)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const db = getServiceClient()
  const { data: driver, error } = await db
    .from('drivers')
    .select('id, name, carrier, current_status, current_port_id, last_checkin_at, owner_id, dispatcher_phone')
    .eq('checkin_token', token)
    .single()

  if (error || !driver) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  // Get owner business name
  const { data: owner } = await db
    .from('profiles')
    .select('full_name, company_name')
    .eq('id', driver.owner_id)
    .single()

  return NextResponse.json({
    driver: {
      name: driver.name,
      carrier: driver.carrier,
      current_status: driver.current_status,
      current_port_id: driver.current_port_id,
      last_checkin_at: driver.last_checkin_at,
      company: owner?.company_name || owner?.full_name || null,
      dispatcher_phone: driver.dispatcher_phone || null,
    }
  })
}

// POST — update driver status by token (no auth required)
export async function POST(req: NextRequest) {
  const { token, status, portId } = await req.json()
  if (!token || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const VALID_STATUSES = ['available', 'en_route', 'in_line', 'at_bridge', 'cleared', 'delivered']
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const db = getServiceClient()

  const { data: driver, error } = await db
    .from('drivers')
    .select('id, name, owner_id')
    .eq('checkin_token', token)
    .single()

  if (error || !driver) return NextResponse.json({ error: 'Invalid link' }, { status: 404 })

  await db.from('drivers').update({
    current_status: status,
    current_port_id: portId || null,
    last_checkin_at: new Date().toISOString(),
  }).eq('id', driver.id)

  // Log cleared event so dispatcher can be notified (email via cron or future push)
  if (status === 'cleared') {
    try {
      await db.from('driver_events').insert({
        driver_id: driver.id,
        owner_id: driver.owner_id,
        event_type: 'cleared',
        port_id: portId || null,
      })
    } catch {} // table may not exist yet — silent fail

    // Feature 5C: Notify broker if there's an active shipment at this port
    try {
      const { data: shipment } = await db
        .from('shipments')
        .select('id, reference_id, broker_email, broker_name, description, origin, destination')
        .eq('user_id', driver.owner_id)
        .eq('status', 'crossing')
        .eq('port_id', portId || '')
        .single()

      if (shipment?.broker_email) {
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notify/broker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brokerEmail: shipment.broker_email,
            brokerName: shipment.broker_name,
            driverName: driver.name,
            referenceId: shipment.reference_id,
            portId: portId,
            clearedAt: new Date().toISOString(),
          }),
        }).catch(() => {}) // non-blocking
      }
    } catch {} // non-blocking — don't fail the checkin if broker lookup errors
  }

  return NextResponse.json({ success: true, driverName: driver.name })
}
