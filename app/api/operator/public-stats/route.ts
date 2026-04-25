import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 60

// GET /api/operator/public-stats
//
// Anonymized counters for the marketing landing page. No auth, no PII.
// Just two numbers: validations in last 7 days + active operator subs.
// Cached 60s so the live counter doesn't hammer the DB on every load.

export async function GET() {
  const db = getServiceClient()
  const iso7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [val, sub] = await Promise.all([
    db.from('operator_validations').select('*', { count: 'exact', head: true }).gte('created_at', iso7d),
    db.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'operator'),
  ])

  return NextResponse.json({
    validations7d: val.count ?? 0,
    subs: sub.count ?? 0,
  })
}
