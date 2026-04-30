import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Anonymous-allowed telemetry endpoint. Apple Review (build 1.0.21,
// 2026-04-30) hit "subscription not configured" and we had no record of
// which step failed. This route lets the iOS Capacitor client fire-and-
// forget a row into app_events whenever RevenueCat returns an unexpected
// state (no offering, throw, etc), so future review failures are
// debuggable from SQL instead of guesswork.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 64) : 'unknown'
    const detail = typeof body?.detail === 'string' ? body.detail.slice(0, 512) : null
    const ts = typeof body?.ts === 'string' ? body.ts : new Date().toISOString()

    const sb = getServiceClient()
    await sb.from('app_events').insert({
      event_name: 'ios_iap_failure',
      props: {
        reason,
        detail,
        client_ts: ts,
        user_agent: req.headers.get('user-agent') ?? null,
      },
    })
  } catch {
    // Never throw — this is best-effort telemetry.
  }
  return NextResponse.json({ ok: true })
}
