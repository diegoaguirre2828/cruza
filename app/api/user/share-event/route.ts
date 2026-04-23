import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Share-event counter. Fires when a user taps WhatsApp / Copy / Share
// buttons anywhere in the app. Increments profiles.share_count by 1 for
// logged-in users. Anonymous shares are tracked as a no-op so the call
// is still safe.
//
// This is intentionally lightweight — no events table, no source column,
// no timestamps beyond updated_at. Just a counter. If we need channel/
// context attribution later (for the giveaway drawing) we add a proper
// share_events table then.
const VALID_CHANNELS = new Set(['whatsapp', 'facebook', 'copy', 'native'])

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // Anonymous share — accept silently so clients don't have to branch
    return NextResponse.json({ ok: true, anonymous: true })
  }

  // Parse the body so we can store channel + context per-share.
  // Kept optional — the old callers that send no body still work.
  let channel: string | null = null
  let context: string | null = null
  try {
    const body = await req.json()
    if (body && typeof body === 'object') {
      if (typeof body.channel === 'string' && VALID_CHANNELS.has(body.channel)) {
        channel = body.channel
      }
      if (typeof body.context === 'string' && body.context.length <= 60) {
        context = body.context
      }
    }
  } catch { /* empty body is fine */ }

  const db = getServiceClient()

  // Rate-limit: count this user's share_events in the last 24h BEFORE the
  // new insert. Reward is gated to max 3 eligible shares per 24h so a
  // scripted Copy-button loop can't farm 150 days of Pro in seconds.
  // If share_events query errors or table is missing, fail closed (no
  // reward) — audit 2026-04-23 H6.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: recentShares, error: countErr } = await db
    .from('share_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  const overDailyCap = countErr !== null || (recentShares ?? 0) >= 3

  // Insert a row into share_events so the admin viral-loop view can
  // show per-share timestamps + channel breakdowns. Best-effort; if
  // the table doesn't exist yet (migration not run), we still bump
  // the profile counter below so nothing regresses.
  await db
    .from('share_events')
    .insert({ user_id: user.id, channel, context })
    .then(() => {}, () => {})

  const { data: profile } = await db
    .from('profiles')
    .select('share_count, pro_via_pwa_until')
    .eq('id', user.id)
    .single()
  const next = (profile?.share_count ?? 0) + 1

  // Share-to-unlock: every 3rd share bumps pro_via_pwa_until +30 days,
  // capped at the first 15 shares (so a max of +150 days of Pro bonus
  // per user). Rate-limit above caps at 3 eligible shares per 24h so
  // the total 150 days can't be farmed faster than ~50 calendar days.
  let proExtended = false
  let newProUntil: string | null = profile?.pro_via_pwa_until ?? null

  if (next > 0 && next % 3 === 0 && next <= 15 && !overDailyCap) {
    const baseline = profile?.pro_via_pwa_until
      ? new Date(Math.max(Date.now(), new Date(profile.pro_via_pwa_until).getTime()))
      : new Date()
    // Don't shorten grants already at 100-year founder-forever (would
    // be silly to "extend" by +30 days on top of year 2126).
    const isFoundersForever = profile?.pro_via_pwa_until
      ? new Date(profile.pro_via_pwa_until).getTime() > Date.now() + 365 * 10 * 24 * 60 * 60 * 1000
      : false
    if (!isFoundersForever) {
      const extended = new Date(baseline.getTime() + 30 * 24 * 60 * 60 * 1000)
      newProUntil = extended.toISOString()
      proExtended = true
    }
  }

  const updates: Record<string, unknown> = { share_count: next }
  if (proExtended && newProUntil) updates.pro_via_pwa_until = newProUntil

  await db
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  return NextResponse.json({
    ok: true,
    share_count: next,
    pro_extended: proExtended,
    pro_via_pwa_until: newProUntil,
    // Progress hint the frontend can use to surface "1 more share → +30 days"
    shares_until_next_reward: next >= 15 ? null : (3 - (next % 3)) % 3 || 3,
  })
}
