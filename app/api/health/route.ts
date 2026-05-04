import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { PORT_META } from '@/lib/portMeta'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/health
//
// Public bridge health score derived from confirmed Cruzar Crossing
// records (not from CBP feeds). Aggregates last 7 days per port:
//   - sample_count    — completed crossings
//   - avg_duration_min
//   - p50/p90 duration
//   - anomaly_rate    — % of crossings whose duration > 1.5x port-week median
//   - health_score    — 0-100 derived from sample density + anomaly rate
//
// No PII — only port-level aggregates. Service-role read.
//
// Query params:
//   ?port_id=230501  — single port detail
//   (no params)      — top 20 ports by sample count

interface CrossingRow {
  port_id: string
  started_at: string
  ended_at: string | null
  status: string
}

interface PortHealth {
  port_id: string
  port_name: string
  region: string
  sample_count: number
  avg_duration_min: number
  p50_duration_min: number
  p90_duration_min: number
  anomaly_rate: number
  health_score: number
  window_days: 7
  generated_at: string
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

function durationMinutes(r: CrossingRow): number | null {
  if (!r.ended_at) return null
  const ms = new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()
  if (!isFinite(ms) || ms < 0) return null
  return Math.round(ms / 60000)
}

function aggregatePort(portId: string, rows: CrossingRow[]): PortHealth | null {
  const meta = PORT_META[portId]
  if (!meta) return null
  const durations = rows
    .filter(r => r.port_id === portId && r.status === 'completed')
    .map(durationMinutes)
    .filter((m): m is number => m != null && m > 0 && m <= 360)

  if (durations.length === 0) return null

  durations.sort((a, b) => a - b)
  const sum = durations.reduce((a, b) => a + b, 0)
  const avg = Math.round(sum / durations.length)
  const p50 = percentile(durations, 0.5)
  const p90 = percentile(durations, 0.9)
  const median = p50

  const anomalyCount = durations.filter(d => d > median * 1.5).length
  const anomaly_rate = durations.length > 0 ? anomalyCount / durations.length : 0

  // Health score:
  //   - 60 pts from low anomaly rate (≤5% = full 60)
  //   - 30 pts from sample density (≥50 samples = full 30)
  //   - 10 pts from being on the lower end of avg duration (≤20min = full 10)
  const anomaly_pts = Math.max(0, 60 - Math.round(anomaly_rate * 600))
  const sample_pts = Math.min(30, Math.round((durations.length / 50) * 30))
  const speed_pts = avg <= 20 ? 10 : avg <= 45 ? 5 : 0
  const health_score = Math.min(100, anomaly_pts + sample_pts + speed_pts)

  return {
    port_id: portId,
    port_name: meta.localName || meta.city,
    region: meta.region,
    sample_count: durations.length,
    avg_duration_min: avg,
    p50_duration_min: p50,
    p90_duration_min: p90,
    anomaly_rate: Math.round(anomaly_rate * 1000) / 1000,
    health_score,
    window_days: 7,
    generated_at: new Date().toISOString(),
  }
}

export async function GET(req: NextRequest) {
  const portFilter = req.nextUrl.searchParams.get('port_id')?.trim() || null

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const db = getServiceClient()

  let query = db
    .from('crossings')
    .select('port_id, started_at, ended_at, status')
    .gte('started_at', since)
    .eq('status', 'completed')
    .limit(5000)
  if (portFilter) query = query.eq('port_id', portFilter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as CrossingRow[]
  const portIds = portFilter ? [portFilter] : Array.from(new Set(rows.map(r => r.port_id)))

  const ports = portIds
    .map(id => aggregatePort(id, rows))
    .filter((p): p is PortHealth => p != null)
    .sort((a, b) => b.sample_count - a.sample_count)
    .slice(0, portFilter ? 1 : 20)

  return NextResponse.json({
    window_days: 7,
    generated_at: new Date().toISOString(),
    ports,
  })
}
