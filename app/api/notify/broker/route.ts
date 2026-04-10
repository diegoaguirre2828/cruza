import { NextRequest, NextResponse } from 'next/server'

const PORT_NAMES: Record<string, string> = {
  '230501': 'Hidalgo / McAllen',
  '230502': 'Pharr–Reynosa',
  '230401': 'Laredo I',
  '230402': 'Laredo II',
  '535501': 'Brownsville Gateway',
  '535502': 'Brownsville Veterans',
  '230301': 'Eagle Pass',
  '240201': 'El Paso',
}

export async function POST(req: NextRequest) {
  const { brokerEmail, brokerName, driverName, referenceId, portId, clearedAt } = await req.json()

  if (!brokerEmail || !referenceId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const portName = PORT_NAMES[portId] || portId || 'Unknown port'
  const time = new Date(clearedAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #16a34a; margin-bottom: 8px;">✅ Shipment Cleared</h2>
      <p style="color: #374151; margin-bottom: 16px;">Hello ${brokerName || 'there'},</p>
      <p style="color: #374151; margin-bottom: 16px;">
        Your shipment <strong>${referenceId}</strong> has cleared customs.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="background: #f9fafb;">
          <td style="padding: 10px 16px; color: #6b7280; font-size: 14px; width: 140px;">Port of Entry</td>
          <td style="padding: 10px 16px; font-weight: 600; color: #111827; font-size: 14px;">${portName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #6b7280; font-size: 14px;">Driver</td>
          <td style="padding: 10px 16px; color: #111827; font-size: 14px;">${driverName}</td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="padding: 10px 16px; color: #6b7280; font-size: 14px;">Cleared at</td>
          <td style="padding: 10px 16px; color: #111827; font-size: 14px;">${time}</td>
        </tr>
      </table>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        Sent via Cruzar Border Intelligence &middot; <a href="https://cruzar.app" style="color: #3b82f6;">cruzar.app</a>
      </p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Cruzar Alerts <onboarding@resend.dev>',
      to: [brokerEmail],
      subject: `✅ Shipment ${referenceId} cleared at ${portName}`,
      html,
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    console.error('[broker-notify] Resend error:', errBody)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
