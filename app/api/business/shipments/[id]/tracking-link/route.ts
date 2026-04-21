import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { randomBytes } from 'node:crypto'

// POST — creates a short-lived tracking token for a shipment and
// returns a copy-paste-ready string the dispatcher drops into WhatsApp
// or email. Token is the only auth on the public /track/[token] page;
// treat it like a signed URL — expires in 72 hours by default.

export const dynamic = 'force-dynamic'

function shortToken(): string {
  // 10-byte URL-safe short code (~80 bits, collision-safe for token table).
  return randomBytes(10).toString('base64url')
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data: profile } = await db.from('profiles').select('tier').eq('id', user.id).single()
  if (profile?.tier !== 'business') {
    return NextResponse.json({ error: 'Business plan required' }, { status: 403 })
  }

  const { data: shipment } = await db
    .from('shipments')
    .select('id, reference_id, port_id, description')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!shipment) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const hours = Number.isFinite(body?.hours) ? Math.max(1, Math.min(168, Number(body.hours))) : 72
  const token = shortToken()
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

  const { error } = await db.from('shipment_tokens').insert({
    token,
    shipment_id: shipment.id,
    user_id: user.id,
    expires_at: expiresAt,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'
  const url = `${base}/track/${token}`

  const es = req.nextUrl.searchParams.get('lang') !== 'en'
  const shareText = es
    ? `${shipment.reference_id}: sigue tu carga en vivo · live tracking ${url}`
    : `${shipment.reference_id}: live shipment tracking ${url}`

  return NextResponse.json({
    token,
    url,
    expires_at: expiresAt,
    share_text: shareText,
  })
}
