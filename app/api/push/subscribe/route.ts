import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

async function getUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscription = await req.json()
  const db = getServiceClient()

  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : null
  const p256dh = subscription?.keys?.p256dh ?? null
  const auth = subscription?.keys?.auth ?? null

  // Validate the incoming payload — the table requires all three NOT NULL.
  // 16 days of silent failures (2026-04-17 → 2026-05-03) traced to the
  // server returning 200 here while the upsert errored on missing keys.
  // Diego found this 2026-05-03 — push table had 4 rows, all from before
  // the silent-fail window opened.
  if (!endpoint || !p256dh || !auth) {
    console.error('[push/subscribe] missing fields', {
      user_id: user.id,
      has_endpoint: !!endpoint,
      has_p256dh: !!p256dh,
      has_auth: !!auth,
      payload_keys: Object.keys(subscription ?? {}),
    })
    return NextResponse.json({
      error: 'missing required subscription fields',
      missing: {
        endpoint: !endpoint,
        p256dh: !p256dh,
        auth: !auth,
      },
    }, { status: 400 })
  }

  // Conflict on endpoint, not user_id (one user, many devices).
  const { error: upsertErr } = await db.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  if (upsertErr) {
    console.error('[push/subscribe] upsert failed', { user_id: user.id, error: upsertErr.message })
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  await db.from('push_subscriptions').delete().eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
