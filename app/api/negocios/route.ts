import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')
  const portId = req.nextUrl.searchParams.get('portId')

  const db = getServiceClient()
  let query = db
    .from('rewards_businesses')
    .select('id, name, description, address, port_ids, category, logo_emoji, phone, whatsapp, website, hours, claimed, listing_tier, notes_es, instagram, facebook')
    .eq('approved', true)
    .order('listing_tier', { ascending: false }) // featured first
    .order('claimed', { ascending: false })       // claimed second
    .order('name', { ascending: true })

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }
  if (portId) {
    query = query.contains('port_ids', [portId])
  }

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ businesses: data || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, description, address, category, phone, whatsapp, port_ids, submitted_by_email, hours, notes_es } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 })

  const EMOJI_MAP: Record<string, string> = {
    exchange: '💱', dental: '🦷', pharmacy: '💊', restaurant: '🌮',
    cafe: '☕', gas: '⛽', tire: '🔧', taxi: '🚕', other: '🏪',
  }

  const db = getServiceClient()
  const { data, error } = await db.from('rewards_businesses').insert({
    name: name.trim(),
    description: description?.trim() || null,
    address: address?.trim() || null,
    category: category || 'other',
    logo_emoji: EMOJI_MAP[category] || '🏪',
    phone: phone?.trim() || null,
    whatsapp: whatsapp?.trim() || null,
    port_ids: port_ids || [],
    submitted_by_email: submitted_by_email?.trim() || null,
    hours: hours?.trim() || null,
    notes_es: notes_es?.trim() || null,
    approved: true,   // free listings go live immediately
    claimed: false,
    listing_tier: 'free',
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id })
}
