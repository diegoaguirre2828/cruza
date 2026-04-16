import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import webpush from 'web-push'

// Re-engagement push notification cron. Runs once daily (8am CT).
// Targets users who have push subscriptions but haven't visited in 3+ days.
// Sends a personalized notification with their saved bridge's current wait.
//
// This is the #1 retention lever for a daily-use app. Users who drift away
// after install are pulled back by seeing their bridge is fast right now.

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServiceClient()

  // Get current wait times
  let ports: Array<{ portId: string; portName: string; vehicle: number | null }> = []
  try {
    const res = await fetch('https://www.cruzar.app/api/ports', { cache: 'no-store' })
    const json = await res.json()
    ports = (json.ports || []).map((p: any) => ({
      portId: p.portId,
      portName: p.portName,
      vehicle: p.vehicle,
    }))
  } catch {
    return NextResponse.json({ error: 'Failed to fetch ports' }, { status: 500 })
  }

  // Find users with push subscriptions who have a saved crossing
  // and haven't had a push in the last 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, last_notified_at')
    .or(`last_notified_at.is.null,last_notified_at.lt.${threeDaysAgo}`)
    .limit(100)

  if (subsErr || !subs?.length) {
    return NextResponse.json({ sent: 0, reason: subsErr?.message || 'no eligible subs' })
  }

  // Get saved crossings for these users
  const userIds = [...new Set(subs.map(s => s.user_id).filter(Boolean))]
  const { data: savedCrossings } = await supabase
    .from('saved_crossings')
    .select('user_id, port_id')
    .in('user_id', userIds)

  const userPortMap = new Map<string, string>()
  for (const sc of savedCrossings || []) {
    if (!userPortMap.has(sc.user_id)) {
      userPortMap.set(sc.user_id, sc.port_id)
    }
  }

  let sent = 0
  let failed = 0
  const expired: string[] = []

  for (const sub of subs) {
    if (!sub.endpoint || !sub.p256dh || !sub.auth) continue

    // Find their saved bridge's current wait
    const savedPortId = sub.user_id ? userPortMap.get(sub.user_id) : null
    const port = savedPortId
      ? ports.find(p => p.portId === savedPortId)
      : null

    // Build notification
    let title: string
    let body: string
    let url = 'https://cruzar.app'

    if (port && port.vehicle != null) {
      const wait = port.vehicle
      if (wait <= 15) {
        title = `🟢 ${port.portName}: ${wait} min`
        body = 'Tu puente está rápido ahorita — buen momento pa\' cruzar'
      } else if (wait <= 45) {
        title = `🟡 ${port.portName}: ${wait} min`
        body = 'Checa los tiempos antes de salir'
      } else {
        title = `🔴 ${port.portName}: ${wait} min`
        body = 'Espera pesada ahorita — te avisamos cuando baje'
      }
      url = `https://cruzar.app/port/${port.portId}`
    } else {
      // No saved bridge — send generic
      const fastest = ports
        .filter(p => p.vehicle != null && p.vehicle >= 0)
        .sort((a, b) => (a.vehicle ?? 999) - (b.vehicle ?? 999))[0]
      if (fastest && fastest.vehicle != null) {
        title = `🌉 ${fastest.portName} está en ${fastest.vehicle} min`
        body = 'Tiempos en vivo de todos los puentes en cruzar.app'
      } else {
        title = '🌉 ¿Vas a cruzar hoy?'
        body = 'Checa los tiempos de espera antes de salir'
      }
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title,
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          data: { url },
          tag: 're-engage',
        }),
      )
      sent++

      // Update last_notified_at
      await supabase
        .from('push_subscriptions')
        .update({ last_notified_at: new Date().toISOString() })
        .eq('id', sub.id)
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expired.push(sub.id)
      }
      failed++
    }
  }

  // Clean up expired subscriptions
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }

  return NextResponse.json({ sent, failed, expired: expired.length })
}
