import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { composeCrossing } from '@/lib/crossing/generate'
import type { CrossingComposeInput, CrossingDirection, CrossingStatus } from '@/lib/crossing/types'

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

// GET /api/crossings — list authenticated user's recent crossings.
// Query params: ?limit=20 (default 10, max 50)
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limitRaw = parseInt(req.nextUrl.searchParams.get('limit') || '10', 10)
  const limit = Math.min(Math.max(limitRaw, 1), 50)
  const portFilter = req.nextUrl.searchParams.get('port_id')?.trim() || null

  const db = getServiceClient()
  let query = db
    .from('crossings')
    .select('id, port_id, direction, status, modules_present, started_at, ended_at, signature, signing_key_id')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (portFilter) query = query.eq('port_id', portFilter)
  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ crossings: data ?? [] })
}

// POST /api/crossings — compose + insert a new crossing for the
// authenticated user. Body: CrossingComposeInput minus user_id (taken
// from auth). Returns the signed payload + db row id.
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { port_id, direction, status, ...rest } = body as Partial<CrossingComposeInput>

  if (!port_id || typeof port_id !== 'string') {
    return NextResponse.json({ error: 'port_id required' }, { status: 400 })
  }
  if (direction !== 'us_to_mx' && direction !== 'mx_to_us') {
    return NextResponse.json({ error: 'direction must be us_to_mx or mx_to_us' }, { status: 400 })
  }

  const compose: CrossingComposeInput = {
    user_id: user.id,
    port_id,
    direction,
    status: (status as CrossingStatus | undefined) ?? 'planning',
    ...rest,
  }

  const { payload, signed } = await composeCrossing(compose)

  const db = getServiceClient()
  const { error } = await db.from('crossings').insert({
    id: payload.id,
    user_id: user.id,
    port_id: payload.port_id,
    direction: payload.direction as CrossingDirection,
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: payload.id, signed })
}
