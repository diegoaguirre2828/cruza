import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceClient } from '@/lib/supabase'

// For each of the user's saved crossings, returns the most recent
// community report in the last 30 min (if any). Powers the home
// reciprocity card: "Maria reportó tu puente hace 8 min — devuelve
// el favor cuando cruces."
//
// The reciprocity loop is what makes FB border groups work. Someone
// reports what they see, the next person in line relies on it, then
// reports back when they cross. This endpoint exists so we can
// surface that loop on the user's home page the moment someone else
// has done them a favor at a bridge they care about.

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const { data: saved } = await db
    .from('saved_crossings')
    .select('port_id')
    .eq('user_id', user.id)

  const portIds = (saved || []).map((s: { port_id: string }) => s.port_id).filter(Boolean)
  if (portIds.length === 0) {
    return NextResponse.json({ activity: [] })
  }

  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  interface ActivityRow {
    port_id: string
    report_type: string
    created_at: string
    username: string | null
    wait_minutes: number | null
  }

  const { data: reports } = await db
    .from('crossing_reports')
    .select('port_id, report_type, created_at, username, wait_minutes')
    .in('port_id', portIds)
    .gte('created_at', since)
    .neq('user_id', user.id) // don't echo the user's own reports back
    .order('created_at', { ascending: false })
    .limit(10)

  // Dedupe — one most-recent report per port
  const byPort = new Map<string, ActivityRow>()
  for (const r of (reports || []) as ActivityRow[]) {
    if (!byPort.has(r.port_id)) byPort.set(r.port_id, r)
  }

  return NextResponse.json(
    { activity: Array.from(byPort.values()) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
