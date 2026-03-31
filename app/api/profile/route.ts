import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

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
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single()
  const { data: sub } = await db.from('subscriptions').select('tier, status, current_period_end').eq('user_id', user.id).single()

  return NextResponse.json({ profile, subscription: sub, email: user.email })
}

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['display_name', 'full_name', 'company', 'role', 'bio']
  const updates: Record<string, string> = {}
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  const db = getServiceClient()
  await db.from('profiles').update(updates).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
