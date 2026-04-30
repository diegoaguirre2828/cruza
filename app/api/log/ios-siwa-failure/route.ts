import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Anonymous-allowed telemetry endpoint mirroring ios-iap-failure. Apple
// Review (build 1.0.21, 2026-04-30) flagged a SIWA error and we had no
// audit trail telling us whether the @capgo/capacitor-social-login
// plugin returned an empty token or whether Supabase rejected the JWT.
// This route persists the stage + detail per attempt so we can diagnose
// from SQL after the fact.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const stage = typeof body?.stage === 'string' ? body.stage.slice(0, 64) : 'unknown'
    const detail = typeof body?.detail === 'string' ? body.detail.slice(0, 512) : null
    const ts = typeof body?.ts === 'string' ? body.ts : new Date().toISOString()

    const sb = getServiceClient()
    await sb.from('app_events').insert({
      event_name: 'ios_siwa_failure',
      props: {
        stage,
        detail,
        client_ts: ts,
        user_agent: req.headers.get('user-agent') ?? null,
      },
    })
  } catch {
    // Never throw — best-effort telemetry only.
  }
  return NextResponse.json({ ok: true })
}
