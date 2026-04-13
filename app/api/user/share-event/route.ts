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

  // Optional body: { channel?: string, context?: string } — ignored for now,
  // but consumed so the client can send them without breaking.
  try { await req.json() } catch { /* empty body is fine */ }

  const db = getServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('share_count')
    .eq('id', user.id)
    .single()
  const next = (profile?.share_count ?? 0) + 1
  await db
    .from('profiles')
    .update({ share_count: next })
    .eq('id', user.id)

  return NextResponse.json({ ok: true, share_count: next })
}
