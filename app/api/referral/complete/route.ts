import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PRO_REWARD_THRESHOLD = 3
const PRO_REWARD_DAYS = 30

// POST — mark a referral as completed when a new user signs up via ?ref= param.
// Called from the signup flow after the new user creates an account.
// Body: { referral_code: string }
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { referral_code?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { referral_code } = body
  if (!referral_code || typeof referral_code !== 'string') {
    return NextResponse.json({ error: 'referral_code required' }, { status: 400 })
  }

  const db = getServiceClient()

  // Look up the referrer's seed row by code
  const { data: seedRow } = await db
    .from('referrals')
    .select('referrer_id, referral_code')
    .eq('referral_code', referral_code)
    .is('referred_id', null)
    .maybeSingle()

  if (!seedRow) {
    return NextResponse.json({ ok: false, reason: 'invalid_code' })
  }

  // Can't refer yourself
  if (seedRow.referrer_id === user.id) {
    return NextResponse.json({ ok: false, reason: 'self_referral' })
  }

  // Check if this user was already referred by this referrer
  const { data: alreadyReferred } = await db
    .from('referrals')
    .select('id')
    .eq('referrer_id', seedRow.referrer_id)
    .eq('referred_id', user.id)
    .maybeSingle()

  if (alreadyReferred) {
    return NextResponse.json({ ok: false, reason: 'already_referred' })
  }

  // Generate a unique code for this completed referral row.
  // Format: {base_code}:{first 8 chars of referred user id}
  const uniqueCode = `${referral_code}:${user.id.replace(/-/g, '').slice(0, 8)}`

  const { error: insertError } = await db.from('referrals').insert({
    referrer_id: seedRow.referrer_id,
    referred_id: user.id,
    referral_code: uniqueCode,
    status: 'completed',
    completed_at: new Date().toISOString(),
  })

  if (insertError) {
    console.error('referral/complete: insert error', insertError)
    return NextResponse.json({ error: 'Failed to record referral' }, { status: 500 })
  }

  // Count completed referrals for this referrer
  const { count } = await db
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', seedRow.referrer_id)
    .not('referred_id', 'is', null)
    .in('status', ['completed', 'rewarded'])

  const completedCount = count || 0

  // Award Pro if they hit the threshold
  let proAwarded = false
  if (completedCount >= PRO_REWARD_THRESHOLD) {
    const { data: profile } = await db
      .from('profiles')
      .select('pro_via_referral_until, tier')
      .eq('id', seedRow.referrer_id)
      .single()

    const existingUntil = profile?.pro_via_referral_until
      ? new Date(profile.pro_via_referral_until).getTime()
      : 0
    const now = Date.now()

    // Only grant if they don't already have an active referral Pro grant
    if (existingUntil < now) {
      const proUntil = new Date(now + PRO_REWARD_DAYS * 24 * 60 * 60 * 1000).toISOString()
      await db
        .from('profiles')
        .update({
          pro_via_referral_until: proUntil,
          tier: 'pro',
        })
        .eq('id', seedRow.referrer_id)

      // Mark all completed referrals as rewarded
      await db
        .from('referrals')
        .update({ status: 'rewarded' })
        .eq('referrer_id', seedRow.referrer_id)
        .eq('status', 'completed')

      proAwarded = true
    }
  }

  // Award referral points to the referrer
  const { data: referrerProfile } = await db
    .from('profiles')
    .select('points')
    .eq('id', seedRow.referrer_id)
    .single()

  if (referrerProfile) {
    await db
      .from('profiles')
      .update({ points: (referrerProfile.points || 0) + 15 })
      .eq('id', seedRow.referrer_id)
  }

  return NextResponse.json({
    ok: true,
    completed_count: completedCount,
    pro_awarded: proAwarded,
  })
}
