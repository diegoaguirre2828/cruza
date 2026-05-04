import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { composeCrossing } from '@/lib/crossing/generate'
import type { CrossingDirection } from '@/lib/crossing/types'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'cruzabusiness@gmail.com'

// POST /api/admin/backfill-crossings
//
// Phase 2 of the Cruzar Crossing substrate (per docs/cruzar-crossing-
// record-brainstorm.md). Walks historical crossing_reports rows with
// non-null user_id and creates a corresponding crossings row with a
// `report` block + `closure` block (a submitted report is by
// definition a closure event). Skips reports that already have a
// matching crossing row for the same user × port × ±10-minute window.
//
// Body:
//   { since?: ISO_TIMESTAMP, limit?: number, dryRun?: boolean }
//
// since defaults to the most-recent already-backfilled crossing's
// linked_report_id timestamp (cursor pattern). limit clamped to 500.
// dryRun reports counts without inserting.

interface ReportRow {
  id: string
  port_id: string
  user_id: string
  wait_minutes: number | null
  direction: 'northbound' | 'southbound' | null
  report_type: string | null
  created_at: string
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supa.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    since?: string
    limit?: number
    dryRun?: boolean
  }
  const limit = Math.min(Math.max(body.limit ?? 100, 1), 500)
  const dryRun = !!body.dryRun

  const db = getServiceClient()

  // Resolve the cursor — either explicit `since`, or the latest
  // already-backfilled report's created_at, or null (full backfill).
  let cursor = body.since ?? null
  if (!cursor) {
    const { data: latest } = await db
      .from('crossings')
      .select('started_at, linked_report_id')
      .not('linked_report_id', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest?.started_at) cursor = latest.started_at
  }

  let query = db
    .from('crossing_reports')
    .select('id, port_id, user_id, wait_minutes, direction, report_type, created_at')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (cursor) query = query.gt('created_at', cursor)

  const { data: reports, error: readErr } = await query
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 })
  }

  const rows = (reports ?? []) as ReportRow[]

  let inserted = 0
  let skippedExisting = 0
  let skippedInvalid = 0
  let lastSeen: string | null = null

  for (const r of rows) {
    lastSeen = r.created_at
    if (!r.user_id || !r.port_id) { skippedInvalid++; continue }

    const direction: CrossingDirection = r.direction === 'southbound' ? 'us_to_mx' : 'mx_to_us'
    const submittedAt = r.created_at

    // Skip if a crossing already exists for this user × port within
    // ±10 minutes of the report timestamp. Idempotency guard so
    // re-running the backfill doesn't double-up.
    const windowStart = new Date(new Date(submittedAt).getTime() - 10 * 60 * 1000).toISOString()
    const windowEnd = new Date(new Date(submittedAt).getTime() + 10 * 60 * 1000).toISOString()
    const { data: existing } = await db
      .from('crossings')
      .select('id')
      .eq('user_id', r.user_id)
      .eq('port_id', r.port_id)
      .gte('started_at', windowStart)
      .lte('started_at', windowEnd)
      .limit(1)
      .maybeSingle()
    if (existing) { skippedExisting++; continue }

    if (dryRun) { inserted++; continue }

    const { payload, signed } = await composeCrossing({
      user_id: r.user_id,
      port_id: r.port_id,
      direction,
      status: 'completed',
      report: {
        report_id: r.id,
        wait_minutes: r.wait_minutes,
        report_type: r.report_type ?? 'unknown',
        submitted_at: submittedAt,
      },
      closure: {
        closed_at: submittedAt,
        reason: 'report_submitted',
        alert_id_snoozed: null,
        snoozed_until: null,
      },
    }, { started_at: submittedAt, ended_at: submittedAt })

    const { error: insErr } = await db.from('crossings').insert({
      id: payload.id,
      user_id: r.user_id,
      port_id: payload.port_id,
      direction: payload.direction,
      status: payload.status,
      modules_present: payload.modules_present,
      cohort_tags: payload.cohort_tags,
      blocks: payload.blocks,
      signature: signed.signature_b64,
      signed_at: new Date().toISOString(),
      signing_key_id: signed.signing_key_id,
      started_at: payload.started_at,
      ended_at: payload.ended_at,
      linked_report_id: r.id,
    })

    if (insErr) {
      // Don't abort the whole batch — log + skip the offender.
      skippedInvalid++
      continue
    }
    inserted++
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    scanned: rows.length,
    inserted,
    skipped_existing: skippedExisting,
    skipped_invalid: skippedInvalid,
    cursor_next: lastSeen,
  })
}
