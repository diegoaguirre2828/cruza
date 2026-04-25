import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

// PERF (2026-04-25 audit): rate updates ~hourly externally. Edge-cache
// the response for 5 minutes so every home page view doesn't burn a
// function invocation.
export const revalidate = 300

export async function GET() {
  // Fetch official mid-market rate
  let rate: number | null = null
  let updatedAt: string | null = null
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN', {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const data = await res.json()
      rate = data.rates?.MXN ?? null
      updatedAt = new Date().toISOString()
    }
  } catch { /* fallback to null */ }

  // Fetch community-reported rates from the last 6 hours
  let communityRates: { house_name: string; sell_rate: number; city: string | null; reported_at: string }[] = []
  let communityAvgSell: number | null = null
  try {
    const db = getServiceClient()
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
    const { data } = await db
      .from('exchange_rate_reports')
      .select('house_name, sell_rate, city, reported_at')
      .gte('reported_at', since)
      .order('reported_at', { ascending: false })
      .limit(10)

    if (data && data.length > 0) {
      communityRates = data
      const avg = data.reduce((sum, r) => sum + Number(r.sell_rate), 0) / data.length
      communityAvgSell = Math.round(avg * 100) / 100
    }
  } catch { /* ignore */ }

  return NextResponse.json({ rate, updatedAt, communityRates, communityAvgSell })
}
