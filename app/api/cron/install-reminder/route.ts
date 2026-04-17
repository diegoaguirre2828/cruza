import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Install reminder cron — sends a one-time "your 3 months Pro is still
// waiting" email to users who signed up ≥22h ago and haven't installed
// the PWA yet. Closes the "got signup, never installed" gap Diego flagged.
//
// Fire schedule: daily at 14:00 UTC (morning CT) via cron-job.org.
// Accepts ?secret= or Authorization: Bearer per the standard cron auth.

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Cruzar Alerts <alerts@cruzar.app>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cruzar.app'

interface ProfileRow {
  id: string
  created_at: string
  pwa_installed_at: string | null
  pwa_reminded_at: string | null
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const db = getServiceClient()
  // Target window: users who signed up 22–72h ago. <22h is too early
  // (they might still install the same day). >72h the email feels stale.
  const now = new Date()
  const since = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()
  const until = new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString()

  const { data: targets, error } = await db
    .from('profiles')
    .select('id, created_at, pwa_installed_at, pwa_reminded_at')
    .is('pwa_installed_at', null)
    .is('pwa_reminded_at', null)
    .gte('created_at', since)
    .lte('created_at', until)
    .limit(100)
    .returns<ProfileRow[]>()

  if (error) {
    console.error('install-reminder: query failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = targets || []
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, at: now.toISOString() })
  }

  // Pull the auth.users email for each target — auth table requires
  // service-role access, which we already have via getServiceClient.
  let sent = 0
  let skipped = 0
  for (const row of rows) {
    try {
      const { data: userRes } = await db.auth.admin.getUserById(row.id)
      const email = userRes?.user?.email
      const langPref = userRes?.user?.user_metadata?.lang === 'en' ? 'en' : 'es'
      if (!email) { skipped++; continue }

      const subject = langPref === 'en'
        ? '🎁 Your 3 months Pro is still waiting — cruzar.app'
        : '🎁 Tus 3 meses de Pro siguen esperando — cruzar.app'
      const html = langPref === 'en'
        ? reminderHtmlEn(APP_URL)
        : reminderHtmlEs(APP_URL)

      const res = await fetch(RESEND_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          subject,
          html,
        }),
      })
      if (!res.ok) {
        skipped++
        continue
      }
      // Stamp so we never re-send to this user
      await db
        .from('profiles')
        .update({ pwa_reminded_at: now.toISOString() })
        .eq('id', row.id)
      sent++
    } catch {
      skipped++
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, attempted: rows.length, at: now.toISOString() })
}

function reminderHtmlEs(appUrl: string): string {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f5f5f7;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
    <div style="padding:28px 24px 20px 24px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;">
      <div style="font-size:42px;line-height:1;margin-bottom:10px;">🎁</div>
      <h1 style="margin:0;font-size:24px;font-weight:900;line-height:1.15;">Tus 3 meses de Pro siguen esperando</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#1f2937;">
        Hola 👋 — te registraste en cruzar.app pero todavía no agregaste la app a tu pantalla de inicio. Con un toque más, desbloqueas:
      </p>
      <ul style="padding-left:20px;margin:0 0 20px 0;font-size:14px;line-height:1.7;color:#374151;">
        <li>🔔 Alertas cuando tu puente baje — antes de salir de casa</li>
        <li>🎥 Cámaras en vivo de cada cruce</li>
        <li>📊 La mejor hora pa' cruzar hoy, basado en patrones reales</li>
        <li>🗺️ Optimizador de ruta cuando andas apurado</li>
      </ul>
      <a href="${appUrl}/welcome" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-weight:900;font-size:15px;padding:14px 22px;border-radius:14px;text-decoration:none;">Terminar de activar Pro →</a>
      <p style="margin:18px 0 0 0;font-size:12px;color:#6b7280;line-height:1.5;">
        10 segundos, gratis, sin tarjeta. Después de los 90 días puedes seguir gratis o pasar a Pro pagado por $2.99/mes.
      </p>
    </div>
  </div>
  <p style="text-align:center;margin:18px 0 0 0;font-size:11px;color:#9ca3af;">
    Cruzar · Tiempos de espera en vivo US-México · <a href="${appUrl}" style="color:#9ca3af;">cruzar.app</a>
  </p>
</div></body></html>`
}

function reminderHtmlEn(appUrl: string): string {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f5f5f7;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
    <div style="padding:28px 24px 20px 24px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;">
      <div style="font-size:42px;line-height:1;margin-bottom:10px;">🎁</div>
      <h1 style="margin:0;font-size:24px;font-weight:900;line-height:1.15;">Your 3 months of Pro is still waiting</h1>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#1f2937;">
        Hey 👋 — you signed up on cruzar.app but haven't added the app to your home screen yet. One more tap unlocks:
      </p>
      <ul style="padding-left:20px;margin:0 0 20px 0;font-size:14px;line-height:1.7;color:#374151;">
        <li>🔔 Alerts when your bridge drops — before you leave the house</li>
        <li>🎥 Live cameras at every crossing</li>
        <li>📊 Today's best time to cross, based on real patterns</li>
        <li>🗺️ Route optimizer for when you're in a rush</li>
      </ul>
      <a href="${appUrl}/welcome" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-weight:900;font-size:15px;padding:14px 22px;border-radius:14px;text-decoration:none;">Finish activating Pro →</a>
      <p style="margin:18px 0 0 0;font-size:12px;color:#6b7280;line-height:1.5;">
        10 seconds, free, no card. After 90 days you can stay free or move to paid Pro for $2.99/mo.
      </p>
    </div>
  </div>
  <p style="text-align:center;margin:18px 0 0 0;font-size:11px;color:#9ca3af;">
    Cruzar · Live US-Mexico border wait times · <a href="${appUrl}" style="color:#9ca3af;">cruzar.app</a>
  </p>
</div></body></html>`
}
