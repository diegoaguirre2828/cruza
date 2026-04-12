import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const db = getServiceClient()

  const [authRes, profileRes, subRes, reportsRes, alertsRes, savedRes, pushRes] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from('profiles').select('*').eq('id', id).maybeSingle(),
    db.from('subscriptions').select('*').eq('user_id', id).maybeSingle(),
    db.from('crossing_reports')
      .select('id, port_id, report_type, wait_minutes, description, created_at, upvotes')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    db.from('alert_preferences')
      .select('id, port_id, lane_type, threshold_minutes, active, last_triggered_at')
      .eq('user_id', id),
    db.from('saved_crossings').select('port_id').eq('user_id', id),
    db.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', id),
  ])

  const authUser = authRes.data?.user

  return NextResponse.json({
    id,
    email: authUser?.email || '',
    auth_created_at: authUser?.created_at || null,
    last_sign_in_at: authUser?.last_sign_in_at || null,
    email_confirmed_at: authUser?.email_confirmed_at || null,
    provider: authUser?.app_metadata?.provider || null,
    profile: profileRes.data,
    subscription: subRes.data,
    reports: reportsRes.data || [],
    alerts: alertsRes.data || [],
    saved_ports: (savedRes.data || []).map(s => s.port_id),
    push_subscription_count: pushRes.count ?? 0,
  })
}
