import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const exchangeRateLimit = new Map<string, { count: number; resetAt: number }>()

function checkExchangeRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = exchangeRateLimit.get(ip)
  if (!entry || now > entry.resetAt) {
    exchangeRateLimit.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  if (!checkExchangeRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many reports. Try again later.' }, { status: 429 })
  }

  const body = await req.json()
  const { house_name, sell_rate, buy_rate, port_id, city } = body

  if (!house_name?.trim()) {
    return NextResponse.json({ error: 'house_name required' }, { status: 400 })
  }
  const sell = parseFloat(sell_rate)
  if (isNaN(sell) || sell <= 0 || sell < 10 || sell > 30) {
    return NextResponse.json({ error: 'sell_rate must be between 10 and 30 MXN/USD' }, { status: 400 })
  }

  // Get user if logged in (optional — guests can report too)
  let userId: string | null = null
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* ignore */ }

  const db = getServiceClient()

  const { data, error } = await db.from('exchange_rate_reports').insert({
    user_id: userId,
    house_name: house_name.trim().slice(0, 200),
    sell_rate: sell,
    buy_rate: buy_rate ? parseFloat(buy_rate) : null,
    port_id: port_id?.slice(0, 20) || null,
    city: city?.trim().slice(0, 100) || null,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Award 3 points to authenticated users for reporting a rate.
  //
  // SECURITY (2026-04-25 audit): per-user dedupe so the same user can't
  // farm 240 points/day by hitting the endpoint hourly (the IP rate
  // limit doesn't bind across IPs and was the only previous gate).
  // We allow ONE point award per user per 60 minutes regardless of
  // submission count.
  if (userId) {
    const cutoffIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recent } = await db
      .from('exchange_rate_reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('reported_at', cutoffIso)
    // recent counts THIS submission too, so >1 means at least one prior
    // report happened in the last hour and we already awarded those points.
    if ((recent || 0) <= 1) {
      const { data: profile } = await db.from('profiles').select('points').eq('id', userId).single()
      if (profile) {
        await db.from('profiles').update({ points: (profile.points || 0) + 3 }).eq('id', userId)
      }
    }
  }

  return NextResponse.json({ ok: true, id: data.id })
}
