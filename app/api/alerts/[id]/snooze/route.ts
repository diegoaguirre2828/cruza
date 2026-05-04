import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { findOrCreateActiveCrossing } from '@/lib/crossing/upsert'

export const dynamic = 'force-dynamic'

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

// POST /api/alerts/[id]/snooze — user tapped "ya crucé" on a push (or
// equivalent UI). Sets snoozed_until to next 4am local-ish (use UTC
// now + a window that captures most timezones — 16h gives 4am-ish for
// CST users at 12pm cross-time, longer for early-morning crossings).
//
// Also writes a Closure block to a Cruzar Crossing record. If no
// crossing record exists for this alert+user in the last 6h, a new
// crossing is composed from the alert metadata (port_id, direction
// inferred us_to_mx default since most consumer-side alerts are
// south-to-north commute toward US).
//
// Body: { reason?: 'user_button_ya_cruce' | 'manual', direction?: 'us_to_mx' | 'mx_to_us' }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: alertId } = await params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()

  // Read alert; verify ownership.
  const { data: alert, error: readErr } = await db
    .from('alert_preferences')
    .select('id, user_id, port_id, lane_type, threshold_minutes, last_triggered_at, active')
    .eq('id', alertId)
    .maybeSingle()

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!alert) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (alert.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { reason, direction } = body as { reason?: 'user_button_ya_cruce' | 'manual'; direction?: 'us_to_mx' | 'mx_to_us' }

  // Snooze until ~next-day 4am local-ish. CST is UTC-6; aim for 4am CST = 10:00 UTC.
  // For tonight's MVP, a 16h forward window covers the typical commuter case.
  const snoozeUntil = new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString()

  // Update alert row.
  const { error: updErr } = await db
    .from('alert_preferences')
    .update({ snoozed_until: snoozeUntil })
    .eq('id', alertId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Find-or-extend the active crossing for this user × port. This
  // composes the closure block onto any in-progress trip (alert
  // already-fired-block, prep-block from co-pilot start, etc) instead
  // of creating an isolated row.
  const closedAt = new Date().toISOString()
  const upsert = await findOrCreateActiveCrossing({
    user_id: user.id,
    port_id: alert.port_id,
    direction: direction ?? 'us_to_mx',
    closure: {
      closed_at: closedAt,
      reason: reason ?? 'user_button_ya_cruce',
      alert_id_snoozed: alertId,
      snoozed_until: snoozeUntil,
    },
  }, { closeAfterUpsert: true })

  return NextResponse.json({
    ok: true,
    snoozed_until: snoozeUntil,
    crossing_id: upsert.id,
  })
}
