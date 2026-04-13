import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// Community vs CBP divergence — meta-tracking that tells Diego
// how often community-reported waits disagree with the CBP reading
// at the same timestamp, and in which direction. High positive
// divergence (community > CBP) means CBP is lagging reality. High
// negative means community is panicking about a wait CBP doesn't
// see. The absolute magnitude is also a signal: low divergence
// means CBP is a trustworthy source at that port, high divergence
// means community data is the authoritative layer there.
//
// This is one of the proprietary-dataset plays — nobody else has
// both a community report feed AND a government wait feed to
// cross-reference.

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
    return null
  }
  return user
}

interface Report {
  port_id: string
  wait_minutes: number
  created_at: string
}

interface Reading {
  port_id: string
  vehicle_wait: number | null
  recorded_at: string
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  // Pull all community reports in the last 14 days that carry an
  // actual wait_minutes number (ignoring hazard/accident reports
  // that don't have a wait-time payload).
  const { data: reports } = await db
    .from('crossing_reports')
    .select('port_id, wait_minutes, created_at')
    .gte('created_at', since)
    .not('wait_minutes', 'is', null)
    .limit(2000)

  const reportRows = (reports || []) as Report[]
  if (reportRows.length === 0) {
    return NextResponse.json({ samples: 0, avgDeltaMin: null, absAvgDeltaMin: null, byPort: [] })
  }

  // Pull the CBP readings in the same window — one query, grouped
  // by port client-side. Avoids N+1 lookups.
  const portIds = Array.from(new Set(reportRows.map((r) => r.port_id)))
  const { data: readings } = await db
    .from('wait_time_readings')
    .select('port_id, vehicle_wait, recorded_at')
    .in('port_id', portIds)
    .gte('recorded_at', since)
    .not('vehicle_wait', 'is', null)
    .order('recorded_at', { ascending: true })
  const readingRows = (readings || []) as Reading[]

  const readingsByPort = new Map<string, Reading[]>()
  for (const r of readingRows) {
    if (!readingsByPort.has(r.port_id)) readingsByPort.set(r.port_id, [])
    readingsByPort.get(r.port_id)!.push(r)
  }

  // Helper: find the CBP reading nearest in time to a given timestamp.
  function nearestReading(portId: string, ts: number): number | null {
    const list = readingsByPort.get(portId) || []
    if (list.length === 0) return null
    let best: { r: Reading; diff: number } | null = null
    for (const r of list) {
      const diff = Math.abs(new Date(r.recorded_at).getTime() - ts)
      if (diff > 30 * 60 * 1000) continue // 30 min window
      if (!best || diff < best.diff) best = { r, diff }
    }
    return best?.r.vehicle_wait ?? null
  }

  // Compute deltas + per-port aggregation
  const deltas: number[] = []
  const perPort = new Map<string, { sum: number; count: number; absSum: number }>()
  for (const rep of reportRows) {
    const cbp = nearestReading(rep.port_id, new Date(rep.created_at).getTime())
    if (cbp == null) continue
    const delta = rep.wait_minutes - cbp
    deltas.push(delta)
    const p = perPort.get(rep.port_id) || { sum: 0, count: 0, absSum: 0 }
    p.sum += delta
    p.count += 1
    p.absSum += Math.abs(delta)
    perPort.set(rep.port_id, p)
  }

  const avgDelta =
    deltas.length > 0 ? deltas.reduce((s, d) => s + d, 0) / deltas.length : null
  const absAvgDelta =
    deltas.length > 0
      ? deltas.reduce((s, d) => s + Math.abs(d), 0) / deltas.length
      : null

  const byPort = Array.from(perPort.entries())
    .map(([portId, v]) => ({
      portId,
      samples: v.count,
      avgDeltaMin: Math.round(v.sum / v.count),
      absAvgDeltaMin: Math.round(v.absSum / v.count),
    }))
    .sort((a, b) => b.absAvgDeltaMin - a.absAvgDeltaMin)
    .slice(0, 20)

  return NextResponse.json(
    {
      samples: deltas.length,
      avgDeltaMin: avgDelta != null ? Math.round(avgDelta) : null,
      absAvgDeltaMin: absAvgDelta != null ? Math.round(absAvgDelta) : null,
      byPort,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
