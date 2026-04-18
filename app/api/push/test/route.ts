import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

// Test push endpoint. Sends a single notification to every subscription
// the calling user has registered, so they SEE the bridge alerts work
// the moment they grant permission. Removes the "did it actually work?"
// uncertainty that kills retention.

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 })
  }
  webpush.setVapidDetails(
    'mailto:diegonaguirre@icloud.com',
    vapidPublic,
    vapidPrivate
  )

  const db = getServiceClient()
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'no subscriptions yet' })
  }

  const payload = JSON.stringify({
    title: '✅ Cruzar — alertas activadas',
    body: 'Así te llegarán los avisos cuando tu puente baje de 30 min.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'test-alert',
    data: { url: '/dashboard' },
  })

  let sent = 0
  let failed = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        payload
      )
      sent++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ ok: true, sent, failed })
}
