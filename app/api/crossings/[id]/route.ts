import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { extendCrossing } from '@/lib/crossing/generate'
import type { CrossingComposeInput, CruzarCrossingV1 } from '@/lib/crossing/types'

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

interface RowShape {
  id: string
  user_id: string
  port_id: string
  port_name?: string | null
  direction: 'us_to_mx' | 'mx_to_us'
  status: CruzarCrossingV1['status']
  modules_present: string[]
  cohort_tags: string[]
  blocks: CruzarCrossingV1['blocks']
  signature: string | null
  signing_key_id: string | null
  started_at: string
  ended_at: string | null
}

// GET /api/crossings/[id] — return signed crossing bundle. Owner (RLS-
// matched) gets full payload + signature; everyone else gets 404 unless
// the crossing has been explicitly shared (share-token mechanism is a
// follow-up; v0 = owner-only).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  const db = getServiceClient()
  const { data, error } = await db
    .from('crossings')
    .select('id, user_id, port_id, port_name, direction, status, modules_present, cohort_tags, blocks, signature, signing_key_id, started_at, ended_at')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!user || user.id !== data.user_id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const row = data as RowShape
  return NextResponse.json({
    crossing: {
      schema: 'cruzar.crossing.v1',
      id: row.id,
      user_id: row.user_id,
      port_id: row.port_id,
      port_name: row.port_name ?? undefined,
      direction: row.direction,
      status: row.status,
      modules_present: row.modules_present,
      cohort_tags: row.cohort_tags,
      started_at: row.started_at,
      ended_at: row.ended_at,
      blocks: row.blocks,
    },
    signature_b64: row.signature,
    signing_key_id: row.signing_key_id,
  })
}

// PATCH /api/crossings/[id] — extend an existing crossing with new
// blocks. Owner-only. Re-signs after the merge. Used by /api/copilot/
// cross-detected, the snooze endpoint, the report submission flow, etc.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data: existing, error: readErr } = await db
    .from('crossings')
    .select('id, user_id, port_id, port_name, direction, status, modules_present, cohort_tags, blocks, started_at, ended_at')
    .eq('id', id)
    .maybeSingle()

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const patch = body as Partial<CrossingComposeInput> & { ended_at?: string | null; status?: CruzarCrossingV1['status'] }

  const existingPayload: CruzarCrossingV1 = {
    schema: 'cruzar.crossing.v1',
    id: existing.id,
    user_id: existing.user_id,
    port_id: existing.port_id,
    port_name: existing.port_name ?? undefined,
    direction: existing.direction,
    status: existing.status,
    modules_present: existing.modules_present as CruzarCrossingV1['modules_present'],
    cohort_tags: existing.cohort_tags,
    started_at: existing.started_at,
    ended_at: existing.ended_at,
    blocks: existing.blocks,
  }

  const { payload, signed } = await extendCrossing(existingPayload, patch, {
    ended_at: patch.ended_at,
    status: patch.status,
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
    .eq('id', id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ id: payload.id, signed })
}
