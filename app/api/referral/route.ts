import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET — return the user's referral code, completed count, and Pro status
export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  // Find the user's seed row (referred_id IS NULL = the code-holder row)
  const { data: seedRow } = await db
    .from('referrals')
    .select('referral_code')
    .eq('referrer_id', user.id)
    .is('referred_id', null)
    .maybeSingle()

  if (!seedRow) {
    return NextResponse.json({
      referral_code: null,
      completed_count: 0,
      earned_pro: false,
      pro_active: false,
      pro_until: null,
      referrals: [],
    })
  }

  // Count completed + rewarded referrals (rows where referred_id is NOT null)
  const { data: completedRows } = await db
    .from('referrals')
    .select('status, completed_at')
    .eq('referrer_id', user.id)
    .not('referred_id', 'is', null)
    .in('status', ['completed', 'rewarded'])
    .order('completed_at', { ascending: false })

  const completedCount = completedRows?.length || 0

  // Check if the pro_via_referral_until is still active
  const { data: profile } = await db
    .from('profiles')
    .select('pro_via_referral_until')
    .eq('id', user.id)
    .single()

  const proActiveUntil = profile?.pro_via_referral_until
    ? new Date(profile.pro_via_referral_until)
    : null
  const proActive = proActiveUntil ? proActiveUntil.getTime() > Date.now() : false

  return NextResponse.json({
    referral_code: seedRow.referral_code,
    completed_count: completedCount,
    earned_pro: completedCount >= 3,
    pro_active: proActive,
    pro_until: proActiveUntil?.toISOString() || null,
    referrals: (completedRows || []).map((r) => ({
      status: r.status,
      completed_at: r.completed_at,
    })),
  })
}

// POST — generate a referral code for the user if they don't have one
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

  // Check if user already has a seed row
  const { data: existing } = await db
    .from('referrals')
    .select('referral_code')
    .eq('referrer_id', user.id)
    .is('referred_id', null)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ referral_code: existing.referral_code })
  }

  // Generate code: first 8 chars of user ID (uuid without hyphens)
  const code = user.id.replace(/-/g, '').slice(0, 8)

  // Check for collision (extremely unlikely with UUIDs but safe)
  const { data: collision } = await db
    .from('referrals')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle()

  const finalCode = collision
    ? user.id.replace(/-/g, '').slice(0, 12)
    : code

  // Insert seed row — referred_id is NULL, marking this as the code-holder
  const { error } = await db.from('referrals').insert({
    referrer_id: user.id,
    referred_id: null,
    referral_code: finalCode,
    status: 'pending',
  })

  if (error) {
    console.error('referral/route POST: insert error', error)
    return NextResponse.json({ error: 'Failed to create referral code' }, { status: 500 })
  }

  return NextResponse.json({ referral_code: finalCode })
}
