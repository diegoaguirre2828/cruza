import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getPortMeta } from '@/lib/portMeta'

// Weekly delay report — fires Mondays 13:00 UTC (8am CT).
// Target: every Business tier user who had at least one shipment
// tracked in the prior 7 days. Email shows total $ lost, worst
// lane/port, and a per-shipment breakdown. Hard-retention feature —
// hits the dispatcher's Monday inbox with the number that sells the
// renewal ("you lost $1,240 to border delays last week").

export const dynamic = 'force-dynamic'

const HOURLY_DEFAULT = 85

async function sendEmail(
  email: string,
  payload: {
    ownerName: string | null
    totalCost: number
    totalMinutes: number
    delayedCount: number
    totalCount: number
    topPorts: Array<{ name: string; cost: number; minutes: number; count: number }>
    fromDate: string
    toDate: string
  },
) {
  if (!process.env.RESEND_API_KEY) return
  const from = process.env.RESEND_FROM_EMAIL || 'Cruzar Alerts <onboarding@resend.dev>'
  const { totalCost, totalMinutes, delayedCount, totalCount, topPorts, fromDate, toDate } = payload
  const greeting = payload.ownerName ? payload.ownerName : 'Dispatcher'
  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fafafa;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        Perdiste $${totalCost} · You lost $${totalCost} on border delays last week
      </div>
      <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">
        🌉 Reporte semanal · Weekly delay report
      </h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 20px;">
        ${fromDate} → ${toDate}
      </p>
      <div style="background:linear-gradient(135deg,#fee2e2,#fecaca);border:1px solid #fca5a5;border-radius:14px;padding:22px;margin-bottom:20px;">
        <p style="margin:0;font-size:12px;font-weight:600;color:#7f1d1d;text-transform:uppercase;letter-spacing:1px;">
          Pérdida total · Total loss
        </p>
        <p style="margin:6px 0 0;font-size:42px;font-weight:900;color:#991b1b;line-height:1;">
          $${totalCost.toLocaleString()}
        </p>
        <p style="margin:8px 0 0;font-size:13px;color:#991b1b;">
          ${delayedCount} de ${totalCount} cargas con demora · ${delayedCount} of ${totalCount} shipments delayed
        </p>
        <p style="margin:4px 0 0;font-size:12px;color:#7f1d1d;">
          ${totalMinutes} min de demora total · ${totalMinutes} total delay minutes
        </p>
      </div>
      ${topPorts.length > 0 ? `
      <h3 style="color:#111827;font-size:15px;margin:20px 0 10px;">
        Puentes peor · Worst crossings
      </h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${topPorts.map(p => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600;">${p.name}</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#dc2626;font-weight:700;">$${p.cost.toLocaleString()}</td>
            <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280;">${p.count} cargas · shipments</td>
          </tr>
        `).join('')}
      </table>` : ''}
      <div style="margin-top:28px;">
        <a href="https://cruzar.app/business"
           style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
          Ver dashboard · View dashboard →
        </a>
      </div>
      <p style="margin:28px 0 0;font-size:11px;color:#9ca3af;line-height:1.5;">
        Hola ${greeting}. Este reporte es parte de tu plan Cruzar Business. ·
        This report is part of your Cruzar Business plan.
        <a href="https://cruzar.app/dashboard" style="color:#6b7280;">Manage preferences</a>
      </p>
    </div>
  `
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `🌉 Perdiste $${payload.totalCost} esta semana · You lost $${payload.totalCost} this week`,
      html,
    }),
  })
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const isAuthed =
    secret === process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}`
  if (!isAuthed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getServiceClient()
  const to = new Date()
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)

  const { data: businessUsers } = await db
    .from('profiles')
    .select('id, display_name')
    .eq('tier', 'business')
  if (!businessUsers?.length) return NextResponse.json({ sent: 0, note: 'no business users' })

  let sent = 0
  for (const bu of businessUsers) {
    const { data: shipments } = await db
      .from('shipments')
      .select('id, port_id, delay_minutes, updated_at')
      .eq('user_id', bu.id)
      .gte('updated_at', from.toISOString())
    const rows = shipments ?? []
    if (rows.length === 0) continue

    let totalMinutes = 0
    let delayedCount = 0
    const perPort: Record<string, { minutes: number; count: number }> = {}
    for (const s of rows) {
      const m = s.delay_minutes ?? 0
      if (m > 0) {
        totalMinutes += m
        delayedCount++
        const k = s.port_id || 'unknown'
        if (!perPort[k]) perPort[k] = { minutes: 0, count: 0 }
        perPort[k].minutes += m
        perPort[k].count++
      }
    }
    const totalCost = Math.round((totalMinutes / 60) * HOURLY_DEFAULT)
    if (totalCost === 0) continue

    const topPorts = Object.entries(perPort)
      .map(([portId, v]) => {
        const meta = getPortMeta(portId)
        return {
          name: meta?.localName || meta?.city || portId,
          minutes: v.minutes,
          count: v.count,
          cost: Math.round((v.minutes / 60) * HOURLY_DEFAULT),
        }
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3)

    const { data: userRow } = await db.auth.admin.getUserById(bu.id)
    const email = userRow?.user?.email
    if (!email) continue

    await sendEmail(email, {
      ownerName: bu.display_name,
      totalCost,
      totalMinutes,
      delayedCount,
      totalCount: rows.length,
      topPorts,
      fromDate: from.toISOString().slice(0, 10),
      toDate: to.toISOString().slice(0, 10),
    })
    sent++
  }

  return NextResponse.json({ sent, total_business: businessUsers.length })
}
