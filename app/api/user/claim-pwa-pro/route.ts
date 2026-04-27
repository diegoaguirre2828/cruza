import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// PWA install → 3 months free Pro
//
// Called by the client when it detects the user has installed the app
// (either via the appinstalled event or when display-mode:standalone
// matches on subsequent loads). The server verifies the user is authed
// and grants Pro tier for 90 days, stored in profiles.pro_via_pwa_until.
//
// Safe to call multiple times — idempotent. If the user already has a
// longer grant, we don't shorten it. If they already have a paid Pro
// subscription from Stripe, we leave that alone and still track the
// install date for analytics.

const PWA_PRO_DAYS = 90
// 24h anti-spam gate REMOVED 2026-04-26. Diego's repeated frustration
// ("again, same issue with the pwa") was this: any user who installed
// the PWA within the last 24h saw 'free' tier. The gate's stated
// purpose was financial-DoS prevention against Twilio/Resend through
// alert-spam, but its effect on legitimate users (a full day of "did
// the install do anything?" confusion) was much worse. The right
// defense for SMS/email DoS lives at the alerts-cap layer (per-account
// alert limits + per-cron rate limits on outbound dispatch) — not at
// the Pro-grant layer. First call to this endpoint now grants both
// the 90-day PWA Pro and the lifetime first-1000 promo immediately,
// no install-age check.

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  // Read current state
  const { data: profile } = await db
    .from('profiles')
    .select('tier, pro_via_pwa_until, pwa_installed_at, promo_first_1000_until')
    .eq('id', user.id)
    .single()

  const now = new Date()
  const currentTier = profile?.tier || 'free'

  // Stamp pwa_installed_at on first hit so we have a record of when
  // the user crossed the install threshold (used by analytics + the
  // backfill scripts). Not gating on it anymore.
  if (!profile?.pwa_installed_at) {
    await db.from('profiles').update({ pwa_installed_at: now.toISOString() }).eq('id', user.id)
  }

  const grantExpiresAt = new Date(now.getTime() + PWA_PRO_DAYS * 24 * 60 * 60 * 1000)

  // Existing grant — don't shorten, only extend
  const existingExpiry = profile?.pro_via_pwa_until ? new Date(profile.pro_via_pwa_until) : null
  const newExpiry = existingExpiry && existingExpiry.getTime() > grantExpiresAt.getTime()
    ? existingExpiry
    : grantExpiresAt

  // If they're already a paid Pro/Business user, don't downgrade their tier
  // — just record the install date. The PWA grant is only meaningful for
  // users who'd otherwise be on free tier.
  const willUpgradeTier = currentTier === 'free' || currentTier === 'guest'

  const updates: Record<string, unknown> = {
    pro_via_pwa_until: newExpiry.toISOString(),
  }
  if (willUpgradeTier) updates.tier = 'pro'

  // First-1000 founding-member lifetime promo. Moved here from
  // handle_new_user (see v57 migration). Granted ONLY when the user has
  // verified their PWA install via this endpoint AND there's still a
  // slot under the global 1000 cap AND they don't already hold the
  // grant. Existing pre-v57 grants on the 267 backfilled users are
  // grandfathered and won't be re-granted (the !already check below).
  let promoGranted = false
  if (!profile?.promo_first_1000_until) {
    const { count: globalPromoCount } = await db
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .not('promo_first_1000_until', 'is', null)
    if ((globalPromoCount ?? 0) < 1000) {
      // 100-year window matches v51 / v37 convention — effectively
      // permanent founding-member status.
      const promoExpiresAt = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
      updates.promo_first_1000_until = promoExpiresAt.toISOString()
      promoGranted = true
    }
  }

  const { error } = await db.from('profiles').update(updates).eq('id', user.id)
  if (error) {
    console.error('claim-pwa-pro: update failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    granted: willUpgradeTier,
    tier: willUpgradeTier ? 'pro' : currentTier,
    pro_via_pwa_until: newExpiry.toISOString(),
    days: PWA_PRO_DAYS,
    founding_member: promoGranted,
  })
}
