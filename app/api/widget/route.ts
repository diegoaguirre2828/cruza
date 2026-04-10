import { NextRequest, NextResponse } from 'next/server'
import { fetchRgvWaitTimes } from '@/lib/cbp'

export const dynamic = 'force-dynamic'

// Returns embeddable HTML snippet for a specific port
export async function GET(req: NextRequest) {
  const portId = req.nextUrl.searchParams.get('portId')
  const theme = req.nextUrl.searchParams.get('theme') || 'light'

  try {
    const ports = await fetchRgvWaitTimes()
    const port = portId ? ports.find(p => p.portId === portId) : ports[0]

    if (!port) {
      return new NextResponse('Port not found', { status: 404 })
    }

    const bg = theme === 'dark' ? '#1f2937' : '#ffffff'
    const text = theme === 'dark' ? '#f9fafb' : '#111827'
    const sub = theme === 'dark' ? '#9ca3af' : '#6b7280'
    const border = theme === 'dark' ? '#374151' : '#e5e7eb'

    const lane = (label: string, val: number | null) => {
      if (val === null) return ''
      const color = val <= 20 ? '#16a34a' : val <= 45 ? '#d97706' : '#dc2626'
      const display = val === 0 ? '<1' : String(val)
      return `
        <div style="text-align:center;padding:8px 12px;background:${theme === 'dark' ? '#374151' : '#f9fafb'};border-radius:10px;">
          <div style="font-size:20px;font-weight:700;color:${color};">${display}</div>
          <div style="font-size:10px;color:${sub};margin-top:1px;">${label}</div>
        </div>`
    }

    const lanes = [
      lane('Car', port.vehicle),
      lane('SENTRI', port.sentri),
      lane('Walk', port.pedestrian),
      lane('Truck', port.commercial),
    ].filter(Boolean).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}</style>
</head>
<body>
<div style="background:${bg};border:1px solid ${border};border-radius:14px;padding:14px;max-width:360px;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
    <div>
      <div style="font-size:13px;font-weight:700;color:${text};">🌉 ${port.portName}</div>
      <div style="font-size:11px;color:${sub};">${port.crossingName}</div>
    </div>
    <a href="https://cruzar.app/port/${encodeURIComponent(port.portId)}"
       target="_blank" rel="noopener"
       style="font-size:10px;color:#3b82f6;text-decoration:none;font-weight:600;">
      Live →
    </a>
  </div>
  <div style="display:grid;grid-template-columns:repeat(${Math.min(4, [port.vehicle, port.sentri, port.pedestrian, port.commercial].filter(v => v !== null).length)},1fr);gap:6px;">
    ${lanes}
  </div>
  <div style="margin-top:8px;font-size:9px;color:${sub};text-align:right;">
    Powered by <a href="https://cruzar.app" target="_blank" rel="noopener" style="color:${sub};">Cruzar</a>
  </div>
</div>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch {
    return new NextResponse('Error fetching data', { status: 500 })
  }
}
