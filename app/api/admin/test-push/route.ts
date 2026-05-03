import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

// Admin endpoint to send a verbose test push to a specific user. Built
// 2026-05-03 evening so we can verify the push pipeline end-to-end
// without trusting the existing flow OR pestering Diego to install +
// subscribe + open the PWA. POST { user_id: "<uuid>" } OR { email: "..." }.
//
// Returns per-subscription delivery details: status code, error message,
// response headers — enough to diagnose VAPID mismatches, expired endpoints,
// 410 Gone responses, etc. Does not log results to push_subscriptions or
// any other table — pure diagnostic.

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'
const ADMIN_FALLBACK_EMAIL = 'diegonaguirre@icloud.com'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:cruzabusiness@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

interface SubResult {
  endpoint_host: string
  status: number | null
  ok: boolean
  error?: string
  duration_ms: number
}

export async function POST(req: NextRequest) {
  // Auth gate — admin email or Diego's primary account.
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (user.email !== ADMIN_EMAIL && user.email !== ADMIN_FALLBACK_EMAIL)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured on server' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { user_id, email } = body as { user_id?: string; email?: string }

  if (!user_id && !email) {
    return NextResponse.json({ error: 'pass user_id or email' }, { status: 400 })
  }

  const db = getServiceClient()

  // Resolve user_id from email if needed.
  let targetUserId = user_id
  if (!targetUserId && email) {
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: `no profile for email ${email}` }, { status: 404 })
    }
    targetUserId = profile.id
  }

  // Pull all push subscriptions for the target user.
  const { data: subs, error: subsErr } = await db
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, created_at, updated_at')
    .eq('user_id', targetUserId!)

  if (subsErr) {
    return NextResponse.json({ error: subsErr.message }, { status: 500 })
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({
      target_user_id: targetUserId,
      subscriptions: 0,
      message: 'no push_subscriptions rows for this user — they need to open the PWA + tap bell + accept push permission first',
      results: [],
    })
  }

  const payload = JSON.stringify({
    title: 'Cruzar — test push',
    body: `Test from /api/admin/test-push at ${new Date().toISOString()}`,
    url: 'https://cruzar.app/dashboard',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  })

  const results: SubResult[] = await Promise.all(
    subs.map(async (sub): Promise<SubResult> => {
      const start = Date.now()
      const endpoint_host = (() => {
        try { return new URL(sub.endpoint).host } catch { return 'invalid' }
      })()
      if (!sub.endpoint || !sub.p256dh || !sub.auth) {
        return {
          endpoint_host,
          status: null,
          ok: false,
          error: 'subscription missing endpoint / p256dh / auth in DB row',
          duration_ms: Date.now() - start,
        }
      }
      try {
        const response = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        return {
          endpoint_host,
          status: response.statusCode,
          ok: response.statusCode >= 200 && response.statusCode < 300,
          duration_ms: Date.now() - start,
        }
      } catch (err) {
        type WebpushError = { statusCode?: number; body?: string; message?: string }
        const e = err as WebpushError
        return {
          endpoint_host,
          status: e.statusCode ?? null,
          ok: false,
          error: e.body || e.message || String(err),
          duration_ms: Date.now() - start,
        }
      }
    })
  )

  const sent = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  return NextResponse.json({
    target_user_id: targetUserId,
    subscriptions: subs.length,
    sent,
    failed,
    results,
  })
}
