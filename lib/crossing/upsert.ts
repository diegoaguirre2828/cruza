// lib/crossing/upsert.ts
//
// findOrCreateActiveCrossing — the central plumbing that makes every
// consumer feature compose onto the SAME row when they fire within the
// same trip window. Without this helper, the alert system, geofence
// detector, report submission, copilot, etc. each create their own
// crossing rows and the substrate becomes a list of separate point-
// records again — exactly the "silos wrapped up in one place" Diego
// flagged 2026-05-04.
//
// Logic:
//   1. Look for an in-progress crossing (status in planning|en_route|
//      in_line|crossing) for this user × this port within last 6h.
//   2. If found → return existing row + payload. Caller can call
//      extendCrossing() to add new blocks and re-sign.
//   3. If not found → compose a new crossing with the provided block(s)
//      + insert.
//
// The 6h window matches the typical commuter trip span (set alert in
// the morning, cross within 1-2h, occasional same-day round trips).
// Crossings older than 6h are treated as separate trips.

import { getServiceClient } from '@/lib/supabase'
import { composeCrossing, extendCrossing } from './generate'
import type {
  CrossingComposeInput,
  CruzarCrossingV1,
  SignedCrossing,
} from './types'

const ACTIVE_STATES = ['planning', 'en_route', 'in_line', 'crossing'] as const
const TRIP_WINDOW_HOURS = 6

interface ExistingCrossingRow {
  id: string
  user_id: string
  port_id: string
  port_name?: string | null
  direction: 'us_to_mx' | 'mx_to_us'
  status: CruzarCrossingV1['status']
  modules_present: string[]
  cohort_tags: string[]
  blocks: CruzarCrossingV1['blocks']
  started_at: string
  ended_at: string | null
}

export interface UpsertResult {
  id: string
  payload: CruzarCrossingV1
  signed: SignedCrossing
  created: boolean
}

export async function findOrCreateActiveCrossing(
  input: CrossingComposeInput,
  opts?: { closeAfterUpsert?: boolean }
): Promise<UpsertResult> {
  const db = getServiceClient()
  const since = new Date(Date.now() - TRIP_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  // Try to find an in-progress crossing for this user × this port.
  const { data: existing } = await db
    .from('crossings')
    .select('id, user_id, port_id, port_name, direction, status, modules_present, cohort_tags, blocks, started_at, ended_at')
    .eq('user_id', input.user_id)
    .eq('port_id', input.port_id)
    .in('status', [...ACTIVE_STATES])
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const row = existing as ExistingCrossingRow
    const existingPayload: CruzarCrossingV1 = {
      schema: 'cruzar.crossing.v1',
      id: row.id,
      user_id: row.user_id,
      port_id: row.port_id,
      port_name: row.port_name ?? input.port_name ?? undefined,
      direction: row.direction,
      status: row.status,
      modules_present: row.modules_present as CruzarCrossingV1['modules_present'],
      cohort_tags: row.cohort_tags,
      started_at: row.started_at,
      ended_at: row.ended_at,
      blocks: row.blocks,
    }

    const closing = opts?.closeAfterUpsert || input.closure !== undefined
    const nextStatus: CruzarCrossingV1['status'] = closing ? 'completed' : existingPayload.status
    const closedAt = closing ? new Date().toISOString() : null

    const { payload, signed } = await extendCrossing(existingPayload, input, {
      status: nextStatus,
      ended_at: closing ? closedAt : existingPayload.ended_at,
    })

    const { error: updErr } = await db
      .from('crossings')
      .update({
        modules_present: payload.modules_present,
        cohort_tags: payload.cohort_tags,
        blocks: payload.blocks,
        status: payload.status,
        ended_at: payload.ended_at,
        signature: signed.signature_b64,
        signed_at: new Date().toISOString(),
        signing_key_id: signed.signing_key_id,
      })
      .eq('id', row.id)

    if (updErr) throw new Error(`crossings update failed: ${updErr.message}`)
    return { id: row.id, payload, signed, created: false }
  }

  // No active crossing — compose new.
  const closing = opts?.closeAfterUpsert || input.closure !== undefined
  const initialStatus: CruzarCrossingV1['status'] = closing
    ? 'completed'
    : (input.status ?? (input.detection ? 'crossing' : 'planning'))

  const { payload, signed } = await composeCrossing(
    { ...input, status: initialStatus },
    { ended_at: closing ? new Date().toISOString() : null }
  )

  const { error: insErr } = await db.from('crossings').insert({
    id: payload.id,
    user_id: input.user_id,
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
  })

  if (insErr) throw new Error(`crossings insert failed: ${insErr.message}`)
  return { id: payload.id, payload, signed, created: true }
}

// Snooze the matching active alert for this user × this port. Used by
// closure paths (auto-cross-detect, manual "ya crucé", report submit).
// Returns the alert id that got snoozed (or null if none matched).
export async function snoozeMatchingAlert(
  userId: string,
  portId: string,
  hoursForward = 16
): Promise<{ alert_id: string; snoozed_until: string } | null> {
  const db = getServiceClient()
  const nowIso = new Date().toISOString()
  const { data: matching } = await db
    .from('alert_preferences')
    .select('id')
    .eq('user_id', userId)
    .eq('port_id', portId)
    .eq('active', true)
    .or(`snoozed_until.is.null,snoozed_until.lt.${nowIso}`)
    .limit(1)
    .maybeSingle()

  if (!matching) return null

  const snoozedUntil = new Date(Date.now() + hoursForward * 60 * 60 * 1000).toISOString()
  const { error } = await db
    .from('alert_preferences')
    .update({ snoozed_until: snoozedUntil })
    .eq('id', matching.id)

  if (error) return null
  return { alert_id: matching.id, snoozed_until: snoozedUntil }
}
