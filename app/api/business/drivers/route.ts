import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'
import { randomBytes } from 'crypto'

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

async function checkBusinessTier(userId: string) {
  const db = getServiceClient()
  const { data } = await db.from('profiles').select('tier').eq('id', userId).single()
  return data?.tier === 'business'
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkBusinessTier(user.id)) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })

  const db = getServiceClient()
  const { data, error } = await db
    .from('drivers')
    .select('*')
    .eq('owner_id', user.id)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ drivers: data || [] })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkBusinessTier(user.id)) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })

  const { name, phone, carrier, notes, dispatcher_phone } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const token = randomBytes(24).toString('hex')
  const db = getServiceClient()

  const { data, error } = await db.from('drivers').insert({
    owner_id: user.id,
    name: name.slice(0, 200),
    phone: phone?.slice(0, 50),
    carrier: carrier?.slice(0, 200),
    notes: notes?.slice(0, 500),
    dispatcher_phone: dispatcher_phone?.replace(/\D/g, '').slice(0, 20) || null,
    checkin_token: token,
  }).select('id, checkin_token').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id, token: data.checkin_token })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkBusinessTier(user.id)) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const allowed = ['name', 'phone', 'carrier', 'notes']
  const safe: Record<string, unknown> = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) safe[key] = updates[key]
  }

  const db = getServiceClient()
  await db.from('drivers').update(safe).eq('id', id).eq('owner_id', user.id)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkBusinessTier(user.id)) return NextResponse.json({ error: 'Business plan required' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getServiceClient()
  await db.from('drivers').delete().eq('id', id).eq('owner_id', user.id)
  return NextResponse.json({ success: true })
}
