import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Outbound click tracker.
//
// Two shapes:
//   { business_id, click_type, port_id?, referrer? }
//     → logs to business_clicks
//   { url, context, port_id? }
//     → logs to link_clicks (SENTRI signup, partner links, etc.)
//
// Fire-and-forget from the client. Anonymous calls are accepted
// (user_id stays null). Failures never surface to the user — we
// never block a click on a tracker request.

type BusinessClickBody = {
  business_id: string
  click_type: 'phone' | 'whatsapp' | 'website' | 'address' | 'instagram' | 'facebook'
  port_id?: string
  referrer?: string
}
type LinkClickBody = {
  url: string
  context?: string
  port_id?: string
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  let body: BusinessClickBody | LinkClickBody
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const db = getServiceClient()

  if ('business_id' in body && body.business_id) {
    const validTypes: BusinessClickBody['click_type'][] = ['phone', 'whatsapp', 'website', 'address', 'instagram', 'facebook']
    if (!validTypes.includes(body.click_type)) {
      return NextResponse.json({ error: 'Invalid click_type' }, { status: 400 })
    }
    const { error } = await db.from('business_clicks').insert({
      business_id: body.business_id,
      user_id: userId,
      click_type: body.click_type,
      port_id: body.port_id?.slice(0, 12) || null,
      referrer: body.referrer?.slice(0, 50) || null,
    })
    if (error) {
      console.error('business click track error:', error)
      // Don't surface — still return ok so the client never sees a tracker fail
    }
    return NextResponse.json({ ok: true })
  }

  if ('url' in body && body.url) {
    const url = body.url.slice(0, 500)
    const context = body.context?.slice(0, 50) || null
    const { error } = await db.from('link_clicks').insert({
      url,
      user_id: userId,
      context,
      port_id: body.port_id?.slice(0, 12) || null,
    })
    if (error) console.error('link click track error:', error)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Missing business_id or url' }, { status: 400 })
}
