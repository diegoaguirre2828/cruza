import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const STALE_HOURS = 24

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  // Accept either ?port_ids=id1,id2,id3 (corridor) or legacy ?port_id=id
  const portIdsParam = searchParams.get('port_ids')
  const portId = searchParams.get('port_id')
  const portIds = portIdsParam
    ? portIdsParam.split(',').filter(Boolean)
    : portId ? [portId] : null

  const db = getServiceClient()

  // Fetch listings — featured first
  let q = db.from('cambio_listings').select('*').eq('active', true)
  if (portIds?.length) q = q.in('port_id', portIds)
  const { data: listings, error } = await q.order('listing_tier', { ascending: false }).limit(60)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!listings?.length) return NextResponse.json({ listings: [], officialRate: null })

  // Latest rates from the last STALE_HOURS — linked by listing_id OR by house_name
  const since = new Date(Date.now() - STALE_HOURS * 3600 * 1000).toISOString()
  const ids = listings.map(l => l.id)
  const names = listings.map(l => l.name)

  const [linked, named] = await Promise.all([
    db.from('exchange_rate_reports')
      .select('listing_id, sell_rate, buy_rate, reported_at')
      .in('listing_id', ids)
      .gte('reported_at', since)
      .order('reported_at', { ascending: false }),
    db.from('exchange_rate_reports')
      .select('house_name, sell_rate, buy_rate, reported_at')
      .in('house_name', names)
      .is('listing_id', null)
      .gte('reported_at', since)
      .order('reported_at', { ascending: false }),
  ])

  // Latest rate per listing (linked beats named)
  const rateMap: Record<string, { sell_rate: number; buy_rate: number; reported_at: string }> = {}
  for (const r of named.data || []) {
    const l = listings.find(x => x.name === r.house_name)
    if (l && !rateMap[l.id]) rateMap[l.id] = { sell_rate: r.sell_rate, buy_rate: r.buy_rate, reported_at: r.reported_at }
  }
  for (const r of linked.data || []) {
    if (r.listing_id) rateMap[r.listing_id] = { sell_rate: r.sell_rate, buy_rate: r.buy_rate, reported_at: r.reported_at }
  }

  // Official rate — free public endpoint, no key needed
  let officialRate: number | null = null
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 3600 } })
    if (r.ok) officialRate = ((await r.json()) as { rates?: Record<string, number> }).rates?.MXN ?? null
  } catch { /* non-fatal */ }

  const enriched = listings
    .map(l => ({ ...l, rate: rateMap[l.id] ?? null }))
    .sort((a, b) => {
      // Featured always first
      if (a.listing_tier === 'featured' && b.listing_tier !== 'featured') return -1
      if (b.listing_tier === 'featured' && a.listing_tier !== 'featured') return 1
      // Then by best sell rate (higher = more pesos per dollar = better for crosser)
      return (b.rate?.sell_rate ?? 0) - (a.rate?.sell_rate ?? 0)
    })

  return NextResponse.json({ listings: enriched, officialRate })
}
